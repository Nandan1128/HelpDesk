import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { NavbarPage } from './pages/NavbarPage';
import { seedTestDatabase, getTestPrismaClient, TEST_USERS } from './support/db';

test.describe('Authentication System - Route Guards & Access Control', () => {
  let loginPage: LoginPage;
  let navbarPage: NavbarPage;

  test.beforeEach(async ({ page }) => {
    await seedTestDatabase();
    loginPage = new LoginPage(page);
    navbarPage = new NavbarPage(page);
  });

  test.describe('ProtectedRoute Guard', () => {
    test('should redirect unauthenticated visitor from "/" to "/login"', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    });

    test('should redirect unauthenticated visitor from protected deep link and return them upon login', async ({ page }) => {
      // 1. Visit protected admin page while logged out
      await page.goto('/users');
      await expect(page).toHaveURL(/\/login/);

      // 2. Log in as admin
      await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);

      // 3. Verify user is redirected to the originally requested deep link "/users"
      await expect(page).toHaveURL('/users');
      await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    });
  });

  test.describe('AdminRoute Guard', () => {
    test('should allow authenticated Admin user to access "/users"', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await expect(page).toHaveURL('/');

      await page.goto('/users');
      await expect(page).toHaveURL('/users');
      await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    });

    test('should redirect authenticated Support Agent from "/users" to "/" dashboard', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.agent1.email, TEST_USERS.agent1.password);
      await expect(page).toHaveURL('/');

      // Attempt accessing admin-only page
      await page.goto('/users');

      // Verify redirected back to home dashboard
      await expect(page).toHaveURL('/');
      await navbarPage.expectUserIdentity(TEST_USERS.agent1.name, 'Agent');
    });
  });

  test.describe('PublicRoute Guard', () => {
    test('should prevent authenticated Admin from accessing "/login" and redirect to "/"', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await expect(page).toHaveURL('/');

      // Attempt navigating back to /login while active session exists
      await page.goto('/login');
      await expect(page).toHaveURL('/');
      await navbarPage.expectUserIdentity(TEST_USERS.admin.name, 'Admin');
    });

    test('should prevent authenticated Agent from accessing "/login" and redirect to "/"', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.agent1.email, TEST_USERS.agent1.password);
      await expect(page).toHaveURL('/');

      // Attempt navigating back to /login while active session exists
      await page.goto('/login');
      await expect(page).toHaveURL('/');
      await navbarPage.expectUserIdentity(TEST_USERS.agent1.name, 'Agent');
    });
  });

  test.describe('Deactivated Account Handling', () => {
    test('should redirect user to login if their account is deactivated in database', async ({ page }) => {
      const prisma = getTestPrismaClient();

      // Deactivate agent account in database
      await prisma.user.update({
        where: { email: TEST_USERS.agent2.email },
        data: { isActive: false },
      });

      await loginPage.goto();
      await loginPage.login(TEST_USERS.agent2.email, TEST_USERS.agent2.password);

      // Verify route guard redirects deactivated account to /login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
