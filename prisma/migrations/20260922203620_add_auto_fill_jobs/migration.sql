-- CreateEnum
CREATE TYPE "AutoFillJobStatus" AS ENUM ('DRAFT', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AutoFillFormStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AutoFillFieldStatus" AS ENUM ('FILLED', 'NEEDS_REVIEW', 'MISSING', 'AMBIGUOUS', 'SIGNATURE', 'MANUAL');

-- CreateEnum
CREATE TYPE "AutoFillConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "AutoFillJob" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "status" "AutoFillJobStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceFileName" TEXT NOT NULL,
    "sourceStorageKey" TEXT NOT NULL,
    "sourceSizeBytes" INTEGER NOT NULL,
    "sourcePageCount" INTEGER,
    "failureReason" TEXT,
    "matcher" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutoFillJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoFillExtractedValue" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "confidence" "AutoFillConfidence" NOT NULL,
    "sourcePage" INTEGER,
    "sourceFieldLabel" TEXT NOT NULL,
    "method" TEXT NOT NULL,

    CONSTRAINT "AutoFillExtractedValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoFillTargetForm" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "AutoFillFormStatus" NOT NULL DEFAULT 'PENDING',
    "originalFileName" TEXT NOT NULL,
    "originalStorageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "failureReason" TEXT,
    "fieldsTotal" INTEGER NOT NULL DEFAULT 0,
    "fieldsFilled" INTEGER NOT NULL DEFAULT 0,
    "fieldsOutstanding" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AutoFillTargetForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoFillField" (
    "id" TEXT NOT NULL,
    "targetFormId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "status" "AutoFillFieldStatus" NOT NULL,
    "value" TEXT,
    "canonicalKey" TEXT,
    "confidence" "AutoFillConfidence",
    "reason" TEXT NOT NULL,
    "options" TEXT[],
    "sourceDocumentName" TEXT,
    "sourcePage" INTEGER,
    "sourceFieldLabel" TEXT,
    "rectX" DOUBLE PRECISION,
    "rectY" DOUBLE PRECISION,
    "rectWidth" DOUBLE PRECISION,
    "rectHeight" DOUBLE PRECISION,
    "editedByStudent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AutoFillField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoFillFieldEdit" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoFillFieldEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutoFillJob_sourceStorageKey_key" ON "AutoFillJob"("sourceStorageKey");

-- CreateIndex
CREATE INDEX "AutoFillJob_studentProfileId_createdAt_idx" ON "AutoFillJob"("studentProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "AutoFillExtractedValue_jobId_idx" ON "AutoFillExtractedValue"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoFillExtractedValue_jobId_canonicalKey_key" ON "AutoFillExtractedValue"("jobId", "canonicalKey");

-- CreateIndex
CREATE UNIQUE INDEX "AutoFillTargetForm_originalStorageKey_key" ON "AutoFillTargetForm"("originalStorageKey");

-- CreateIndex
CREATE INDEX "AutoFillTargetForm_jobId_idx" ON "AutoFillTargetForm"("jobId");

-- CreateIndex
CREATE INDEX "AutoFillField_targetFormId_idx" ON "AutoFillField"("targetFormId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoFillField_targetFormId_fieldName_key" ON "AutoFillField"("targetFormId", "fieldName");

-- CreateIndex
CREATE INDEX "AutoFillFieldEdit_fieldId_editedAt_idx" ON "AutoFillFieldEdit"("fieldId", "editedAt");

-- AddForeignKey
ALTER TABLE "AutoFillJob" ADD CONSTRAINT "AutoFillJob_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFillExtractedValue" ADD CONSTRAINT "AutoFillExtractedValue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AutoFillJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFillTargetForm" ADD CONSTRAINT "AutoFillTargetForm_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AutoFillJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFillField" ADD CONSTRAINT "AutoFillField_targetFormId_fkey" FOREIGN KEY ("targetFormId") REFERENCES "AutoFillTargetForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFillFieldEdit" ADD CONSTRAINT "AutoFillFieldEdit_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "AutoFillField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
