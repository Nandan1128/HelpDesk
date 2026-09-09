import { PgBoss, QueueOptions } from 'pg-boss';
import { env } from '../config/env.js';

export const QUEUE_NAMES = {
  CLASSIFY_TICKET: 'classify-ticket',
} as const;

export interface ClassifyTicketJobPayload {
  ticketId: string;
  apiKey?: string;
  modelName?: string;
}

export class QueueService {
  private static boss: PgBoss | null = null;
  private static isStarted = false;
  private static startPromise: Promise<PgBoss> | null = null;

  /**
   * Returns or initializes the singleton PgBoss instance.
   * If not already started, starts PgBoss, ensures queues are created, and registers workers.
   */
  static async getBoss(): Promise<PgBoss> {
    if (!this.boss) {
      this.boss = new PgBoss({
        connectionString: env.DATABASE_URL,
      });

      this.boss.on('error', (err: unknown) => {
        console.error('[pg-boss Queue Error]:', err);
      });
    }

    if (!this.isStarted) {
      if (!this.startPromise) {
        this.startPromise = (async () => {
          await this.boss!.start();
          this.isStarted = true;
          await this.initializeQueuesAndWorkers(this.boss!);
          console.log('⚡ [pg-boss] Background queue service started successfully');
          return this.boss!;
        })();
      }
      await this.startPromise;
    }

    return this.boss;
  }

  /**
   * Initializes all queues and attaches job workers.
   */
  private static async initializeQueuesAndWorkers(boss: PgBoss): Promise<void> {
    const queueOptions: QueueOptions = {
      retryLimit: 3,
      retryDelay: 10,
      retryBackoff: true,
      expireInSeconds: 120,
    };

    // 1. Create ticket classification queue idempotently
    await boss.createQueue(QUEUE_NAMES.CLASSIFY_TICKET, queueOptions);

    // 2. Register ticket classification worker
    await boss.work<ClassifyTicketJobPayload>(
      QUEUE_NAMES.CLASSIFY_TICKET,
      {
        batchSize: 1,
        localConcurrency: 2,
      },
      async (jobs) => {
        const { AutoResolveService } = await import('./auto-resolve.service.js');
        for (const job of jobs) {
          const { ticketId, apiKey, modelName } = job.data;
          console.log(`[pg-boss Worker] Processing ticket arrival & auto-resolution for ticket ${ticketId} (Job: ${job.id})`);
          try {
            const result = await AutoResolveService.processTicket(ticketId, {
              apiKey,
              modelName,
            });
            if (result) {
              console.log(
                `[pg-boss Worker] Successfully processed ticket #${result.ticket.ticketNumber} -> Status: ${result.ticket.status}, Category: ${result.ticket.category}, Priority: ${result.ticket.priority}`
              );
            }
          } catch (error) {
            console.error(
              `[pg-boss Worker] Ticket processing failed for ticket ${ticketId} (Job: ${job.id}):`,
              error
            );
            // Rethrow so pg-boss records job failure and handles retries according to policy
            throw error;
          }
        }
      }
    );
  }

  /**
   * Starts the pg-boss background queue service and registers all workers.
   */
  static async start(): Promise<PgBoss> {
    return this.getBoss();
  }

  /**
   * Enqueues a ticket classification job into pg-boss.
   * Uses singletonKey to prevent duplicate jobs for the same ticket while a job is pending/active.
   */
  static async enqueueTicketClassification(
    ticketId: string,
    options?: { apiKey?: string; modelName?: string }
  ): Promise<string | null> {
    try {
      const boss = await this.getBoss();
      const payload: ClassifyTicketJobPayload = {
        ticketId,
        apiKey: options?.apiKey,
        modelName: options?.modelName,
      };

      const jobId = await boss.send(QUEUE_NAMES.CLASSIFY_TICKET, payload, {
        singletonKey: ticketId,
        retryLimit: 3,
        retryDelay: 10,
        retryBackoff: true,
        expireInSeconds: 120,
      });

      console.log(`[pg-boss] Enqueued classification job for ticket ${ticketId} (Job ID: ${jobId || 'duplicate-skipped'})`);
      return jobId;
    } catch (error) {
      console.error(`[pg-boss] Failed to enqueue classification job for ticket ${ticketId}:`, error);
      throw error;
    }
  }

  /**
   * Gracefully shuts down pg-boss, waiting for in-flight jobs to complete.
   */
  static async stop(): Promise<void> {
    if (this.boss && this.isStarted) {
      console.log('🛑 [pg-boss] Stopping background job queue...');
      await this.boss.stop({ graceful: true, timeout: 5000 });
      this.boss = null;
      this.isStarted = false;
      this.startPromise = null;
      console.log('✅ [pg-boss] Background job queue stopped.');
    }
  }

  /**
   * Returns whether the queue service is currently running.
   */
  static isRunning(): boolean {
    return this.isStarted;
  }
}
