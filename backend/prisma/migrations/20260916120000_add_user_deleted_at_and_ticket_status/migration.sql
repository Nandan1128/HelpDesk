-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'NEW';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

-- AlterTable: Add deletedAt to user
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex: Add index on user(deletedAt)
CREATE INDEX IF NOT EXISTS "user_deletedAt_idx" ON "user"("deletedAt");

-- AlterTable: Update Ticket default status to NEW
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW';
