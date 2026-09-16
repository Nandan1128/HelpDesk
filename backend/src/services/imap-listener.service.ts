import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { env } from '../config/env.js';
import { captureServiceError } from '../config/sentry.js';
import { EmailIngestionService } from './email-ingestion.service.js';
import { EmailService } from './email.service.js';

export interface ProcessedEmailSummary {
  uid: number;
  from: string;
  subject: string;
  action: 'created_ticket' | 'appended_message' | 'skipped' | 'error';
  ticketNumber?: number;
  reason?: string;
  error?: string;
}

export class ImapListenerService {
  private static isRunning = false;
  private static isPollingActive = false;
  private static pollTimer: NodeJS.Timeout | null = null;
  // Ignore emails older than when the service booted (with 10 min grace period)
  public static startTime: Date = new Date(Date.now() - 10 * 60 * 1000);

  /**
   * Creates an ImapFlow client instance.
   */
  public static createClient(): ImapFlow | null {
    if (!env.EMAIL_USER || !env.EMAIL_PASS) {
      console.warn('⚠️ [ImapListener] EMAIL_USER or EMAIL_PASS missing. IMAP listener disabled.');
      return null;
    }

    return new ImapFlow({
      host: env.IMAP_HOST,
      port: env.IMAP_PORT,
      secure: env.IMAP_SECURE,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
      logger: false,
    });
  }

  /**
   * Identifies whether an email is an automated notification, newsletter, or spam.
   */
  private static isAutomatedOrMarketing(parsed: ParsedMail, senderAddress: string): { isMarketing: boolean; reason?: string } {
    const ownEmail = (env.EMAIL_USER || env.SUPPORT_EMAIL).toLowerCase();
    if (senderAddress === ownEmail) {
      return { isMarketing: true, reason: 'Self-sent email' };
    }

    if (
      senderAddress.includes('mailer-daemon') ||
      senderAddress.includes('postmaster') ||
      senderAddress.includes('no-reply') ||
      senderAddress.includes('noreply') ||
      senderAddress.includes('donotreply')
    ) {
      return { isMarketing: true, reason: 'System / No-reply sender' };
    }

    // Check automated / newsletter headers
    const listUnsubscribe = parsed.headers.get('list-unsubscribe');
    const listId = parsed.headers.get('list-id');
    const precedence = String(parsed.headers.get('precedence') || '').toLowerCase();
    const autoSubmitted = String(parsed.headers.get('auto-submitted') || '').toLowerCase();

    if (listUnsubscribe || listId) {
      return { isMarketing: true, reason: 'Mailing list / Newsletter header present' };
    }

    if (precedence === 'bulk' || precedence === 'junk' || precedence === 'list') {
      return { isMarketing: true, reason: 'Bulk / marketing precedence' };
    }

    if (autoSubmitted === 'auto-generated' || autoSubmitted === 'auto-replied') {
      return { isMarketing: true, reason: 'Auto-generated email' };
    }

    // Ignore known marketing domains
    const marketingDomains = [
      'flipkart.com',
      'pinterest.com',
      'grammarly.com',
      'tcs.com',
      'tcsion.com',
      'docker.com',
      'openai.com',
      'google.com',
      'twilio.com',
      'vercel.com',
      'loopcv.com',
    ];

    if (marketingDomains.some((d) => senderAddress.endsWith(d))) {
      return { isMarketing: true, reason: `Known marketing/service domain (${senderAddress})` };
    }

    return { isMarketing: false };
  }

