import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { NavbarPage } from './pages/NavbarPage';
import { seedTestDatabase, TEST_USERS } from './support/db';

test.describe('User Management - Happy Path CRUD Operations (/users)', () => {
  let loginPage: LoginPage;
  let navbarPage: NavbarPage;

  test.beforeEach(async ({ page }) => {
    // Re-seed test database with clean baseline data
    await seedTestDatabase();
    loginPage = new LoginPage(page);
    navbarPage = new NavbarPage(page);

    // Sign in as System Administrator
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
    await expect(page).toHaveURL('/');

    // Navigate to User Management page
    await navbarPage.navigateToUsers();
    await expect(page).toHaveURL('/users');
  });

  test('Create: should successfully create a new user and display in the directory table', async ({ page }) => {
    const table = page.locator('table');
    const createBtn = page.getByTitle('Create new user');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Verify modal appears
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Create New User' })).toBeVisible();

    // Fill valid unique user data
    const timestamp = Date.now();
    const newName = 'Marcus Aurelius';
    const newEmail = `marcus.${timestamp}@ticketai.local`;
    const newPass = 'RomanEmperor2026!';

    await modal.getByLabel(/full name/i).fill(newName);
    await modal.getByLabel(/email address/i).fill(newEmail);
    await modal.getByLabel(/^password$/i).fill(newPass);

    // Submit form
    const submitBtn = modal.locator('button[type="submit"]');
    await expect(submitBtn).toHaveText(/create user/i);
    await submitBtn.click();

    // Modal should close on success
    await expect(modal).not.toBeVisible();

    // User should appear in directory table with correct role and email
    await expect(table.getByText(newName, { exact: true }).first()).toBeVisible();
    await expect(table.getByText(newEmail, { exact: true })).toBeVisible();
    await expect(table.getByText('Support Agent').first()).toBeVisible();
  });

  test('Read: should display user directory with summary metrics, role badges, and search filtering', async ({ page }) => {
    const main = page.locator('main');
    const table = page.locator('table');

    // Verify header and metric summary cards
    await expect(main.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
    await expect(main.getByText('Total Users', { exact: true })).toBeVisible();
    await expect(main.getByText('Support Agents', { exact: true })).toBeVisible();
    await expect(main.getByText('Administrators', { exact: true })).toBeVisible();

    // Verify admin user is listed with correct details
    await expect(table.getByText(TEST_USERS.admin.email, { exact: true }).first()).toBeVisible();
    await expect(table.getByText('Administrator').first()).toBeVisible();

    // Search for admin by email
    const searchInput = page.getByPlaceholder(/search by name or email/i);
    await searchInput.fill(TEST_USERS.admin.email);

    // Matching user should remain visible
    await expect(table.getByText(TEST_USERS.admin.email, { exact: true }).first()).toBeVisible();

    // Clear search and verify restored list
    await page.getByTitle('Clear search').click();
    await expect(table.getByText(TEST_USERS.admin.email, { exact: true }).first()).toBeVisible();
  });

  test('Update: should open edit modal pre-populated, update user name, and reflect in table', async ({ page }) => {
    const table = page.locator('table');
    const timestamp = Date.now();

    // Create a dedicated user to update
    await page.getByTitle('Create new user').click();
    let modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const initialName = `Edit Target ${timestamp}`;
    const email = `edit.target.${timestamp}@ticketai.local`;
    const password = 'TargetPassword123!';

    await modal.getByLabel(/full name/i).fill(initialName);
    await modal.getByLabel(/email address/i).fill(email);
    await modal.getByLabel(/^password$/i).fill(password);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // Find and click the Edit button for the created user
    const editBtn = table.getByTitle(`Edit ${initialName}`);
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify Edit User modal opens pre-populated
    modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Edit User' })).toBeVisible();

    const nameInput = modal.getByLabel(/full name/i);
    const emailInput = modal.getByLabel(/email address/i);

    await expect(nameInput).toHaveValue(initialName);
    await expect(emailInput).toHaveValue(email);

    // Update name and submit
    const updatedName = `${initialName} Updated`;
    await nameInput.fill(updatedName);

    const saveBtn = modal.getByRole('button', { name: /save changes/i });
    await saveBtn.click();

    // Modal should close automatically
    await expect(modal).not.toBeVisible();

    // Verify the updated name appears in table
    await expect(table.getByText(updatedName, { exact: true })).toBeVisible();
    await expect(table.getByText(initialName, { exact: true })).not.toBeVisible();
  });

  test('Delete: should open confirmation modal, soft delete agent, and remove from directory table', async ({ page }) => {
    const table = page.locator('table');
    const timestamp = Date.now();

    // Verify administrator accounts do NOT have a delete button in either desktop or mobile
    const adminDeleteBtn = page.getByTitle(`Delete ${TEST_USERS.admin.name}`);
    await expect(adminDeleteBtn).toHaveCount(0);

    // Create a dedicated user to delete
    await page.getByTitle('Create new user').click();
    let modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const deleteTargetName = `Delete Target ${timestamp}`;
    const email = `delete.target.${timestamp}@ticketai.local`;
    const password = 'DeletePassword123!';

    await modal.getByLabel(/full name/i).fill(deleteTargetName);
    await modal.getByLabel(/email address/i).fill(email);
    await modal.getByLabel(/^password$/i).fill(password);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // Find and click the Delete button for the target user
    const deleteBtn = table.getByTitle(`Delete ${deleteTargetName}`);
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify Delete User confirmation dialog appears
    modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Delete User' })).toBeVisible();
    await expect(modal.getByText(/this action cannot be undone/i)).toBeVisible();
    await expect(modal.getByText(deleteTargetName).first()).toBeVisible();

    // Click Delete User confirmation button
    const confirmBtn = modal.getByRole('button', { name: 'Delete User' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Modal should close automatically
    await expect(modal).not.toBeVisible();

    // Target user should be completely removed from directory listing
    await expect(table.getByText(deleteTargetName, { exact: true })).not.toBeVisible();
    await expect(table.getByText(email, { exact: true })).not.toBeVisible();
  });

  test('Full CRUD Lifecycle: should complete full Create -> Read -> Update -> Delete journey', async ({ page }) => {
    const table = page.locator('table');
    const timestamp = Date.now();

    // 1. CREATE
    const createBtn = page.getByTitle('Create new user');
    await createBtn.click();

    let modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const initialName = `Agent ${timestamp}`;
    const email = `lifecycle.${timestamp}@ticketai.local`;
    const password = 'RebelCaptain2026!';

    await modal.getByLabel(/full name/i).fill(initialName);
    await modal.getByLabel(/email address/i).fill(email);
    await modal.getByLabel(/^password$/i).fill(password);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // 2. READ
    await expect(table.getByText(initialName, { exact: true })).toBeVisible();
    await expect(table.getByText(email, { exact: true })).toBeVisible();

    // 3. UPDATE
    const editBtn = table.getByTitle(`Edit ${initialName}`);
    await editBtn.click();

    modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Edit User' })).toBeVisible();

    const updatedName = `Agent ${timestamp} Updated`;
    await modal.getByLabel(/full name/i).fill(updatedName);
    await modal.getByRole('button', { name: /save changes/i }).click();
    await expect(modal).not.toBeVisible();

    // Verify updated name is rendered
    await expect(table.getByText(updatedName, { exact: true })).toBeVisible();
    await expect(table.getByText(initialName, { exact: true })).not.toBeVisible();

    // 4. DELETE
    const deleteBtn = table.getByTitle(`Delete ${updatedName}`);
    await deleteBtn.click();

    modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Delete User' })).toBeVisible();
    await expect(modal.getByText(/this action cannot be undone/i)).toBeVisible();

    await modal.getByRole('button', { name: 'Delete User' }).click();
    await expect(modal).not.toBeVisible();

    // Verify completely removed from table
    await expect(table.getByText(updatedName, { exact: true })).not.toBeVisible();
    await expect(table.getByText(email, { exact: true })).not.toBeVisible();
  });
});
