import { Page, Locator, expect } from '@playwright/test';

export class TicketDetailPage {
  readonly page: Page;

  // Top Nav & Header Details
  readonly backToTicketsButton: Locator;
  readonly ticketNumberBadge: Locator;
  readonly refreshButton: Locator;
  readonly subjectHeading: Locator;
  readonly updateFeedbackAlert: Locator;

  // Badges in Header
  readonly statusBadge: Locator;
  readonly priorityBadge: Locator;
  readonly categoryBadge: Locator;

  // AI Cards
  readonly aiSummaryCard: Locator;
  readonly aiSuggestedReplyCard: Locator;
  readonly useDraftButton: Locator;
  readonly insertDraftButton: Locator;

  // Conversation Thread
  readonly conversationThreadCard: Locator;
  readonly summarizeButton: Locator;
  readonly regenerateSummaryButton: Locator;
  readonly messageCountBadge: Locator;
  readonly messageItems: Locator;

  // Reply Composer
  readonly replyTextarea: Locator;
  readonly polishButton: Locator;
  readonly sendReplyButton: Locator;
  readonly sendAndResolveButton: Locator;
  readonly replySuccessAlert: Locator;
  readonly replyErrorAlert: Locator;

  // Right Panel Controls
  readonly rightPanel: Locator;
  readonly statusOpenButton: Locator;
  readonly statusResolvedButton: Locator;
  readonly statusClosedButton: Locator;
  readonly prioritySelect: Locator;
  readonly categorySelect: Locator;
  readonly assignedAgentSelect: Locator;
  readonly assignToMeButton: Locator;

  // Customer Info & Metadata
  readonly customerEmailLink: Locator;
  readonly copyEmailButton: Locator;
  readonly copyTicketIdButton: Locator;

  // Not Found State
  readonly notFoundContainer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header locators
    this.backToTicketsButton = page.getByRole('link', { name: /back to tickets/i });
    this.ticketNumberBadge = page.locator('[data-slot="badge"]').filter({ hasText: /^#/ });
    this.refreshButton = page.getByRole('button', { name: /refresh/i });
    this.subjectHeading = page.getByTestId('ticket-detail-subject');
    this.updateFeedbackAlert = page.locator('[data-slot="alert"]').filter({ hasText: /ticket updated/i });

    // Header Badges
    this.statusBadge = page.locator('[data-testid="ticket-details-card"] [data-slot="badge"]').first();
    this.priorityBadge = page.locator('[data-testid="ticket-details-card"] [data-slot="badge"]').nth(1);
    this.categoryBadge = page.locator('[data-testid="ticket-details-card"] [data-slot="badge"]').nth(2);

    // AI Cards
    this.aiSummaryCard = page.locator('[data-slot="card"]').filter({ hasText: /AI Conversation Summary/i });
    this.aiSuggestedReplyCard = page.locator('[data-slot="card"]').filter({ hasText: /AI Suggested Reply/i });
    this.useDraftButton = page.getByRole('button', { name: /use this draft/i });
    this.insertDraftButton = page.getByRole('button', { name: /insert ai draft/i });

    // Conversation Thread
    this.conversationThreadCard = page.locator('[data-slot="card"]').filter({ hasText: /Conversation Thread/i });
    this.summarizeButton = page.getByTestId('summarize-ticket-button');
    this.regenerateSummaryButton = page.getByTestId('regenerate-summary-button');
    this.messageCountBadge = this.conversationThreadCard.locator('[data-slot="badge"]').filter({ hasText: /message/i });
    this.messageItems = page.locator('[data-testid^="ticket-message-"]');

    // Reply Composer
    this.replyTextarea = page.getByPlaceholder(/write your response to the customer/i);
    this.polishButton = page.getByRole('button', { name: /polish/i });
    this.sendReplyButton = page.getByRole('button', { name: /^send reply$/i });
    this.sendAndResolveButton = page.getByRole('button', { name: /send & resolve/i });
    this.replySuccessAlert = page.locator('[data-slot="alert"]').filter({ hasText: /reply sent/i });
    this.replyErrorAlert = page.locator('[data-slot="alert"]').filter({ hasText: /failed to send reply/i });

    // Right Panel
    this.rightPanel = page.getByTestId('right-panel-container');
    this.statusOpenButton = this.rightPanel.getByRole('button', { name: /^open$/i });
    this.statusResolvedButton = this.rightPanel.getByRole('button', { name: /^resolved$/i });
    this.statusClosedButton = this.rightPanel.getByRole('button', { name: /^closed$/i });
    this.prioritySelect = this.rightPanel.locator('select').nth(0);
    this.categorySelect = this.rightPanel.locator('select').nth(1);
    this.assignedAgentSelect = this.rightPanel.locator('select').nth(2);
    this.assignToMeButton = this.rightPanel.getByRole('button', { name: /assign to me/i });

    // Customer & Metadata
    this.customerEmailLink = this.rightPanel.locator('a[href^="mailto:"]');
    this.copyEmailButton = this.rightPanel.getByTitle(/copy customer email/i);
    this.copyTicketIdButton = this.rightPanel.getByTitle(/copy ticket id/i);

    // Not Found
    this.notFoundContainer = page.getByTestId('ticket-not-found');
  }

  async goto(ticketId: string | number) {
    await this.page.goto(`/tickets/${ticketId}`);
  }

  async sendReply(message: string) {
    await this.replyTextarea.fill(message);
    await this.sendReplyButton.click();
  }

  async polishReply(draft: string) {
    await this.replyTextarea.fill(draft);
    await this.polishButton.click();
  }

  async summarizeTicket() {
    await this.summarizeButton.click();
  }

  async sendAndResolve(message: string) {
    await this.replyTextarea.fill(message);
    await this.sendAndResolveButton.click();
  }

  async changeStatus(status: 'Open' | 'Resolved' | 'Closed') {
    if (status === 'Open') await this.statusOpenButton.click();
    if (status === 'Resolved') await this.statusResolvedButton.click();
    if (status === 'Closed') await this.statusClosedButton.click();
  }

  async changePriority(priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW') {
    await this.prioritySelect.selectOption(priority);
  }

  async changeCategory(category: 'GENERAL_QUESTION' | 'TECHNICAL_QUESTION' | 'REFUND_REQUEST') {
    await this.categorySelect.selectOption(category);
  }

  async assignToAgent(agentId: string) {
    await this.assignedAgentSelect.selectOption(agentId);
  }
}
