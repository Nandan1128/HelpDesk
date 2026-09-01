import { test, expect } from '@playwright/test';
import { seedTestDatabase, TEST_USERS } from './support/db';

test.describe('Authentication System - API Endpoints & Session Verification', () => {
  test.beforeEach(async () => {
    await seedTestDatabase();
  });

  test.describe('GET /api/me (Current User & Session)', () => {
    test('should return 401 Unauthorized when unauthenticated', async ({ request }) => {
      const response = await request.get('/api/me');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toContain('Unauthorized');
    });

    test('should return current user and safe session when authenticated as Admin', async ({ request }) => {
      // 1. Authenticate via Better Auth API
      const signInRes = await request.post('/api/auth/sign-in/email', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });
      expect(signInRes.status()).toBe(200);

      // 2. Query /api/me using the authenticated session cookie
      const meRes = await request.get('/api/me');
      expect(meRes.status()).toBe(200);

      const body = await meRes.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(TEST_USERS.admin.email);
      expect(body.user.role).toBe('ADMIN');
      expect(body.session).toBeDefined();
      // Verify raw session token is omitted from response for security
      expect(body.session.token).toBeUndefined();
    });

    test('should return current user and safe session when authenticated as Agent', async ({ request }) => {
      // 1. Authenticate via Better Auth API
      const signInRes = await request.post('/api/auth/sign-in/email', {
        data: {
          email: TEST_USERS.agent1.email,
          password: TEST_USERS.agent1.password,
        },
      });
      expect(signInRes.status()).toBe(200);

      // 2. Query /api/me
      const meRes = await request.get('/api/me');
      expect(meRes.status()).toBe(200);

      const body = await meRes.json();
      expect(body.user.email).toBe(TEST_USERS.agent1.email);
      expect(body.user.role).toBe('AGENT');
    });
  });

  test.describe('GET /api/admin/ping (Role-Based Access Control Middleware)', () => {
    test('should return 401 Unauthorized when unauthenticated', async ({ request }) => {
      const response = await request.get('/api/admin/ping');
      expect(response.status()).toBe(401);
    });

    test('should return 403 Forbidden when authenticated as Agent', async ({ request }) => {
      // 1. Sign in as Agent
      await request.post('/api/auth/sign-in/email', {
        data: {
          email: TEST_USERS.agent1.email,
          password: TEST_USERS.agent1.password,
        },
      });

      // 2. Attempt requesting admin-only endpoint
      const response = await request.get('/api/admin/ping');
      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body.error).toContain('Forbidden');
    });

    test('should return 200 and authorization message when authenticated as Admin', async ({ request }) => {
      // 1. Sign in as Admin
      await request.post('/api/auth/sign-in/email', {
        data: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        },
      });

      // 2. Request admin-only endpoint
      const response = await request.get('/api/admin/ping');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.message).toBe('Admin authorization verified');
      expect(body.user.role).toBe('ADMIN');
    });
  });
});
