import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { NavbarPage } from './pages/NavbarPage';
import { seedTestDatabase, TEST_USERS } from './support/db';

test.describe('User Management - User List Page UI (/users)', () => {
  let loginPage: LoginPage;
  let navbarPage: NavbarPage;

  test.beforeEach(async ({ page }) => {
    await seedTestDatabase();
    loginPage = new LoginPage(page);
    navbarPage = new NavbarPage(page);

    // Sign in as Admin before each UI test
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
    await expect(page).toHaveURL('/');

    // Navigate to /users via navbar
    await navbarPage.navigateToUsers();
    await expect(page).toHaveURL('/users');
  });

  test.describe('Page Structure & Metric Cards', () => {
    test('should display page header, admin badge, and summary metrics', async ({ page }) => {
      const main = page.locator('main');
      await expect(main.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
      await expect(main.getByText('Admin Access Only')).toBeVisible();

      // Verify Summary KPI metric cards
      await expect(main.getByText('Total Users', { exact: true })).toBeVisible();
      await expect(main.getByText('Support Agents', { exact: true })).toBeVisible();
      await expect(main.getByText('Administrators', { exact: true })).toBeVisible();
      await expect(main.getByText('Active Status', { exact: true })).toBeVisible();
    });

    test('should render directory table with all seeded users', async ({ page }) => {
      const table = page.locator('table');

      // Check for user rows
      await expect(table.getByText(TEST_USERS.admin.name, { exact: true })).toBeVisible();
      await expect(table.getByText(TEST_USERS.admin.email, { exact: true })).toBeVisible();

      await expect(table.getByText(TEST_USERS.agent1.name, { exact: true })).toBeVisible();
      await expect(table.getByText(TEST_USERS.agent1.email, { exact: true })).toBeVisible();

      await expect(table.getByText(TEST_USERS.agent2.name, { exact: true })).toBeVisible();
      await expect(table.getByText(TEST_USERS.agent2.email, { exact: true })).toBeVisible();

      // Check for role badges in table
      await expect(table.getByText('Administrator', { exact: true }).first()).toBeVisible();
      await expect(table.getByText('Support Agent', { exact: true }).first()).toBeVisible();
    });
  });

  test.describe('Interactive Search and Filter Controls', () => {
    test('should filter users by search input', async ({ page }) => {
      const table = page.locator('table');
      const searchInput = page.getByPlaceholder(/search by name or email/i);
      await searchInput.fill('Sarah');

      // Only Sarah should be visible in the table
      await expect(table.getByText('Sarah Connor', { exact: true })).toBeVisible();
      await expect(table.getByText(TEST_USERS.admin.name, { exact: true })).not.toBeVisible();
      await expect(table.getByText(TEST_USERS.agent2.name, { exact: true })).not.toBeVisible();

      // Clear search via clear button
      const clearBtn = page.getByTitle('Clear search');
      await clearBtn.click();

      // All users should be restored
      await expect(table.getByText(TEST_USERS.admin.name, { exact: true })).toBeVisible();
      await expect(table.getByText('Sarah Connor', { exact: true })).toBeVisible();
      await expect(table.getByText('Alex Rivera', { exact: true })).toBeVisible();
    });

    test('should filter users by Role tabs', async ({ page }) => {
      const table = page.locator('table');

      // Click "Admins" role filter
      await page.getByRole('button', { name: /admins/i }).click();

      await expect(table.getByText(TEST_USERS.admin.name, { exact: true })).toBeVisible();
      await expect(table.getByText(TEST_USERS.agent1.name, { exact: true })).not.toBeVisible();
      await expect(table.getByText(TEST_USERS.agent2.name, { exact: true })).not.toBeVisible();

      // Click "Agents" role filter
      await page.getByRole('button', { name: /agents/i }).click();

      await expect(table.getByText(TEST_USERS.admin.name, { exact: true })).not.toBeVisible();
      await expect(table.getByText(TEST_USERS.agent1.name, { exact: true })).toBeVisible();
      await expect(table.getByText(TEST_USERS.agent2.name, { exact: true })).toBeVisible();

      // Click "All Roles"
      await page.getByRole('button', { name: /all roles/i }).click();
      await expect(table.getByText(TEST_USERS.admin.name, { exact: true })).toBeVisible();
      await expect(table.getByText(TEST_USERS.agent1.name, { exact: true })).toBeVisible();
      await expect(table.getByText(TEST_USERS.agent2.name, { exact: true })).toBeVisible();
    });

    test('should display empty state when search returns no matches and allow reset', async ({ page }) => {
      const main = page.locator('main');
      const table = page.locator('table');
      const searchInput = page.getByPlaceholder(/search by name or email/i);
      await searchInput.fill('NonExistentUserXYZ');

      await expect(main.getByText('No users found', { exact: true })).toBeVisible();
      await expect(main.getByText(/no users match your current filter/i)).toBeVisible();

      // Click "Clear filters"
      await page.getByRole('button', { name: /clear filters/i }).click();

      // Restored
      await expect(table.getByText(TEST_USERS.admin.name, { exact: true })).toBeVisible();
      await expect(table.getByText(TEST_USERS.agent1.name, { exact: true })).toBeVisible();
    });

    test('should refresh user list when clicking Refresh button', async ({ page }) => {
      const table = page.locator('table');
      const refreshBtn = page.getByRole('button', { name: /refresh/i });
      await expect(refreshBtn).toBeVisible();
      await refreshBtn.click();

      // Verify list remains populated
      await expect(table.getByText(TEST_USERS.admin.name, { exact: true })).toBeVisible();
    });
  });
});
