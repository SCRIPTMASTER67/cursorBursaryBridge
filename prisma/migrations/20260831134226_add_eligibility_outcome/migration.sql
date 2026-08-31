-- CreateEnum
CREATE TYPE "EligibilityOutcome" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'PENDING_VERIFICATION');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "eligibilityOutcome" "EligibilityOutcome";

-- CreateIndex
CREATE INDEX "Application_organisationId_eligibilityOutcome_idx" ON "Application"("organisationId", "eligibilityOutcome");