  /**
   * Polls the Gmail / IMAP inbox once for unseen emails and ingests them into the ticket system.
   */
  public static async pollOnce(): Promise<ProcessedEmailSummary[]> {
    if (this.isPollingActive) {
      return [];
    }

    this.isPollingActive = true;
    const client = this.createClient();
    if (!client) {
      this.isPollingActive = false;
      return [];
    }

    const results: ProcessedEmailSummary[] = [];

    interface RawFetchedEmail {
      uid: number;
      source: Buffer;
    }

    const rawEmails: RawFetchedEmail[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        // Search for unseen emails
        const unseenUids = await client.search({ seen: false }, { uid: true });

        if (Array.isArray(unseenUids) && unseenUids.length > 0) {
          // Process recent unread emails (up to 15 at a time)
          const targetUids = unseenUids.slice(-15);

          for (const uid of targetUids) {
            try {
              const downloadRes = await client.download(uid, undefined, { uid: true });
              if (downloadRes && downloadRes.content) {
                // Drain stream to Buffer immediately
                const chunks: Buffer[] = [];
                for await (const chunk of downloadRes.content) {
                  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                const buffer = Buffer.concat(chunks);

                rawEmails.push({
                  uid,
                  source: buffer,
                });

                // Mark message as seen in Gmail inbox
                await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
              }
            } catch (dlErr) {
              console.warn(`⚠️ [ImapListener] Could not download message UID ${uid}:`, dlErr);
            }
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err: any) {
      console.error('❌ [ImapListener] IMAP connection or fetching error:', err);
      try {
        await client.logout();
      } catch {
        // ignore logout errors
      }
    } finally {
      this.isPollingActive = false;
    }

    if (rawEmails.length === 0) {
      return results;
    }

    // Process collected emails outside of the IMAP connection lock
    for (const raw of rawEmails) {
      const uid = raw.uid;
      let parsed: ParsedMail;

      try {
        parsed = await simpleParser(raw.source);
      } catch (parseErr: any) {
        console.error(`❌ [ImapListener] Failed to parse email (UID: ${uid}):`, parseErr);
        results.push({
          uid,
          from: 'unknown',
          subject: 'unknown',
          action: 'error',
          error: `Parse error: ${parseErr.message}`,
        });
        continue;
      }

      const senderAddress = parsed.from?.value?.[0]?.address?.toLowerCase().trim() || '';
      const senderName = parsed.from?.value?.[0]?.name || senderAddress.split('@')[0] || 'Customer';
      const recipientAddress = Array.isArray(parsed.to)
        ? parsed.to.map((t) => t.text).join(', ')
        : parsed.to?.text || env.EMAIL_USER;
      const subject = parsed.subject?.trim() || '(No Subject)';
      const body = parsed.text?.trim() || '';
      const html = typeof parsed.html === 'string' ? parsed.html : (parsed.textAsHtml || undefined);
      const messageId = parsed.messageId?.trim();
      const inReplyTo = parsed.inReplyTo?.trim();
      const emailDate = parsed.date ? new Date(parsed.date) : new Date();

      // Filter 1: Check if this email is an automated newsletter/promotion
      const check = this.isAutomatedOrMarketing(parsed, senderAddress);
      if (check.isMarketing) {
        console.log(`ℹ️ [ImapListener] Skipping promotional/automated email from "${senderAddress}" (${check.reason}): "${subject}"`);
        results.push({
          uid,
          from: senderAddress,
          subject,
          action: 'skipped',
          reason: check.reason,
        });
        continue;
      }

      // Filter 2: Ignore old emails received before service start
      if (emailDate < this.startTime) {
        console.log(`ℹ️ [ImapListener] Skipping historical email from ${emailDate.toISOString()} (before startup time): "${subject}"`);
        results.push({
          uid,
          from: senderAddress,
          subject,
          action: 'skipped',
          reason: 'Historical email received before service start',
        });
        continue;
      }

      console.log(`\n📬 [ImapListener] New valid customer email from "${senderName}" <${senderAddress}>: "${subject}"`);

      try {
        const ingestionResult = await EmailIngestionService.processInboundEmail({
          from: senderAddress,
          fromName: senderName,
          to: recipientAddress,
          subject,
          body: body || undefined,
          html: html || undefined,
          messageId,
          inReplyTo,
        });

        console.log(
          `🎟️ [ImapListener] Successfully ${ingestionResult.action} for Ticket #${ingestionResult.ticket.ticketNumber} (Status: ${ingestionResult.ticket.status})`
        );

        results.push({
          uid,
          from: senderAddress,
          subject,
          action: ingestionResult.action,
          ticketNumber: ingestionResult.ticket.ticketNumber,
        });
      } catch (ingestErr: any) {
        console.error(`❌ [ImapListener] Ingestion failed for email from ${senderAddress}:`, ingestErr);
        captureServiceError(ingestErr, {
          service: 'imap-listener',
          action: 'process-inbound-email',
          extra: { sender: senderAddress, subject, uid },
        });
        results.push({
          uid,
          from: senderAddress,
          subject,
          action: 'error',
          error: ingestErr?.message || 'Ingestion failed',
        });
      }
    }

    return results;
  }

  /**
   * Starts background continuous polling.
   */
  public static start(): void {
    if (!env.IMAP_ENABLED) {
      console.log('ℹ️ [ImapListener] IMAP_ENABLED is false. Background email polling is disabled.');
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startTime = new Date(Date.now() - 10 * 60 * 1000); // Only process emails from last 10 mins onwards
    const intervalMs = Math.max(10, env.IMAP_POLL_INTERVAL_SEC) * 1000;
    console.log(`🚀 [ImapListener] Starting Gmail IMAP polling service (every ${env.IMAP_POLL_INTERVAL_SEC}s)...`);

    // Immediate initial poll
    this.pollOnce().catch((err) => {
      console.error('[ImapListener] Initial poll error:', err);
      captureServiceError(err, { service: 'imap-listener', action: 'initial-poll' });
    });

    // Periodic loop
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.pollOnce();
      } catch (err) {
        console.error('[ImapListener] Interval poll error:', err);
        captureServiceError(err, { service: 'imap-listener', action: 'interval-poll' });
      }
    }, intervalMs);
  }

  /**
   * Stops background polling.
   */
  public static stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('🛑 [ImapListener] Stopped email polling service.');
  }
}
