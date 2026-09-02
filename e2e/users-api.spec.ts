import { test, expect, APIRequestContext } from '@playwright/test';
import { seedTestDatabase, getTestPrismaClient, TEST_USERS } from './support/db';

async function signInAdmin(request: APIRequestContext) {
  const signInRes = await request.post('/api/auth/sign-in/email', {
    data: {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    },
  });
  expect(signInRes.status()).toBe(200);
}

async function signInAgent(request: APIRequestContext) {
  const signInRes = await request.post('/api/auth/sign-in/email', {
    data: {
      email: TEST_USERS.agent1.email,
      password: TEST_USERS.agent1.password,
    },
  });
  expect(signInRes.status()).toBe(200);
}

test.describe('User Management - List Users API (GET /api/users)', () => {
  test.beforeEach(async () => {
    await seedTestDatabase();
  });

  test.describe('Authentication & Authorization Guards', () => {
    test('should return 401 Unauthorized when unauthenticated', async ({ request }) => {
      const response = await request.get('/api/users');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toContain('Unauthorized');
    });

    test('should return 403 Forbidden when authenticated as Support Agent', async ({ request }) => {
      await signInAgent(request);

      const response = await request.get('/api/users');
      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body.error).toContain('Forbidden');
    });

    test('should return 200 OK and list of users when authenticated as Admin', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.get('/api/users');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.users).toBeDefined();
      expect(Array.isArray(body.users)).toBe(true);
      expect(body.users.length).toBe(5); // 2 Admins + 3 Agents
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(5);
      expect(body.pagination.page).toBe(1);

      // Check fields of admin user
      const adminUser = body.users.find((u: any) => u.email === TEST_USERS.admin.email);
      expect(adminUser).toBeDefined();
      expect(adminUser.role).toBe('ADMIN');
      expect(adminUser.isActive).toBe(true);
      expect(adminUser._count).toBeDefined();
      expect(typeof adminUser._count.assignedTickets).toBe('number');
      expect(adminUser.password).toBeUndefined();
    });
  });

  test.describe('Search and Filter Queries', () => {
    test('should filter users by search keyword matching name', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.get('/api/users?search=Sarah');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.users.length).toBe(1);
      expect(body.users[0].name).toBe('Sarah Connor');
      expect(body.users[0].email).toBe(TEST_USERS.agent1.email);
    });

    test('should filter users by search keyword matching email', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.get('/api/users?search=alex.agent');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.users.length).toBe(1);
      expect(body.users[0].email).toBe(TEST_USERS.agent2.email);
    });

    test('should filter users by role=ADMIN', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.get('/api/users?role=ADMIN');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.users.length).toBe(2);
      expect(body.users.every((u: any) => u.role === 'ADMIN')).toBe(true);
    });

    test('should filter users by role=AGENT', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.get('/api/users?role=AGENT');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.users.length).toBe(3);
      expect(body.users.every((u: any) => u.role === 'AGENT')).toBe(true);
    });

    test('should filter users by status=inactive', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.get('/api/users?status=inactive');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.users.length).toBe(1);
      expect(body.users[0].email).toBe(TEST_USERS.agent2.email);
      expect(body.users[0].isActive).toBe(false);
    });

    test('should sort users by name in ascending order', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.get('/api/users?sortBy=name&sortOrder=asc');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const names = body.users.map((u: any) => u.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  test.describe('GET /api/users/:id', () => {
    test('should return 401 Unauthorized when unauthenticated', async ({ request }) => {
      const response = await request.get('/api/users/00000000-0000-0000-0000-000000000000');
      expect(response.status()).toBe(401);
    });

    test('should return 404 for non-existent user ID', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.get('/api/users/00000000-0000-0000-0000-000000000000');
      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body.error).toContain('User not found');
    });

    test('should return user details for valid ID when authenticated as Admin', async ({ request }) => {
      await signInAdmin(request);

      const listRes = await request.get('/api/users');
      const listBody = await listRes.json();
      const firstUser = listBody.users[0];

      const response = await request.get(`/api/users/${firstUser.id}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe(firstUser.id);
      expect(body.user.name).toBe(firstUser.name);
      expect(body.user.email).toBe(firstUser.email);
    });
  });

  test.describe('POST /api/users - Create User API', () => {
    test('should return 401 Unauthorized when unauthenticated', async ({ request }) => {
      const response = await request.post('/api/users', {
        data: {
          name: 'New Agent',
          email: 'newagent@ticketai.local',
          password: 'Password123!',
        },
      });
      expect(response.status()).toBe(401);
    });

    test('should return 403 Forbidden when authenticated as Support Agent', async ({ request }) => {
      await signInAgent(request);

      const response = await request.post('/api/users', {
        data: {
          name: 'New Agent',
          email: 'newagent@ticketai.local',
          password: 'Password123!',
        },
      });
      expect(response.status()).toBe(403);
    });

    test('should return 400 when name is less than 3 characters or whitespace-only', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.post('/api/users', {
        data: {
          name: '   ',
          email: 'valid.email@ticketai.local',
          password: 'Password123!',
        },
      });
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('Name must be at least 3 characters');
    });

    test('should return 400 when password is less than 8 characters or whitespace-only', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.post('/api/users', {
        data: {
          name: 'Valid Name',
          email: 'valid.email@ticketai.local',
          password: '        ', // 8 spaces
        },
      });
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('Password must be at least 8 characters');
    });

    test('should return 400 when email is invalid', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.post('/api/users', {
        data: {
          name: 'Valid Name',
          email: 'invalid-email-format',
          password: 'Password123!',
        },
      });
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('Please enter a valid email address');
    });

    test('should return 400 when email is already registered', async ({ request }) => {
      await signInAdmin(request);

      const response = await request.post('/api/users', {
        data: {
          name: 'Duplicate Admin',
          email: TEST_USERS.admin.email,
          password: 'Password123!',
        },
      });
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('already exists');
    });

    test('should return 201 Created and allow new user to sign in with credentials', async ({ request }) => {
      await signInAdmin(request);

      const newUserData = {
        name: 'Carlos Mendez',
        email: 'carlos.mendez@ticketai.local',
        password: 'SecureAgentPass123!',
      };

      const response = await request.post('/api/users', {
        data: newUserData,
      });
      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.user.name).toBe(newUserData.name);
      expect(body.user.email).toBe(newUserData.email);
      expect(body.user.role).toBe('AGENT');
      expect(body.user.isActive).toBe(true);
      expect(body.user.password).toBeUndefined();

      // Verify the new user appears in the user list
      const listRes = await request.get('/api/users');
      const listBody = await listRes.json();
      expect(listBody.users.some((u: any) => u.email === newUserData.email)).toBe(true);
      expect(listBody.pagination.total).toBe(6);

      // Verify the new user can authenticate with Better Auth
      const loginRes = await request.post('/api/auth/sign-in/email', {
        data: {
          email: newUserData.email,
          password: newUserData.password,
        },
      });
      expect(loginRes.status()).toBe(200);
      const loginBody = await loginRes.json();
      expect(loginBody.user.email).toBe(newUserData.email);
    });
  });
});
