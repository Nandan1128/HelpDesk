import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { NavbarPage } from './pages/NavbarPage';
import { seedTestDatabase, TEST_USERS, getTestPrismaClient } from './support/db';

const prisma = getTestPrismaClient();

test.describe('Ticket List Feature - Newest First & Queue Management (/tickets)', () => {
  let loginPage: LoginPage;
  let navbarPage: NavbarPage;

  test.beforeEach(async ({ page }) => {
    // 1. Re-seed test database with clean baseline data
    await seedTestDatabase();

    // 2. Seed distinct tickets with staggered dates and different statuses
    const now = Date.now();
    await prisma.ticket.create({
      data: {
        subject: 'Billing discrepancy for Q3 invoice',
        category: 'REFUND_REQUEST',
        status: 'RESOLVED',
        priority: 'HIGH',
        customerEmail: 'billing.client@example.com',
        customerName: 'Billing Client',
        createdAt: new Date(now - 100000), // Older ticket
      },
    });

    await prisma.ticket.create({
      data: {
        subject: 'Urgent system crash on login',
        category: 'TECHNICAL_QUESTION',
        status: 'OPEN',
        priority: 'URGENT',
        customerEmail: 'urgent.user@example.com',
        customerName: 'Urgent User',
        createdAt: new Date(now + 50000), // Newest ticket
      },
    });

    loginPage = new LoginPage(page);
    navbarPage = new NavbarPage(page);

    // 3. Sign in as Support Agent
    await loginPage.goto();
    await loginPage.login(TEST_USERS.agent1.email, TEST_USERS.agent1.password);
    await expect(page).toHaveURL('/');

    // 4. Navigate to Tickets page via navbar
    await navbarPage.navigateToTickets();
    await expect(page).toHaveURL('/tickets');
  });

  test('Page Layout: should display heading, newest-first badge, and KPI metrics', async ({
    page,
  }) => {
    // 1. Heading & description
    await expect(page.getByRole('heading', { level: 1, name: /Support Tickets/i })).toBeVisible();
    await expect(page.getByText('Sorted by Newest First')).toBeVisible();

    // 2. Metrics summary cards (target paragraph elements to avoid strict mode collisions with filter buttons)
    await expect(page.getByRole('paragraph').filter({ hasText: 'Total Tickets' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Open Tickets' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'High & Urgent' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Resolved' })).toBeVisible();
  });

  test('Newest First Sorting: should render tickets sorted with newest first by default', async ({
    page,
  }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible();

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

    // Fetch the tickets directly from test database to compare ordered createdAt
    const dbTickets = await prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    // The first row's subject should match the newest ticket in db
    const firstRowText = await rows.nth(0).innerText();
    expect(firstRowText).toContain(dbTickets[0].subject);
  });

  test('Search: should filter tickets in real time by subject and clear query', async ({
    page,
  }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible();

    const searchInput = page.getByPlaceholder(/search by subject/i);
    await expect(searchInput).toBeVisible();

    // Type a specific query matching our seeded billing ticket
    await searchInput.fill('Billing');
    await page.waitForTimeout(500); // debounce wait

    const filteredRows = table.locator('tbody tr');
    const filteredCount = await filteredRows.count();
    expect(filteredCount).toBe(1);

    const matchText = await filteredRows.first().innerText();
    expect(matchText).toContain('Billing');

    // Clear search using clear button
    const clearBtn = page.getByTitle('Clear search');
    await clearBtn.click();
    await page.waitForTimeout(400);

    const restoredRows = table.locator('tbody tr');
    expect(await restoredRows.count()).toBeGreaterThan(filteredCount);
  });

  test('Status Filtering: should filter tickets by clicking status filter tabs', async ({
    page,
  }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // 1. Click "Resolved" filter button
    const resolvedTab = page.getByRole('button', { name: /^Resolved$/i });
    await resolvedTab.click();
    await page.waitForTimeout(400);

    const resolvedRows = table.locator('tbody tr');
    const resolvedCount = await resolvedRows.count();
    expect(resolvedCount).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < resolvedCount; i++) {
      const rowText = await resolvedRows.nth(i).innerText();
      expect(rowText).toContain('Resolved');
    }

    // 2. Click "Open" filter button
    const openTab = page.getByRole('button', { name: /^Open$/i });
    await openTab.click();
    await page.waitForTimeout(400);

    const openRows = table.locator('tbody tr');
    const openCount = await openRows.count();
    expect(openCount).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < openCount; i++) {
      const rowText = await openRows.nth(i).innerText();
      expect(rowText).toContain('Open');
    }

    // 3. Return to "All"
    const allTab = page.getByRole('button', { name: /^All$/i });
    await allTab.click();
    await page.waitForTimeout(400);

    expect(await table.locator('tbody tr').count()).toBeGreaterThanOrEqual(openCount);
  });

  test('Sorting Toggle: should allow toggling sort direction via Created column header', async ({
    page,
  }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible();

    const initialFirstRow = await table.locator('tbody tr').first().innerText();

    // Click "Created" header button to toggle from DESC (newest) to ASC (oldest)
    const createdHeader = page.getByRole('button', { name: /Created/i });
    await createdHeader.click();
    await page.waitForTimeout(500);

    const reversedFirstRow = await table.locator('tbody tr').first().innerText();
    // With distinct tickets, oldest and newest are different tickets
    expect(reversedFirstRow).not.toBe(initialFirstRow);

    // Click "Created" again to toggle back to DESC (newest first)
    await createdHeader.click();
    await page.waitForTimeout(500);

    const restoredFirstRow = await table.locator('tbody tr').first().innerText();
    expect(restoredFirstRow).toBe(initialFirstRow);
  });
});
