import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly togglePasswordButton: Locator;
  readonly errorAlert: Locator;
  readonly adminQuickFillButton: Locator;
  readonly agentQuickFillButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email Address');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: /sign in/i });
    this.togglePasswordButton = page.locator('form button[type="button"]');
    this.errorAlert = page.getByRole('alert');
    this.adminQuickFillButton = page.getByRole('button', { name: /admin/i }).filter({ hasText: 'admin@ticketai.local' });
    this.agentQuickFillButton = page.getByRole('button', { name: /agent/i }).filter({ hasText: 'sarah.agent@' });
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async togglePasswordVisibility() {
    await this.togglePasswordButton.click();
  }

  async clickAdminQuickFill() {
    await this.adminQuickFillButton.click();
  }

  async clickAgentQuickFill() {
    await this.agentQuickFillButton.click();
  }
}
