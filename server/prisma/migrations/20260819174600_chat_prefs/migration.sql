-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN "muted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ConversationMember" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'cove';
ALTER TABLE "ConversationMember" ADD COLUMN "backgroundUrl" TEXT;
