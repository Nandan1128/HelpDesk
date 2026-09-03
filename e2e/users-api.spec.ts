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

  describe('PATCH /api/users/:id - Edit User Details & Password', () => {
    test('should return 401 Unauthorized when not logged in', async ({ request }) => {
      const response = await request.patch('/api/users/some-id', {
        data: { name: 'Unauthorized Update' },
      });
      expect(response.status()).toBe(401);
    });

    test('should return 403 Forbidden when logged in as non-admin agent', async ({ request }) => {
      await signInAgent(request);
      const response = await request.patch('/api/users/some-id', {
        data: { name: 'Forbidden Update' },
      });
      expect(response.status()).toBe(403);
    });

    test('should return 404 when user does not exist', async ({ request }) => {
      await signInAdmin(request);
      const response = await request.patch('/api/users/non-existent-user-id', {
        data: { name: 'New Name' },
      });
      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('User not found');
    });

    test('should return 400 when name is less than 3 characters or whitespace only', async ({ request }) => {
      await signInAdmin(request);
      const listRes = await request.get('/api/users');
      const listBody = await listRes.json();
      const targetUser = listBody.users.find((u: any) => u.email !== TEST_USERS.admin.email);

      const response = await request.patch(`/api/users/${targetUser.id}`, {
        data: { name: '  ' },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Name must be at least 3 characters');
    });

    test('should return 400 when password is entered but shorter than 8 characters', async ({ request }) => {
      await signInAdmin(request);
      const listRes = await request.get('/api/users');
      const listBody = await listRes.json();
      const targetUser = listBody.users.find((u: any) => u.email !== TEST_USERS.admin.email);

      const response = await request.patch(`/api/users/${targetUser.id}`, {
        data: { password: 'short' },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Password must be at least 8 characters');
    });

    test('should return 400 when email is updated to an already registered address', async ({ request }) => {
      await signInAdmin(request);
      const listRes = await request.get('/api/users');
      const listBody = await listRes.json();
      const targetUser = listBody.users.find((u: any) => u.email !== TEST_USERS.admin.email);

      const response = await request.patch(`/api/users/${targetUser.id}`, {
        data: { email: TEST_USERS.admin.email },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('already exists');
    });

    test('should update user name without changing password when password is empty', async ({ request }) => {
      await signInAdmin(request);
      const listRes = await request.get('/api/users');
      const listBody = await listRes.json();
      const agentUser = listBody.users.find((u: any) => u.email === TEST_USERS.agent1.email);

      const response = await request.patch(`/api/users/${agentUser.id}`, {
        data: { name: 'Sarah Connor Updated' },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.user.name).toBe('Sarah Connor Updated');

      // Verify agent can still authenticate with original password
      const loginRes = await request.post('/api/auth/sign-in/email', {
        data: {
          email: TEST_USERS.agent1.email,
          password: TEST_USERS.agent1.password,
        },
      });
      expect(loginRes.status()).toBe(200);
    });

    test('should update password when provided and allow authentication with new password', async ({ request }) => {
      await signInAdmin(request);
      const listRes = await request.get('/api/users');
      const listBody = await listRes.json();
      const agentUser = listBody.users.find((u: any) => u.email === TEST_USERS.agent1.email);

      const newPassword = 'NewSarahPassword2026!';
      const response = await request.patch(`/api/users/${agentUser.id}`, {
        data: {
          name: 'Sarah Connor Re-Updated',
          password: newPassword,
        },
      });
      expect(response.status()).toBe(200);

      // Verify agent can authenticate with NEW password
      const loginRes = await request.post('/api/auth/sign-in/email', {
        data: {
          email: TEST_USERS.agent1.email,
          password: newPassword,
        },
      });
      expect(loginRes.status()).toBe(200);
    });
  });

  describe('DELETE /api/users/:id - Soft Delete User & Admin Protection', () => {
    test('should return 401 Unauthorized when not logged in', async ({ request }) => {
      const response = await request.delete('/api/users/any-id');
      expect(response.status()).toBe(401);
    });

    test('should return 403 Forbidden when logged in as non-admin agent', async ({ request }) => {
      await signInAgent(request);
      const response = await request.delete('/api/users/any-id');
      expect(response.status()).toBe(403);
    });

    test('should return 404 when user does not exist', async ({ request }) => {
      await signInAdmin(request);
      const response = await request.delete('/api/users/non-existent-user-id');
      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('User not found');
    });

    test('should return 400 when attempting to delete an ADMIN account', async ({ request }) => {
      await signInAdmin(request);
      const listRes = await request.get('/api/users');
      const listBody = await listRes.json();
      const adminUser = listBody.users.find((u: any) => u.email === TEST_USERS.admin.email);

      const response = await request.delete(`/api/users/${adminUser.id}`);
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Administrator accounts cannot be deleted');
    });

    test('should soft delete AGENT user (isActive: false) and prevent deactivated user from accessing protected APIs', async ({ request }) => {
      await signInAdmin(request);

      // Create a temporary agent user to delete
      const tempAgent = {
        name: 'Temp Deletable Agent',
        email: 'temp.deletable.agent@ticketai.local',
        password: 'Password123!',
      };

      const createRes = await request.post('/api/users', {
        data: tempAgent,
      });
      expect(createRes.status()).toBe(201);
      const createdUser = (await createRes.json()).user;

      // Soft delete the user
      const deleteRes = await request.delete(`/api/users/${createdUser.id}`);
      expect(deleteRes.status()).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.user.isActive).toBe(false);
      expect(deleteBody.user.deletedAt).toBeDefined();
      expect(deleteBody.message).toContain('deleted');

      // Verify user is removed from user list (checked with deletedAt: null)
      const listRes = await request.get('/api/users');
      const listBody = await listRes.json();
      const found = listBody.users.find((u: any) => u.id === createdUser.id);
      expect(found).toBeUndefined();

      // Verify sign in / auth access is forbidden for deactivated account
      const loginRes = await request.post('/api/auth/sign-in/email', {
        data: {
          email: tempAgent.email,
          password: tempAgent.password,
        },
      });

      // If Better Auth signs in, verify subsequent request to protected route is forbidden (403)
      if (loginRes.status() === 200) {
        const cookies = loginRes.headers()['set-cookie'];
        const meRes = await request.get('/api/me', {
          headers: cookies ? { cookie: cookies } : {},
        });
        expect(meRes.status()).toBe(403);
      }
    });
  });
});
