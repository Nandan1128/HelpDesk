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
