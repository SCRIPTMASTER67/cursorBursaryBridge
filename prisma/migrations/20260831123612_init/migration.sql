-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'CORPORATE');

-- CreateEnum
CREATE TYPE "EducationStage" AS ENUM ('GRADE_10', 'GRADE_11', 'MATRIC', 'UNIVERSITY_FIRST_YEAR', 'UNIVERSITY_CURRENT', 'TVET_COLLEGE', 'POSTGRADUATE', 'PLANNING_TO_STUDY', 'OTHER');

-- CreateEnum
CREATE TYPE "QualificationLevel" AS ENUM ('CERTIFICATE', 'DIPLOMA', 'ADVANCED_DIPLOMA', 'BACHELORS', 'HONOURS', 'MASTERS', 'DOCTORAL', 'OTHER');

-- CreateEnum
CREATE TYPE "StudyStatus" AS ENUM ('CURRENTLY_ENROLLED', 'ACCEPTED_NOT_REGISTERED', 'APPLIED_AWAITING', 'PLANNING_TO_APPLY', 'RETURNING_STUDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('SCHOOL_REPORT', 'MATRIC_RESULTS', 'UNIVERSITY_TRANSCRIPT', 'ACADEMIC_RECORD', 'OTHER', 'NONE_YET');

-- CreateEnum
CREATE TYPE "Achievement" AS ENUM ('SUBJECT_DISTINCTIONS', 'ACADEMIC_AWARDS', 'DEANS_LIST', 'COMPETITIONS', 'OLYMPIADS', 'RESEARCH', 'OTHER', 'NONE');

-- CreateEnum
CREATE TYPE "FundingNeed" AS ENUM ('TUITION_FEES', 'REGISTRATION_FEES', 'ACCOMMODATION', 'BOOKS_MATERIALS', 'MEALS_LIVING', 'TRANSPORT', 'LAPTOP_DEVICE', 'OTHER_EXPENSES', 'FULL_FUNDING', 'PARTIAL_FUNDING', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "FundingSituation" AS ENUM ('NO_FUNDING', 'PARTIALLY_FUNDED', 'FULLY_FUNDED', 'AWAITING_DECISION', 'DONT_KNOW');

-- CreateEnum
CREATE TYPE "BursaryStatus" AS ENUM ('YES', 'NO', 'APPLICATION_PENDING', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "IncomeBand" AS ENUM ('BELOW_50K', 'R50K_100K', 'R100K_200K', 'R200K_350K', 'R350K_500K', 'ABOVE_500K', 'DONT_KNOW', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "Citizenship" AS ENUM ('SA_CITIZEN', 'PERMANENT_RESIDENT', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "TriState" AS ENUM ('YES', 'NO', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "StudyLocationPreference" AS ENUM ('SAME_LOCATION', 'DIFFERENT_LOCATION', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "CareerInterest" AS ENUM ('TECHNOLOGY', 'ENGINEERING', 'HEALTHCARE', 'FINANCE_ACCOUNTING', 'LAW', 'EDUCATION', 'AGRICULTURE', 'SCIENCE_RESEARCH', 'BUSINESS', 'GOVERNMENT', 'MINING', 'ENERGY', 'MANUFACTURING', 'CONSTRUCTION', 'MEDIA_COMMUNICATIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "Province" AS ENUM ('EASTERN_CAPE', 'FREE_STATE', 'GAUTENG', 'KWAZULU_NATAL', 'LIMPOPO', 'MPUMALANGA', 'NORTHERN_CAPE', 'NORTH_WEST', 'WESTERN_CAPE');

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('UNIVERSITY', 'UNIVERSITY_OF_TECHNOLOGY', 'TVET_COLLEGE', 'PRIVATE_INSTITUTION', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganisationType" AS ENUM ('CORPORATION', 'FOUNDATION', 'NGO', 'NON_PROFIT', 'PROFESSIONAL_ORGANISATION', 'GOVERNMENT_ORGANISATION', 'EDUCATIONAL_ORGANISATION', 'OTHER');

-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('FINANCIAL_SERVICES', 'MINING', 'TECHNOLOGY', 'TELECOMMUNICATIONS', 'ENGINEERING', 'HEALTHCARE', 'ENERGY', 'MANUFACTURING', 'RETAIL', 'CONSTRUCTION', 'PROFESSIONAL_SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "CorporateRole" AS ENUM ('BURSARY_FUNDING_MANAGER', 'HR_MANAGER', 'TALENT_MANAGER', 'CSI_MANAGER', 'FOUNDATION_MANAGER', 'PROGRAMME_MANAGER', 'ADMINISTRATOR', 'EXECUTIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganisationSize" AS ENUM ('UNDER_50', 'SIZE_50_250', 'SIZE_251_1000', 'SIZE_1001_5000', 'ABOVE_5000');

-- CreateEnum
CREATE TYPE "ProgrammeTypeOffered" AS ENUM ('BURSARIES', 'SCHOLARSHIPS', 'GRANTS', 'INTERNSHIPS', 'LEARNERSHIPS', 'GRADUATE_PROGRAMMES', 'OTHER');

-- CreateEnum
CREATE TYPE "OffersFunding" AS ENUM ('YES', 'NO', 'PLANNING_TO', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "ApplicationVolume" AS ENUM ('UNDER_100', 'V100_500', 'V501_1000', 'V1001_5000', 'V5001_10000', 'ABOVE_10000');

-- CreateEnum
CREATE TYPE "ProcessMethod" AS ENUM ('EMAIL', 'SPREADSHEETS', 'GOOGLE_FORMS', 'WEBSITE_FORMS', 'DEDICATED_SOFTWARE', 'MANUAL_PROCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "ProcessChallenge" AS ENUM ('TOO_MANY_APPLICATIONS', 'MANUAL_SCREENING', 'DOCUMENT_VERIFICATION', 'FINDING_ELIGIBLE_APPLICANTS', 'COMMUNICATION', 'SHORTLISTING', 'REPORTING', 'FRAUD_DUPLICATES', 'TRACKING_BENEFICIARIES', 'OTHER');

-- CreateEnum
CREATE TYPE "FundingType" AS ENUM ('BURSARY', 'SCHOLARSHIP', 'GRANT', 'OTHER');

-- CreateEnum
CREATE TYPE "FundingCoverage" AS ENUM ('TUITION_FEES', 'REGISTRATION_FEES', 'ACCOMMODATION', 'MEALS_LIVING', 'BOOKS_MATERIALS', 'LAPTOP_DEVICE', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProgrammeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_REQUIRED', 'SHORTLISTED', 'APPROVED', 'UNSUCCESSFUL');

-- CreateEnum
CREATE TYPE "MatchClassification" AS ENUM ('STRONG_MATCH', 'POTENTIAL_MATCH', 'MORE_INFO_NEEDED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID_DOCUMENT', 'ACADEMIC_RECORD', 'TRANSCRIPT', 'MATRIC_CERTIFICATE', 'PROOF_OF_RESIDENCE', 'PROOF_OF_INCOME', 'PROOF_OF_REGISTRATION', 'CV', 'MOTIVATION_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "ShortlistStatus" AS ENUM ('SHORTLISTED', 'SELECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_MATCH', 'APPLICATION_SUBMITTED', 'APPLICATION_STATUS_CHANGED', 'DEADLINE_APPROACHING', 'INFORMATION_REQUESTED', 'PROGRAMME_PUBLISHED', 'WELCOME');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_SELECT', 'MULTI_SELECT', 'NUMBER', 'DATE', 'YES_NO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "mobile" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "acceptedTermsAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" "InstitutionType" NOT NULL,
    "province" "Province" NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field" "CareerInterest" NOT NULL,
    "qualificationLevels" "QualificationLevel"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "educationStage" "EducationStage",
    "qualificationLevel" "QualificationLevel",
    "studyStatus" "StudyStatus",
    "currentInstitutionId" TEXT,
    "currentProgrammeId" TEXT,
    "yearOfStudy" INTEGER,
    "academicAverage" INTEGER,
    "academicAverageUnknown" BOOLEAN NOT NULL DEFAULT false,
    "resultTypes" "ResultType"[],
    "achievements" "Achievement"[],
    "fundingNeeds" "FundingNeed"[],
    "fundingSituation" "FundingSituation",
    "bursaryStatus" "BursaryStatus",
    "householdIncome" "IncomeBand",
    "dateOfBirth" TIMESTAMP(3),
    "citizenship" "Citizenship",
    "firstGeneration" "TriState",
    "disability" "TriState",
    "orphanVulnerable" "TriState",
    "province" "Province",
    "city" TEXT,
    "studyLocationPreference" "StudyLocationPreference",
    "careerInterests" "CareerInterest"[],
    "onboardingStep" TEXT NOT NULL DEFAULT 'education',
    "onboardingCompletedAt" TIMESTAMP(3),
    "profileStrength" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPreference" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "preferenceNumber" INTEGER NOT NULL,
    "programmeId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganisationType" NOT NULL,
    "industry" "Industry" NOT NULL,
    "website" TEXT,
    "country" TEXT NOT NULL DEFAULT 'South Africa',
    "description" TEXT,
    "logoUrl" TEXT,
    "offersFunding" "OffersFunding",
    "programmeTypes" "ProgrammeTypeOffered"[],
    "applicationVolume" "ApplicationVolume",
    "processMethods" "ProcessMethod"[],
    "challenges" "ProcessChallenge"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "role" "CorporateRole",
    "department" TEXT,
    "organisationSize" "OrganisationSize",
    "onboardingStep" TEXT NOT NULL DEFAULT 'organisation',
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingProgramme" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "fullDescription" TEXT NOT NULL,
    "fundingType" "FundingType" NOT NULL,
    "coverage" "FundingCoverage"[],
    "openDate" TIMESTAMP(3) NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "status" "ProgrammeStatus" NOT NULL DEFAULT 'DRAFT',
    "intakeTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingProgramme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityRule" (
    "id" TEXT NOT NULL,
    "fundingProgrammeId" TEXT NOT NULL,
    "minAcademicAverage" INTEGER,
    "qualificationLevels" "QualificationLevel"[],
    "yearsOfStudy" INTEGER[],
    "citizenship" "Citizenship"[],
    "maxHouseholdIncome" "IncomeBand",
    "requiresFinancialNeed" BOOLEAN NOT NULL DEFAULT false,
    "provinces" "Province"[],
    "otherRequirements" TEXT,
    "requiredDocuments" "DocumentType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EligibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingProgrammeInstitution" (
    "fundingProgrammeId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,

    CONSTRAINT "FundingProgrammeInstitution_pkey" PRIMARY KEY ("fundingProgrammeId","institutionId")
);

-- CreateTable
CREATE TABLE "FundingProgrammeProgramme" (
    "fundingProgrammeId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,

    CONSTRAINT "FundingProgrammeProgramme_pkey" PRIMARY KEY ("fundingProgrammeId","programmeId")
);

-- CreateTable
CREATE TABLE "ApplicationQuestion" (
    "id" TEXT NOT NULL,
    "fundingProgrammeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[],
    "order" INTEGER NOT NULL,

    CONSTRAINT "ApplicationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "fundingProgrammeId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "matchScore" INTEGER,
    "matchClassification" "MatchClassification",
    "matchReasons" JSONB,
    "answers" JSONB,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lastStatusChangeAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "applicationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requirement" "DocumentType" NOT NULL,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("applicationId","documentId")
);

-- CreateTable
CREATE TABLE "Shortlist" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "fundingProgrammeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "addedById" TEXT,
    "status" "ShortlistStatus" NOT NULL DEFAULT 'SHORTLISTED',
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectedAt" TIMESTAMP(3),

    CONSTRAINT "Shortlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_userId_key" ON "VerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_name_key" ON "Institution"("name");

-- CreateIndex
CREATE INDEX "Institution_province_idx" ON "Institution"("province");

-- CreateIndex
CREATE INDEX "Institution_type_idx" ON "Institution"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_name_key" ON "Programme"("name");

-- CreateIndex
CREATE INDEX "Programme_field_idx" ON "Programme"("field");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_province_idx" ON "StudentProfile"("province");

-- CreateIndex
CREATE INDEX "StudentProfile_educationStage_idx" ON "StudentProfile"("educationStage");

-- CreateIndex
CREATE INDEX "StudyPreference_programmeId_idx" ON "StudyPreference"("programmeId");

-- CreateIndex
CREATE INDEX "StudyPreference_institutionId_idx" ON "StudyPreference"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPreference_studentProfileId_preferenceNumber_key" ON "StudyPreference"("studentProfileId", "preferenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPreference_studentProfileId_programmeId_institutionId_key" ON "StudyPreference"("studentProfileId", "programmeId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_name_key" ON "Organisation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateProfile_userId_key" ON "CorporateProfile"("userId");

-- CreateIndex
CREATE INDEX "CorporateProfile_organisationId_idx" ON "CorporateProfile"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "FundingProgramme_slug_key" ON "FundingProgramme"("slug");

-- CreateIndex
CREATE INDEX "FundingProgramme_organisationId_idx" ON "FundingProgramme"("organisationId");

-- CreateIndex
CREATE INDEX "FundingProgramme_status_idx" ON "FundingProgramme"("status");

-- CreateIndex
CREATE INDEX "FundingProgramme_closingDate_idx" ON "FundingProgramme"("closingDate");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityRule_fundingProgrammeId_key" ON "EligibilityRule"("fundingProgrammeId");

-- CreateIndex
CREATE INDEX "FundingProgrammeInstitution_institutionId_idx" ON "FundingProgrammeInstitution"("institutionId");

-- CreateIndex
CREATE INDEX "FundingProgrammeProgramme_programmeId_idx" ON "FundingProgrammeProgramme"("programmeId");

-- CreateIndex
CREATE INDEX "ApplicationQuestion_fundingProgrammeId_idx" ON "ApplicationQuestion"("fundingProgrammeId");

-- CreateIndex
CREATE INDEX "Application_fundingProgrammeId_status_idx" ON "Application"("fundingProgrammeId", "status");

-- CreateIndex
CREATE INDEX "Application_organisationId_status_idx" ON "Application"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Application_studentProfileId_idx" ON "Application"("studentProfileId");

-- CreateIndex
CREATE INDEX "Application_matchScore_idx" ON "Application"("matchScore");

-- CreateIndex
CREATE UNIQUE INDEX "Application_studentProfileId_fundingProgrammeId_key" ON "Application"("studentProfileId", "fundingProgrammeId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_studentProfileId_idx" ON "Document"("studentProfileId");

-- CreateIndex
CREATE INDEX "ApplicationDocument_documentId_idx" ON "ApplicationDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Shortlist_applicationId_key" ON "Shortlist"("applicationId");

-- CreateIndex
CREATE INDEX "Shortlist_organisationId_status_idx" ON "Shortlist"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Shortlist_fundingProgrammeId_idx" ON "Shortlist"("fundingProgrammeId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_currentInstitutionId_fkey" FOREIGN KEY ("currentInstitutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_currentProgrammeId_fkey" FOREIGN KEY ("currentProgrammeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPreference" ADD CONSTRAINT "StudyPreference_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPreference" ADD CONSTRAINT "StudyPreference_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPreference" ADD CONSTRAINT "StudyPreference_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateProfile" ADD CONSTRAINT "CorporateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateProfile" ADD CONSTRAINT "CorporateProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProgramme" ADD CONSTRAINT "FundingProgramme_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProgramme" ADD CONSTRAINT "FundingProgramme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityRule" ADD CONSTRAINT "EligibilityRule_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProgrammeInstitution" ADD CONSTRAINT "FundingProgrammeInstitution_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProgrammeInstitution" ADD CONSTRAINT "FundingProgrammeInstitution_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProgrammeProgramme" ADD CONSTRAINT "FundingProgrammeProgramme_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProgrammeProgramme" ADD CONSTRAINT "FundingProgrammeProgramme_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_fundingProgrammeId_fkey" FOREIGN KEY ("fundingProgrammeId") REFERENCES "FundingProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
