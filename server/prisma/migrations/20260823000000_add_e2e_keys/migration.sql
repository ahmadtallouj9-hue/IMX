-- AlterTable
-- E2E encryption: public identity keys + per-member wrapped group conversation keys

CREATE TABLE "UserCryptoKey" (
    "userId" TEXT NOT NULL,
    "publicJwk" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCryptoKey_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ConversationKeyShare" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationKeyShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationKeyShare_conversationId_userId_key" ON "ConversationKeyShare"("conversationId", "userId");
CREATE INDEX "ConversationKeyShare_userId_idx" ON "ConversationKeyShare"("userId");
CREATE INDEX "ConversationKeyShare_conversationId_idx" ON "ConversationKeyShare"("conversationId");

ALTER TABLE "UserCryptoKey" ADD CONSTRAINT "UserCryptoKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationKeyShare" ADD CONSTRAINT "ConversationKeyShare_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationKeyShare" ADD CONSTRAINT "ConversationKeyShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
