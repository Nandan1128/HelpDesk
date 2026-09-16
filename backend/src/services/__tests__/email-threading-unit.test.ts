import { describe, test, expect } from 'bun:test';
import { EmailIngestionService } from '../email-ingestion.service.js';

describe('Email Threading & Subject Matching - Pure Unit Tests', () => {
  describe('extractTicketNumberFromSubject', () => {
    test('extracts ticket number from various subject formats', () => {
      // Standard bracket with #
      expect(EmailIngestionService.extractTicketNumberFromSubject('Re: [#2] Need help with subscription refund.')).toBe(2);
      expect(EmailIngestionService.extractTicketNumberFromSubject('[#102] Billing question')).toBe(102);

      // Bracket without #
      expect(EmailIngestionService.extractTicketNumberFromSubject('Re: [555] Help with login')).toBe(555);

      // Suffix bracket
      expect(EmailIngestionService.extractTicketNumberFromSubject('Re: Need help with subscription refund [#2]')).toBe(2);
      expect(EmailIngestionService.extractTicketNumberFromSubject('Need help with subscription refund [#2]')).toBe(2);

      // Keyword format (Ticket #123, Case #123)
      expect(EmailIngestionService.extractTicketNumberFromSubject('Ticket #42 - Critical error')).toBe(42);
      expect(EmailIngestionService.extractTicketNumberFromSubject('Case 888: Login problem')).toBe(888);
      expect(EmailIngestionService.extractTicketNumberFromSubject('Support Reply: Ticket #327')).toBe(327);
      expect(EmailIngestionService.extractTicketNumberFromSubject('Re: Support Reply: Ticket #327')).toBe(327);

      // Non-matching subjects
      expect(EmailIngestionService.extractTicketNumberFromSubject('General inquiry without ticket id')).toBeNull();
      expect(EmailIngestionService.extractTicketNumberFromSubject('Re: Need help')).toBeNull();
      expect(EmailIngestionService.extractTicketNumberFromSubject('')).toBeNull();
    });
  });

  describe('cleanBody & quoted text stripping', () => {
    test('strips Gmail reply quote header and historical text', () => {
      const gmailRaw = `The issue is still happening even after reset.

On Wed, Sep 16, 2026 at 7:30 PM TicketAI Support <onboarding@resend.dev> wrote:
> Support Reply: Ticket #2
>
> Hi Nandan,
> To reset your password, please follow these steps...
`;

      const cleaned = EmailIngestionService.cleanBody(gmailRaw, undefined);
      expect(cleaned).toBe('The issue is still happening even after reset.');
    });

    test('strips Outlook format quote headers', () => {
      const outlookRaw = `Still cannot access my dashboard.

-----Original Message-----
From: TicketAI Support <onboarding@resend.dev>
Sent: Wednesday, September 16, 2026 7:30 PM
To: customer@example.com
Subject: Re: [#2] Need help with subscription refund
`;

      const cleaned = EmailIngestionService.cleanBody(outlookRaw, undefined);
      expect(cleaned).toBe('Still cannot access my dashboard.');
    });
  });

  describe('Header Tokenizer Validation', () => {
    test('correctly tokenizes Resend and Gmail In-Reply-To / References headers', () => {
      const resendId = '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794';
      const gmailInReplyTo = `<${resendId}@resend.dev>`;
      const references = `<initial-msg@gmail.com> <${resendId}@resend.dev>`;

      const threadHeaders = [gmailInReplyTo, references].filter(Boolean);
      const candidateTokens = new Set<string>();

      for (const header of threadHeaders) {
        candidateTokens.add(header.trim());
        const angleMatches = header.match(/<([^>]+)>/g);
        if (angleMatches) {
          for (const match of angleMatches) {
            const inner = match.replace(/^<|>$/g, '').trim();
            candidateTokens.add(inner);
            const prefix = inner.split('@')[0];
            if (prefix && prefix.length >= 8) candidateTokens.add(prefix);
          }
        }
        const cleaned = header.replace(/^<|>$/g, '').trim();
        candidateTokens.add(cleaned);
        const prefix = cleaned.split('@')[0];
        if (prefix && prefix.length >= 8) candidateTokens.add(prefix);
      }

      // Verify that raw Resend ID token was extracted
      expect(candidateTokens.has(resendId)).toBe(true);
      expect(candidateTokens.has(`${resendId}@resend.dev`)).toBe(true);
      expect(candidateTokens.has(gmailInReplyTo)).toBe(true);
    });
  });
});
