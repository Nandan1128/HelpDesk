import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { NavbarPage } from './pages/NavbarPage';
import { seedTestDatabase, TEST_USERS } from './support/db';

test.describe('Authentication System - Core Flows & Edge Cases', () => {
  let loginPage: LoginPage;
  let navbarPage: NavbarPage;

  test.beforeEach(async ({ page }) => {
    // Reset test database to clean baseline state before each test
    await seedTestDatabase();
    loginPage = new LoginPage(page);
    navbarPage = new NavbarPage(page);
  });

  test.describe('Successful Login Scenarios', () => {
    test('should authenticate Admin user and display Admin navigation & badges', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);

      // Verify redirection to home dashboard
      await expect(page).toHaveURL('/');

      // Verify Navbar identity
      await navbarPage.expectUserIdentity(TEST_USERS.admin.name, 'Admin');
      await navbarPage.expectUsersLinkVisible(true);
    });

    test('should authenticate Support Agent user and hide Admin-only links', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.agent1.email, TEST_USERS.agent1.password);

      // Verify redirection to home dashboard
      await expect(page).toHaveURL('/');

      // Verify Navbar identity
      await navbarPage.expectUserIdentity(TEST_USERS.agent1.name, 'Agent');
      await navbarPage.expectUsersLinkVisible(false);
    });

    test('should trim leading and trailing whitespace from email upon submission', async ({ page }) => {
      await loginPage.goto();
      // Add extra whitespace around email
      await loginPage.login(`   ${TEST_USERS.admin.email}   `, TEST_USERS.admin.password);

      await expect(page).toHaveURL('/');
      await navbarPage.expectUserIdentity(TEST_USERS.admin.name, 'Admin');
    });

    test('should persist authentication session across browser page reloads', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await expect(page).toHaveURL('/');

      // Reload page and verify user session remains intact
      await page.reload();
      await expect(page).toHaveURL('/');
      await navbarPage.expectUserIdentity(TEST_USERS.admin.name, 'Admin');
    });
  });

  test.describe('Form Validation & Client Edge Cases', () => {
    test('should show required validation errors when submitting empty form', async ({ page }) => {
      await loginPage.goto();
      await loginPage.submit();

      await expect(page.getByText('Email address is required')).toBeVisible();
      await expect(page.getByText('Password is required')).toBeVisible();
      await expect(page).toHaveURL('/login');
    });

    test('should show error when email format is invalid', async ({ page }) => {
      await loginPage.goto();
      await loginPage.fillEmail('not-an-email');
      await loginPage.fillPassword('SomePassword123!');
      await loginPage.submit();

      await expect(page.getByText('Please enter a valid email address')).toBeVisible();
      await expect(page).toHaveURL('/login');
    });

    test('should show error when password is less than 8 characters', async ({ page }) => {
      await loginPage.goto();
      await loginPage.fillEmail(TEST_USERS.admin.email);
      await loginPage.fillPassword('short');
      await loginPage.submit();

      await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
      await expect(page).toHaveURL('/login');
    });

    test('should toggle password visibility between password and text input types', async ({ page }) => {
      await loginPage.goto();
      await loginPage.fillPassword('MySecretPass123!');

      // Initially password type
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

      // Click toggle to reveal password
      await loginPage.togglePasswordVisibility();
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');

      // Click toggle again to hide password
      await loginPage.togglePasswordVisibility();
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Failed Authentication & Server Error States', () => {
    test('should display server error alert when user does not exist', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login('nonexistent.user@example.com', 'ValidPassword123!');

      await expect(loginPage.errorAlert).toBeVisible();
      await expect(loginPage.errorAlert).toContainText(/invalid email or password/i);
      await expect(page).toHaveURL('/login');
    });

    test('should display server error alert when password is incorrect', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.admin.email, 'WrongPassword999!');

      await expect(loginPage.errorAlert).toBeVisible();
      await expect(loginPage.errorAlert).toContainText(/invalid email or password/i);
      await expect(page).toHaveURL('/login');
    });

    test('should clear error alert when correcting credentials and logging in successfully', async ({ page }) => {
      await loginPage.goto();
      // First attempt: wrong password
      await loginPage.login(TEST_USERS.admin.email, 'WrongPassword999!');
      await expect(loginPage.errorAlert).toBeVisible();

      // Second attempt: correct password
      await loginPage.fillPassword(TEST_USERS.admin.password);
      await loginPage.submit();

      await expect(page).toHaveURL('/');
      await navbarPage.expectUserIdentity(TEST_USERS.admin.name, 'Admin');
    });
  });

  test.describe('Quick Demo Accounts (Development Feature)', () => {
    test('should populate Admin credentials when clicking Admin quick-fill button', async ({ page }) => {
      await loginPage.goto();
      await loginPage.clickAdminQuickFill();

      await expect(loginPage.emailInput).toHaveValue(TEST_USERS.admin.email);
      await expect(loginPage.passwordInput).toHaveValue(TEST_USERS.admin.password);

      // Submit and verify successful login
      await loginPage.submit();
      await expect(page).toHaveURL('/');
      await navbarPage.expectUserIdentity(TEST_USERS.admin.name, 'Admin');
    });

    test('should populate Agent credentials when clicking Agent quick-fill button', async ({ page }) => {
      await loginPage.goto();
      await loginPage.clickAgentQuickFill();

      await expect(loginPage.emailInput).toHaveValue(TEST_USERS.agent1.email);
      await expect(loginPage.passwordInput).toHaveValue(TEST_USERS.agent1.password);

      // Submit and verify successful login
      await loginPage.submit();
      await expect(page).toHaveURL('/');
      await navbarPage.expectUserIdentity(TEST_USERS.agent1.name, 'Agent');
    });
  });

  test.describe('Sign Out Workflow', () => {
    test('should successfully sign out and prevent subsequent access to protected dashboard', async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await expect(page).toHaveURL('/');

      // Perform sign out
      await navbarPage.signOut();

      // Verify redirected to /login
      await expect(page).toHaveURL('/login');

      // Attempt navigating back to home dashboard
      await page.goto('/');
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
