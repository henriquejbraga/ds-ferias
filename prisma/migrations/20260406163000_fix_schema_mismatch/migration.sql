-- AlterTable
ALTER TABLE "AcquisitionPeriod" ADD COLUMN "isManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "manualUsedDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "unjustifiedAbsences" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'SUGGESTION', 'ELOGIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDENTE', 'RESOLVIDO');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "FeedbackType" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDENTE',
    "message" TEXT NOT NULL,
    "anonymousName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");
CREATE INDEX "Feedback_type_idx" ON "Feedback"("type");
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
