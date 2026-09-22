-- CreateEnum
CREATE TYPE "OpportunityOrigin" AS ENUM ('FIRST_PARTY', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "OrganisationOrigin" AS ENUM ('REGISTERED', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('OFFICIAL_ORGANISATION', 'OFFICIAL_INSTITUTION', 'SECONDARY_PUBLICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('OPEN', 'UPCOMING', 'CLOSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'STALE', 'CONFLICTED', 'SOURCE_GONE');

-- CreateEnum
CREATE TYPE "DeadlineKind" AS ENUM ('FIXED', 'ROLLING', 'UNTIL_FILLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "IngestionEventLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- AlterTable
ALTER TABLE "FundingProgramme" ADD COLUMN     "applicationUrl" TEXT,
ADD COLUMN     "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "deadlineKind" "DeadlineKind" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "deadlineNote" TEXT,
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "officialSource" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin" "OpportunityOrigin" NOT NULL DEFAULT 'FIRST_PARTY',
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceType" "SourceType",
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ALTER COLUMN "openDate" DROP NOT NULL,
ALTER COLUMN "closingDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "origin" "OrganisationOrigin" NOT NULL DEFAULT 'REGISTERED',
ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "OpportunitySource" (
    "id" TEXT NOT NULL,
    "fundingProgrammeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "OpportunitySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConflict" (
    "id" TEXT NOT NULL,
    "fundingProgrammeId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "officialValue" TEXT,
    "officialSourceUrl" TEXT,
    "otherValue" TEXT NOT NULL,
    "otherSourceUrl" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationForm" (
    "id" TEXT NOT NULL,
    "fundingProgrammeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "storageKey" TEXT,
    "fileHash" TEXT,
    "official" BOOLEAN NOT NULL DEFAULT true,
    "providedBy" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "sourcesAttempted" INTEGER NOT NULL DEFAULT 0,
    "sourcesSucceeded" INTEGER NOT NULL DEFAULT 0,
    "sourcesBlocked" INTEGER NOT NULL DEFAULT 0,
    "sourcesFailed" INTEGER NOT NULL DEFAULT 0,
    "opportunitiesFound" INTEGER NOT NULL DEFAULT 0,
    "opportunitiesCreated" INTEGER NOT NULL DEFAULT 0,
    "opportunitiesUpdated" INTEGER NOT NULL DEFAULT 0,
    "duplicatesMerged" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" "IngestionEventLevel" NOT NULL DEFAULT 'INFO',
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunitySource_fundingProgrammeId_idx" ON "OpportunitySource"("fundingProgrammeId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySource_fundingProgrammeId_url_key" ON "OpportunitySource"("fundingProgrammeId", "url");

-- CreateIndex
CREATE INDEX "SourceConflict_fundingProgrammeId_idx" ON "SourceConflict"("fundingProgrammeId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationForm_storageKey_key" ON "ApplicationForm"("storageKey");

-- CreateIndex
CREATE INDEX "ApplicationForm_fundingProgrammeId_idx" ON "ApplicationForm"("fundingProgrammeId");

-- CreateIndex
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");

-- CreateIndex
CREATE INDEX "IngestionEvent_runId_createdAt_idx" ON "IngestionEvent"("runId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FundingProgramme_dedupeKey_key" ON "FundingProgramme"("dedupeKey");

-- CreateIndex
CREATE INDEX "FundingProgramme_availability_closingDate_idx" ON "FundingProgramme"("availability", "closingDate");

-- CreateIndex
CREATE INDEX "FundingProgramme_origin_idx" ON "FundingProgramme"("origin");

-- CreateIndex
CREATE INDEX "FundingProgramme_verificationStatus_idx" ON "FundingProgramme"("verificationStatus");

-- AddForeignKey
ALTER TABLE "OpportunitySource" ADD CONSTRAINT "OpportunitySource_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConflict" ADD CONSTRAINT "SourceConflict_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationForm" ADD CONSTRAINT "ApplicationForm_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionEvent" ADD CONSTRAINT "IngestionEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: a programme published here by its own funder is first-party, and
-- Bursary-Bridge is its official source. Availability is derived from the
-- window it already carries rather than assumed to be open.
UPDATE "FundingProgramme"
SET "sourceName" = 'Bursary-Bridge (published by the funder)',
    "sourceType" = 'OFFICIAL_ORGANISATION',
    "officialSource" = true,
    "verificationStatus" = 'VERIFIED',
    "lastVerifiedAt" = "updatedAt",
    "lastCheckedAt" = "updatedAt"
WHERE "origin" = 'FIRST_PARTY';

UPDATE "FundingProgramme"
SET "availability" = CASE
      WHEN "status" <> 'PUBLISHED' THEN 'CLOSED'
      WHEN "closingDate" IS NOT NULL AND "closingDate" < NOW() THEN 'CLOSED'
      WHEN "openDate" IS NOT NULL AND "openDate" > NOW() THEN 'UPCOMING'
      WHEN "openDate" IS NOT NULL AND "closingDate" IS NOT NULL THEN 'OPEN'
      ELSE 'UNKNOWN'
    END::"Availability";
