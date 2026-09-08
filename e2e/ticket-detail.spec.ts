import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { seedTestDatabase, TEST_USERS, getTestPrismaClient } from './support/db';

const prisma = getTestPrismaClient();

test.describe('Ticket Detail Page - End-to-End Tests (/tickets/:id)', () => {
  let loginPage: LoginPage;
  let ticketDetailPage: TicketDetailPage;
  let testTicketId: string;
  let testTicketNumber: number;

  test.beforeEach(async ({ page }) => {
    // 1. Seed database with fresh baseline data
    const { agent1 } = await seedTestDatabase();

    // 2. Create a rich test ticket with messages and AI content
    const ticket = await prisma.ticket.create({
      data: {
        subject: 'Cannot connect to PostgreSQL database in staging',
        category: 'TECHNICAL_QUESTION',
        status: 'OPEN',
        priority: 'HIGH',
        customerEmail: 'dev.ops@example.com',
        customerName: 'Devon Ops',
        assignedToId: agent1.id,
        aiSummary: 'Customer experiences connection timeout when attempting to reach PostgreSQL port 5432.',
        aiSuggestedReply: 'Hi Devon, please verify that your security group permits inbound traffic on port 5432.',
        messages: {
          create: [
            {
              senderType: 'CUSTOMER',
              senderEmail: 'dev.ops@example.com',
              senderName: 'Devon Ops',
              body: 'Our staging server keeps timing out connecting to the database.',
            },
            {
              senderType: 'AGENT',
              senderEmail: agent1.email,
              senderName: agent1.name,
              body: 'I am checking the firewall rules now.',
            },
          ],
        },
      },
    });

    testTicketId = ticket.id;
    testTicketNumber = ticket.ticketNumber;

    loginPage = new LoginPage(page);
    ticketDetailPage = new TicketDetailPage(page);

    // 3. Log in as support agent
    await loginPage.goto();
    await loginPage.login(TEST_USERS.agent1.email, TEST_USERS.agent1.password);
    await expect(page).toHaveURL('/');

    // 4. Navigate to the created ticket detail page
    await ticketDetailPage.goto(testTicketId);
    await expect(ticketDetailPage.subjectHeading).toBeVisible();
  });

  test('1. Layout & Header: should render subject, customer info, badges, and back navigation', async ({
    page,
  }) => {
    // Verify subject heading
    await expect(ticketDetailPage.subjectHeading).toHaveText(
      'Cannot connect to PostgreSQL database in staging'
    );

    // Verify ticket number badge in top nav
    await expect(ticketDetailPage.ticketNumberBadge).toBeVisible();
    await expect(ticketDetailPage.ticketNumberBadge).toContainText(String(testTicketNumber));

    // Verify customer info in header
    await expect(page.getByText('Devon Ops (dev.ops@example.com)')).toBeVisible();

    // Verify status, priority, and category badges
    await expect(ticketDetailPage.statusBadge).toContainText('Open');
    await expect(ticketDetailPage.priorityBadge).toContainText('High');
    await expect(ticketDetailPage.categoryBadge).toContainText('Technical Question');

    // Test back button navigation
    await ticketDetailPage.backToTicketsButton.click();
    await expect(page).toHaveURL('/tickets');
  });

  test('2. AI Highlights: should display summary and insert AI suggested reply into composer', async () => {
    // Verify AI Summary card
    await expect(ticketDetailPage.aiSummaryCard).toBeVisible();
    await expect(ticketDetailPage.aiSummaryCard).toContainText(
      'Customer experiences connection timeout when attempting to reach PostgreSQL port 5432.'
    );

    // Verify AI Suggested Reply card
    await expect(ticketDetailPage.aiSuggestedReplyCard).toBeVisible();
    await expect(ticketDetailPage.aiSuggestedReplyCard).toContainText(
      'Hi Devon, please verify that your security group permits inbound traffic on port 5432.'
    );

    // Click "Use This Draft" button
    await ticketDetailPage.useDraftButton.click();

    // Verify textarea populated with suggested reply
    await expect(ticketDetailPage.replyTextarea).toHaveValue(
      'Hi Devon, please verify that your security group permits inbound traffic on port 5432.'
    );
  });

  test('3. Conversation Thread: should render chronological messages with correct roles', async () => {
    // Verify message count
    await expect(ticketDetailPage.messageCountBadge).toContainText('2 messages');

    // Verify message items
    const messages = ticketDetailPage.messageItems;
    await expect(messages).toHaveCount(2);

    // First message (Customer)
    await expect(messages.nth(0)).toContainText('Devon Ops');
    await expect(messages.nth(0)).toContainText('Customer');
    await expect(messages.nth(0)).toContainText(
      'Our staging server keeps timing out connecting to the database.'
    );

    // Second message (Support Agent)
    await expect(messages.nth(1)).toContainText('Sarah Connor');
    await expect(messages.nth(1)).toContainText('Support Agent');
    await expect(messages.nth(1)).toContainText('I am checking the firewall rules now.');
  });

  test('4. Reply Composer: should post new reply and update thread in real time', async () => {
    // Send button should be disabled when textarea is empty
    await expect(ticketDetailPage.sendReplyButton).toBeDisabled();

    // Fill response
    const replyText = 'Security groups have been opened. Please retest the connection.';
    await ticketDetailPage.sendReply(replyText);

    // Verify success alert
    await expect(ticketDetailPage.replySuccessAlert).toBeVisible();
    await expect(ticketDetailPage.replySuccessAlert).toContainText('Reply sent successfully!');

    // Textarea cleared
    await expect(ticketDetailPage.replyTextarea).toHaveValue('');

    // Message list should now have 3 messages
    await expect(ticketDetailPage.messageItems).toHaveCount(3);
    await expect(ticketDetailPage.messageItems.nth(2)).toContainText(replyText);
    await expect(ticketDetailPage.messageCountBadge).toContainText('3 messages');

    // Verify message in database
    const dbMessages = await prisma.message.findMany({
      where: { ticketId: testTicketId },
    });
    expect(dbMessages).toHaveLength(3);
  });

  test('5. Send & Resolve: should append message and resolve ticket in single action', async () => {
    const resolveText = 'Confirmed that the security group rule resolved the issue. Closing ticket.';
    await ticketDetailPage.sendAndResolve(resolveText);

    // Verify success feedback
    await expect(ticketDetailPage.replySuccessAlert).toBeVisible();
    await expect(ticketDetailPage.replySuccessAlert).toContainText(
      'Reply sent and ticket resolved!'
    );

    // Verify status badge changed to Resolved
    await expect(ticketDetailPage.statusBadge).toContainText('Resolved');

    // Verify right panel status button reflects Resolved
    await expect(ticketDetailPage.statusResolvedButton).toHaveClass(/border-primary/);

    // Verify database status updated
    const updated = await prisma.ticket.findUnique({
      where: { id: testTicketId },
    });
    expect(updated?.status).toBe('RESOLVED');
  });

  test('6. Right Panel Controls: should update status, priority, and category', async ({
    page,
  }) => {
    // 1. Change Status to Closed
    await ticketDetailPage.changeStatus('Closed');
    await expect(ticketDetailPage.updateFeedbackAlert).toBeVisible();
    await expect(ticketDetailPage.statusBadge).toContainText('Closed');

    // 2. Change Priority to Urgent
    await ticketDetailPage.changePriority('URGENT');
    await expect(ticketDetailPage.updateFeedbackAlert).toBeVisible();
    await expect(ticketDetailPage.priorityBadge).toContainText('Urgent');

    // 3. Change Category to Refund Request
    await ticketDetailPage.changeCategory('REFUND_REQUEST');
    await expect(ticketDetailPage.updateFeedbackAlert).toBeVisible();
    await expect(ticketDetailPage.categoryBadge).toContainText('Refund Request');

    // Verify in database
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
    });
    expect(dbTicket?.status).toBe('CLOSED');
    expect(dbTicket?.priority).toBe('URGENT');
    expect(dbTicket?.category).toBe('REFUND_REQUEST');
  });

  test('7. Customer Info & Metadata: should display details and allow clipboard copying', async () => {
    // Customer email link with mailto
    await expect(ticketDetailPage.customerEmailLink).toHaveAttribute(
      'href',
      'mailto:dev.ops@example.com'
    );
    await expect(ticketDetailPage.customerEmailLink).toHaveText('dev.ops@example.com');

    // Copy buttons should be interactive
    await expect(ticketDetailPage.copyEmailButton).toBeVisible();
    await expect(ticketDetailPage.copyTicketIdButton).toBeVisible();

    await ticketDetailPage.copyEmailButton.click();
    await ticketDetailPage.copyTicketIdButton.click();
  });

  test('8. Not Found State: should display 404 screen when navigating to non-existent ticket', async ({
    page,
  }) => {
    await ticketDetailPage.goto('non-existent-ticket-9999999');

    // Expect not found container
    await expect(ticketDetailPage.notFoundContainer).toBeVisible();
    await expect(page.getByRole('heading', { name: /ticket not found/i })).toBeVisible();
    await expect(
      page.getByText('The requested ticket does not exist or may have been deleted.')
    ).toBeVisible();

    // Click back to tickets link
    await page.getByRole('link', { name: /back to tickets/i }).click();
    await expect(page).toHaveURL('/tickets');
  });
});
