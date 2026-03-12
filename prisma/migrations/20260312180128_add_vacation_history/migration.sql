-- CreateTable
CREATE TABLE "VacationRequestHistory" (
    "id" TEXT NOT NULL,
    "vacationRequestId" TEXT NOT NULL,
    "previousStatus" "VacationStatus" NOT NULL,
    "newStatus" "VacationStatus" NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacationRequestHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VacationRequestHistory" ADD CONSTRAINT "VacationRequestHistory_vacationRequestId_fkey" FOREIGN KEY ("vacationRequestId") REFERENCES "VacationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationRequestHistory" ADD CONSTRAINT "VacationRequestHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
