import { Page, Locator, expect } from '@playwright/test';

export class NavbarPage {
  readonly page: Page;
  readonly brandLink: Locator;
  readonly dashboardLink: Locator;
  readonly usersLink: Locator;
  readonly ticketsLink: Locator;
  readonly userChip: Locator;
  readonly signOutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.brandLink = page.getByRole('link', { name: /TicketAI/i });
    this.dashboardLink = page.getByRole('link', { name: /dashboard/i });
    this.usersLink = page.getByRole('link', { name: /users/i });
    this.ticketsLink = page.getByRole('link', { name: /tickets/i });
    this.userChip = page.locator('header').locator('div.rounded-full');
    this.signOutButton = page.getByRole('button', { name: /sign out/i });
  }

  async signOut() {
    await this.signOutButton.click();
    await expect(this.page).toHaveURL('/login');
  }

  async expectUserIdentity(name: string, role: 'Admin' | 'Agent') {
    const header = this.page.locator('header');
    await expect(header.getByText(name, { exact: true })).toBeVisible();
    await expect(header.getByText(role, { exact: true })).toBeVisible();
  }

  async expectUsersLinkVisible(visible: boolean) {
    if (visible) {
      await expect(this.usersLink).toBeVisible();
    } else {
      await expect(this.usersLink).not.toBeVisible();
    }
  }

  async navigateToUsers() {
    await this.usersLink.click();
    await expect(this.page).toHaveURL('/users');
  }

  async navigateToTickets() {
    await this.ticketsLink.click();
    await expect(this.page).toHaveURL('/tickets');
  }
}
