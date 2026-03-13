-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'FUNCIONARIO';
ALTER TYPE "Role" ADD VALUE 'COORDENADOR';
ALTER TYPE "Role" ADD VALUE 'GERENTE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VacationStatus" ADD VALUE 'APROVADO_COORDENADOR';
ALTER TYPE "VacationStatus" ADD VALUE 'APROVADO_GERENTE';
ALTER TYPE "VacationStatus" ADD VALUE 'CANCELADO';

-- DropForeignKey
ALTER TABLE "VacationRequestHistory" DROP CONSTRAINT "VacationRequestHistory_vacationRequestId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "department" TEXT,
ADD COLUMN     "hireDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VacationRequest" ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "BlackoutPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "department" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackoutPeriod_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VacationRequestHistory" ADD CONSTRAINT "VacationRequestHistory_vacationRequestId_fkey" FOREIGN KEY ("vacationRequestId") REFERENCES "VacationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlackoutPeriod" ADD CONSTRAINT "BlackoutPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
