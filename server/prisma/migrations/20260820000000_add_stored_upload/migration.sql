-- CreateTable
CREATE TABLE "StoredUpload" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredUpload_fileName_key" ON "StoredUpload"("fileName");

-- CreateIndex
CREATE INDEX "StoredUpload_createdAt_idx" ON "StoredUpload"("createdAt");