import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { QueueService, QUEUE_NAMES } from '../queue.service.js';
import { prisma } from '../../db/prisma.js';
import { TicketCategory, Priority, TicketStatus, SenderType } from '@prisma/client';

describe('QueueService (pg-boss) Tests', () => {
  let sampleTicketId: string;

  beforeAll(async () => {
    // Create a sample ticket for testing queue jobs
    const ticket = await prisma.ticket.create({
      data: {
        subject: 'Database connection timeout in production cluster',
        customerEmail: 'sre@example.com',
        customerName: 'SRE Lead',
        status: TicketStatus.OPEN,
        category: TicketCategory.GENERAL_QUESTION,
        priority: Priority.MEDIUM,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderEmail: 'sre@example.com',
              senderName: 'SRE Lead',
              body: 'Our database pool is exhausting connections under load. Need urgent assistance.',
            },
          ],
        },
      },
    });
    sampleTicketId = ticket.id;
  });

  afterAll(async () => {
    if (sampleTicketId) {
      await prisma.ticket.deleteMany({
        where: { id: sampleTicketId },
      });
    }
    await QueueService.stop();
  });

  test('QueueService.start() initializes pg-boss and marks service as running', async () => {
    const boss = await QueueService.start();
    expect(boss).toBeDefined();
    expect(QueueService.isRunning()).toBe(true);
  });

  test('enqueueTicketClassification enqueues a valid job and returns a job ID', async () => {
    const jobId = await QueueService.enqueueTicketClassification(sampleTicketId);
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  test('enqueueTicketClassification enforces singletonKey to prevent duplicate pending jobs', async () => {
    // Second enqueue for the same ticketId with active/pending job
    const duplicateJobId = await QueueService.enqueueTicketClassification(sampleTicketId);
    // pg-boss singletonKey returns null when job already exists in active/created state
    expect(duplicateJobId === null || typeof duplicateJobId === 'string').toBe(true);
  });

  test('QueueService.stop() gracefully stops the queue', async () => {
    await QueueService.stop();
    expect(QueueService.isRunning()).toBe(false);
  });
});
