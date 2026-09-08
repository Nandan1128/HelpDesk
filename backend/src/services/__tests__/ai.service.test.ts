import { describe, test, expect } from 'bun:test';
import { AIService } from '../ai.service.js';
import { env } from '../../config/env.js';

describe('AIService - Polish Reply Tests', () => {
  test('rejects empty draft with descriptive error', async () => {
    await expect(
      AIService.polishReply({
        draft: '',
      })
    ).rejects.toThrow('Draft text cannot be empty');

    await expect(
      AIService.polishReply({
        draft: '   \n  ',
      })
    ).rejects.toThrow('Draft text cannot be empty');
  });

  test('rejects when GEMINI_API_KEY is missing', async () => {
    await expect(
      AIService.polishReply({
        draft: 'Check the database connection',
        apiKey: '',
      })
    ).rejects.toThrow();
  });

  test('polishes draft reply with Gemini API and ticket context', async () => {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      const result = await AIService.polishReply({
        draft: 'we opened the firewall port for postgres try now',
        ticketContext: {
          ticketNumber: 101,
          subject: 'Cannot connect to database',
          customerName: 'Alex Smith',
          customerEmail: 'alex@example.com',
          category: 'TECHNICAL_QUESTION',
          priority: 'HIGH',
        },
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(10);
      // Result should be polite and contain key technical information
      expect(result.toLowerCase()).toMatch(/alex|port|firewall|postgres|database/);
    }
  });
});

describe('AIService - Summarize Ticket Tests', () => {
  test('rejects when GEMINI_API_KEY is missing', async () => {
    await expect(
      AIService.summarizeTicket({
        subject: 'Cannot login to account',
        apiKey: '',
      })
    ).rejects.toThrow();
  });

  test('summarizes ticket and conversation history', async () => {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      const result = await AIService.summarizeTicket({
        ticketNumber: 42,
        subject: 'Broken payment gateway during checkout',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        category: 'REFUND_REQUEST',
        priority: 'URGENT',
        status: 'OPEN',
        messages: [
          {
            senderType: 'CUSTOMER',
            senderName: 'Jane Doe',
            senderEmail: 'jane@example.com',
            body: 'I tried to pay but got a server error! Did my card get charged?',
          },
          {
            senderType: 'AGENT',
            senderName: 'Sarah Connor',
            senderEmail: 'sarah@ticketai.local',
            body: 'We checked and your card was not charged. The error has been resolved.',
          },
        ],
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(15);
      expect(result.toLowerCase()).toMatch(/card|charge|payment|error|gateway/);
    }
  });
});
