-- CreateEnum
CREATE TYPE "CatalogueStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SubjectLevel" AS ENUM ('SCHOOL', 'TERTIARY');

-- CreateEnum
CREATE TYPE "ResultKind" AS ENUM ('CURRENT', 'FINAL', 'PREDICTED', 'LATEST');

-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('DRAFT', 'READY');

-- CreateEnum
CREATE TYPE "InformationRequestStatus" AS ENUM ('OPEN', 'RESPONDED', 'CANCELLED');

-- AlterEnum
-- PostgreSQL will not let a new enum value be used in the same transaction it
-- was added in. Nothing below uses it, so adding it here is safe.
ALTER TYPE "Availability" ADD VALUE IF NOT EXISTS 'CLOSING_SOON';

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "canonicalName" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "status" "CatalogueStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Programme" ADD COLUMN     "canonicalName" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "status" "CatalogueStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ProgrammeInstitution" (
    "programmeId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgrammeInstitution_pkey" PRIMARY KEY ("programmeId","institutionId")
);

-- CreateTable
CREATE TABLE "SubjectCatalogue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "level" "SubjectLevel" NOT NULL,
    "status" "CatalogueStatus" NOT NULL DEFAULT 'ACTIVE',
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectCatalogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSubjectResult" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "percentage" INTEGER,
    "grade" TEXT,
    "year" INTEGER NOT NULL,
    "term" TEXT,
    "kind" "ResultKind" NOT NULL DEFAULT 'LATEST',
    "level" "SubjectLevel" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSubjectResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilitySubjectRequirement" (
    "id" TEXT NOT NULL,
    "eligibilityRuleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "minimumPercentage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilitySubjectRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivationalLetter" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "fundingProgrammeId" TEXT,
    "opportunityName" TEXT NOT NULL,
    "organisationName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "LetterStatus" NOT NULL DEFAULT 'DRAFT',
    "answers" JSONB,
    "generator" TEXT,
    "editedByStudent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotivationalLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InformationRequest" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "message" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "InformationRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "InformationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InformationRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "documentType" "DocumentType",
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "InformationRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgrammeInstitution_institutionId_idx" ON "ProgrammeInstitution"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectCatalogue_canonicalName_key" ON "SubjectCatalogue"("canonicalName");

-- CreateIndex
CREATE INDEX "SubjectCatalogue_level_status_idx" ON "SubjectCatalogue"("level", "status");

-- CreateIndex
CREATE INDEX "StudentSubjectResult_studentProfileId_position_idx" ON "StudentSubjectResult"("studentProfileId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubjectResult_studentProfileId_subjectId_year_key" ON "StudentSubjectResult"("studentProfileId", "subjectId", "year");

-- CreateIndex
CREATE INDEX "EligibilitySubjectRequirement_subjectId_idx" ON "EligibilitySubjectRequirement"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilitySubjectRequirement_eligibilityRuleId_subjectId_key" ON "EligibilitySubjectRequirement"("eligibilityRuleId", "subjectId");

-- CreateIndex
CREATE INDEX "MotivationalLetter_studentProfileId_updatedAt_idx" ON "MotivationalLetter"("studentProfileId", "updatedAt");

-- CreateIndex
CREATE INDEX "InformationRequest_applicationId_createdAt_idx" ON "InformationRequest"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "InformationRequest_organisationId_status_idx" ON "InformationRequest"("organisationId", "status");

-- CreateIndex
CREATE INDEX "InformationRequestItem_requestId_idx" ON "InformationRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "InformationRequestItem_documentId_idx" ON "InformationRequestItem"("documentId");


-- Backfill the canonical names from what is already in the catalogue, using
-- the same normalisation the application applies: lower case, punctuation
-- removed, whitespace collapsed.
UPDATE "Institution"
SET "canonicalName" = trim(regexp_replace(lower(regexp_replace("name", '[^a-zA-Z0-9]+', ' ', 'g')), '\\s+', ' ', 'g'))
WHERE "canonicalName" IS NULL;

UPDATE "Programme"
SET "canonicalName" = trim(regexp_replace(lower(regexp_replace("name", '[^a-zA-Z0-9]+', ' ', 'g')), '\\s+', ' ', 'g'))
WHERE "canonicalName" IS NULL;

-- Any collision here means the catalogue already held two spellings of one
-- thing. Fail loudly rather than picking a winner silently.
DO $$
DECLARE clashes int;
BEGIN
  SELECT count(*) INTO clashes FROM (
    SELECT "canonicalName" FROM "Institution" GROUP BY 1 HAVING count(*) > 1
  ) x;
  IF clashes > 0 THEN
    RAISE EXCEPTION 'Duplicate institution names differing only in punctuation or case: % group(s). Resolve them before migrating.', clashes;
  END IF;
  SELECT count(*) INTO clashes FROM (
    SELECT "canonicalName" FROM "Programme" GROUP BY 1 HAVING count(*) > 1
  ) x;
  IF clashes > 0 THEN
    RAISE EXCEPTION 'Duplicate course names differing only in punctuation or case: % group(s). Resolve them before migrating.', clashes;
  END IF;
END $$;

ALTER TABLE "Institution" ALTER COLUMN "canonicalName" SET NOT NULL;
ALTER TABLE "Programme" ALTER COLUMN "canonicalName" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Institution_canonicalName_key" ON "Institution"("canonicalName");

-- CreateIndex
CREATE INDEX "Institution_status_idx" ON "Institution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_canonicalName_key" ON "Programme"("canonicalName");

-- CreateIndex
CREATE INDEX "Programme_status_idx" ON "Programme"("status");

-- AddForeignKey
ALTER TABLE "ProgrammeInstitution" ADD CONSTRAINT "ProgrammeInstitution_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeInstitution" ADD CONSTRAINT "ProgrammeInstitution_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubjectResult" ADD CONSTRAINT "StudentSubjectResult_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubjectResult" ADD CONSTRAINT "StudentSubjectResult_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "SubjectCatalogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilitySubjectRequirement" ADD CONSTRAINT "EligibilitySubjectRequirement_eligibilityRuleId_fkey" FOREIGN KEY ("eligibilityRuleId") REFERENCES "EligibilityRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilitySubjectRequirement" ADD CONSTRAINT "EligibilitySubjectRequirement_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "SubjectCatalogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationalLetter" ADD CONSTRAINT "MotivationalLetter_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivationalLetter" ADD CONSTRAINT "MotivationalLetter_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformationRequest" ADD CONSTRAINT "InformationRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformationRequest" ADD CONSTRAINT "InformationRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformationRequest" ADD CONSTRAINT "InformationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformationRequestItem" ADD CONSTRAINT "InformationRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "InformationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformationRequestItem" ADD CONSTRAINT "InformationRequestItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

