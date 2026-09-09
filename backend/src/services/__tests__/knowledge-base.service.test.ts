import { describe, test, expect, afterEach } from 'bun:test';
import { KnowledgeBaseService } from '../knowledge-base.service.js';
import fs from 'fs';
import path from 'path';

describe('KnowledgeBaseService Tests', () => {
  afterEach(() => {
    KnowledgeBaseService.setCustomFilePath(null);
  });

  test('loads official knowledge-base.md successfully', () => {
    const content = KnowledgeBaseService.getContent();
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('Account & Login Issues');
    expect(content).toContain('Refund Policy');
    expect(content).toContain('Escalation Rules');
  });

  test('caches content across multiple calls', () => {
    const first = KnowledgeBaseService.getContent();
    const second = KnowledgeBaseService.getContent();
    expect(first).toBe(second);
  });

  test('supports custom knowledge base path for isolated testing', () => {
    const tempFilePath = path.resolve(process.cwd(), 'temp-kb-test.md');
    fs.writeFileSync(tempFilePath, '# Test Knowledge Base\n\nQ: How to test?\nA: Just run tests.');

    try {
      KnowledgeBaseService.setCustomFilePath(tempFilePath);
      const content = KnowledgeBaseService.getContent();
      expect(content).toContain('Test Knowledge Base');
      expect(content).toContain('Q: How to test?');
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });
});
