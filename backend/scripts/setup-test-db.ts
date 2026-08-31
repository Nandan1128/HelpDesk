import { Client } from 'pg';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load test environment variables
const possibleTestEnvPaths = [
  path.resolve(process.cwd(), '.env.test'),
  path.resolve(process.cwd(), 'backend', '.env.test'),
  path.resolve(process.cwd(), '..', '.env.test'),
];

for (const envPath of possibleTestEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    break;
  }
}

const rawDatabaseUrl = process.env.DATABASE_URL;

if (!rawDatabaseUrl) {
  console.error('❌ DATABASE_URL is not defined in .env.test');
  process.exit(1);
}

// Parse database URL to extract host, port, user, password, and database name
function parseDatabaseUrl(dbUrl: string) {
  try {
    const url = new URL(dbUrl);
    const dbName = url.pathname.replace(/^\//, '') || 'helpdesk_test';
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: dbName,
      schema: url.searchParams.get('schema') || 'public',
    };
  } catch {
    // Fallback regex parser for connection strings
    const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    if (!match) {
      throw new Error(`Failed to parse DATABASE_URL: ${dbUrl}`);
    }
    return {
      user: decodeURIComponent(match[1]),
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: parseInt(match[4], 10),
      database: match[5],
      schema: 'public',
    };
  }
}

export async function setupTestDatabase(options: { reset?: boolean; seed?: boolean } = {}) {
  const dbConfig = parseDatabaseUrl(rawDatabaseUrl!);
  console.log(`\n📦 Initializing test database: [${dbConfig.database}] on ${dbConfig.host}:${dbConfig.port}...`);

  // 1. Connect to default postgres maintenance database to manage test db creation
  const adminClient = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
  } catch (err) {
    console.error(`❌ Failed to connect to PostgreSQL server at ${dbConfig.host}:${dbConfig.port}:`, err instanceof Error ? err.message : err);
    throw err;
  }

  try {
    const checkDbRes = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbConfig.database]
    );

    const dbExists = checkDbRes.rowCount && checkDbRes.rowCount > 0;

    if (options.reset && dbExists) {
      console.log(`🔄 Resetting test database "${dbConfig.database}"...`);
      // Terminate any existing connections to the test db before dropping
      await adminClient.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
          AND pid <> pg_backend_pid();
      `, [dbConfig.database]);

      await adminClient.query(`DROP DATABASE "${dbConfig.database}"`);
      console.log(`🗑️ Dropped test database "${dbConfig.database}"`);
    }

    if (!dbExists || options.reset) {
      await adminClient.query(`CREATE DATABASE "${dbConfig.database}"`);
      console.log(`✨ Created test database: "${dbConfig.database}"`);
    } else {
      console.log(`✔️ Test database "${dbConfig.database}" already exists`);
    }
  } finally {
    await adminClient.end();
  }

  // 2. Run Prisma schema push on the test database
  console.log('🔄 Syncing Prisma schema with test database...');
  const backendDir = fs.existsSync(path.resolve(process.cwd(), 'prisma'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'backend');

  try {
    execSync('bun x prisma db push --skip-generate --accept-data-loss', {
      cwd: backendDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: rawDatabaseUrl,
        NODE_ENV: 'test',
      },
    });
    console.log('✅ Prisma schema synchronized successfully.');
  } catch (err) {
    console.error('❌ Failed to push schema to test database:', err);
    throw err;
  }

  // 3. Optionally seed the test database
  if (options.seed !== false) {
    console.log('🌱 Seeding test database with baseline test data...');
    try {
      execSync('bun prisma/seed.ts', {
        cwd: backendDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL: rawDatabaseUrl,
          NODE_ENV: 'test',
        },
      });
      console.log('✅ Test database seeded successfully.');
    } catch (err) {
      console.error('❌ Failed to seed test database:', err);
      throw err;
    }
  }

  console.log(`🎉 Test database [${dbConfig.database}] is ready for Playwright!\n`);
}

// Allow direct execution from CLI: bun backend/scripts/setup-test-db.ts [--reset] [--no-seed]
const isCLI = import.meta.main || process.argv[1]?.endsWith('setup-test-db.ts');
if (isCLI) {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const seed = !args.includes('--no-seed');

  setupTestDatabase({ reset, seed })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('Fatal error during test DB setup:', e);
      process.exit(1);
    });
}
