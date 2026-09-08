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

describe('AIService - Classify Ticket Tests', () => {
  test('rejects when both subject and body are empty', async () => {
    await expect(
      AIService.classifyTicket({
        subject: '',
        body: '',
      })
    ).rejects.toThrow('Ticket subject or body must be provided for classification');

    await expect(
      AIService.classifyTicket({
        subject: '   ',
        body: '  \n  ',
      })
    ).rejects.toThrow('Ticket subject or body must be provided for classification');
  });

  test('rejects when GEMINI_API_KEY is missing', async () => {
    await expect(
      AIService.classifyTicket({
        subject: 'Cannot login to application',
        apiKey: '',
      })
    ).rejects.toThrow();
  });

  test('classifies a technical issue ticket accurately', async () => {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      const result = await AIService.classifyTicket({
        subject: 'Database connection pool exhausted 500 error',
        body: 'Our production API is failing with Error 500: PrismaClientInitializationError: Can not connect to database at localhost:5432.',
        apiKey,
      });

      expect(result.category).toBe('TECHNICAL_QUESTION');
      expect(['HIGH', 'URGENT']).toContain(result.priority);
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(5);
    }
  });

  test('classifies a refund request ticket accurately', async () => {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      const result = await AIService.classifyTicket({
        subject: 'Double charged on my credit card, want refund',
        body: 'I was charged twice for the monthly subscription on September 1st. Please refund the duplicate transaction immediately.',
        apiKey,
      });

      expect(result.category).toBe('REFUND_REQUEST');
      expect(['HIGH', 'URGENT', 'MEDIUM']).toContain(result.priority);
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(5);
    }
  });

  test('classifies a general question ticket accurately', async () => {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      const result = await AIService.classifyTicket({
        subject: 'How do I change my profile avatar?',
        body: 'Hi support team, could you please tell me where I can upload a custom profile image in settings? Thanks!',
        apiKey,
      });

      expect(result.category).toBe('GENERAL_QUESTION');
      expect(['LOW', 'MEDIUM']).toContain(result.priority);
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(5);
    }
  });
});

