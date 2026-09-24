-- Bulk application intake.
--
-- An organisation must be able to import applications it received elsewhere
-- and manage them exactly like ones submitted here. That needs three things:
-- somewhere to keep the uploaded files and what was read out of them, an
-- applicant record for somebody who has no account on this platform, and an
-- Application row that can point at either kind of applicant.
--
-- The one change to existing data is `Application.studentProfileId` becoming
-- nullable. Nothing is rewritten: every existing row keeps its student, and
-- the new `source` column defaults to PLATFORM, so applications already in the
-- database are correctly described as having been submitted here.

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('PLATFORM', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADING', 'EXTRACTING', 'READY_FOR_REVIEW', 'IMPORTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportFileStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'NEEDS_REVIEW', 'FAILED', 'DUPLICATE', 'IMPORTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "IdentityResolution" AS ENUM ('NONE', 'ID_NUMBER', 'EMAIL', 'AMBIGUOUS');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "externalApplicantId" TEXT,
ADD COLUMN     "source" "ApplicationSource" NOT NULL DEFAULT 'PLATFORM',
ALTER COLUMN "studentProfileId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ApplicationImportBatch" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "fundingProgrammeId" TEXT NOT NULL,
    "createdById" TEXT,
    "reference" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADING',
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "readyCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ApplicationImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationImportFile" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "status" "ImportFileStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "pageCount" INTEGER,
    "method" TEXT,
    "identity" "IdentityResolution" NOT NULL DEFAULT 'NONE',
    "matchedStudentProfileId" TEXT,
    "duplicateOfFileId" TEXT,
    "duplicateOfApplicationId" TEXT,
    "duplicateReason" TEXT,
    "matchScore" INTEGER,
    "eligibilityOutcome" "EligibilityOutcome",
    "matchReasons" JSONB,
    "documentsFound" INTEGER NOT NULL DEFAULT 0,
    "documentsRequired" INTEGER NOT NULL DEFAULT 0,
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ApplicationImportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportExtractedField" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "confidence" "AutoFillConfidence" NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceFieldLabel" TEXT NOT NULL,
    "sourcePage" INTEGER,
    "method" TEXT NOT NULL,
    "correctedValue" TEXT,
    "correctedById" TEXT,
    "correctedAt" TIMESTAMP(3),

    CONSTRAINT "ImportExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalApplicant" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "idNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "citizenship" "Citizenship",
    "province" "Province",
    "city" TEXT,
    "institutionName" TEXT,
    "institutionId" TEXT,
    "programmeName" TEXT,
    "programmeId" TEXT,
    "qualificationLevel" "QualificationLevel",
    "yearOfStudy" INTEGER,
    "academicAverage" INTEGER,
    "householdIncome" "IncomeBand",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalApplicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeCriterionWeight" (
    "id" TEXT NOT NULL,
    "fundingProgrammeId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "ProgrammeCriterionWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationImportBatch_organisationId_createdAt_idx" ON "ApplicationImportBatch"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationImportBatch_fundingProgrammeId_idx" ON "ApplicationImportBatch"("fundingProgrammeId");

-- CreateIndex
CREATE INDEX "ApplicationImportBatch_status_idx" ON "ApplicationImportBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationImportFile_storageKey_key" ON "ApplicationImportFile"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationImportFile_applicationId_key" ON "ApplicationImportFile"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationImportFile_batchId_status_idx" ON "ApplicationImportFile"("batchId", "status");

-- CreateIndex
CREATE INDEX "ApplicationImportFile_status_idx" ON "ApplicationImportFile"("status");

-- CreateIndex
CREATE INDEX "ApplicationImportFile_matchedStudentProfileId_idx" ON "ApplicationImportFile"("matchedStudentProfileId");

-- CreateIndex
CREATE INDEX "ImportExtractedField_fileId_idx" ON "ImportExtractedField"("fileId");

-- CreateIndex
CREATE INDEX "ImportExtractedField_confidence_idx" ON "ImportExtractedField"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "ImportExtractedField_fileId_canonicalKey_key" ON "ImportExtractedField"("fileId", "canonicalKey");

-- CreateIndex
CREATE INDEX "ExternalApplicant_organisationId_idx" ON "ExternalApplicant"("organisationId");

-- CreateIndex
CREATE INDEX "ExternalApplicant_organisationId_idNumber_idx" ON "ExternalApplicant"("organisationId", "idNumber");

-- CreateIndex
CREATE INDEX "ExternalApplicant_organisationId_email_idx" ON "ExternalApplicant"("organisationId", "email");

-- CreateIndex
CREATE INDEX "ExternalApplicant_institutionId_idx" ON "ExternalApplicant"("institutionId");

-- CreateIndex
CREATE INDEX "ExternalApplicant_programmeId_idx" ON "ExternalApplicant"("programmeId");

-- CreateIndex
CREATE INDEX "ProgrammeCriterionWeight_fundingProgrammeId_idx" ON "ProgrammeCriterionWeight"("fundingProgrammeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeCriterionWeight_fundingProgrammeId_criterion_key" ON "ProgrammeCriterionWeight"("fundingProgrammeId", "criterion");

-- CreateIndex
CREATE INDEX "Application_externalApplicantId_idx" ON "Application"("externalApplicantId");

-- CreateIndex
CREATE INDEX "Application_organisationId_source_idx" ON "Application"("organisationId", "source");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_externalApplicantId_fkey" FOREIGN KEY ("externalApplicantId") REFERENCES "ExternalApplicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationImportBatch" ADD CONSTRAINT "ApplicationImportBatch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationImportBatch" ADD CONSTRAINT "ApplicationImportBatch_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationImportBatch" ADD CONSTRAINT "ApplicationImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationImportFile" ADD CONSTRAINT "ApplicationImportFile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ApplicationImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationImportFile" ADD CONSTRAINT "ApplicationImportFile_duplicateOfFileId_fkey" FOREIGN KEY ("duplicateOfFileId") REFERENCES "ApplicationImportFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationImportFile" ADD CONSTRAINT "ApplicationImportFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportExtractedField" ADD CONSTRAINT "ImportExtractedField_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ApplicationImportFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportExtractedField" ADD CONSTRAINT "ImportExtractedField_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalApplicant" ADD CONSTRAINT "ExternalApplicant_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalApplicant" ADD CONSTRAINT "ExternalApplicant_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalApplicant" ADD CONSTRAINT "ExternalApplicant_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeCriterionWeight" ADD CONSTRAINT "ProgrammeCriterionWeight_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

