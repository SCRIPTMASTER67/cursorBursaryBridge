import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  achievementLabels,
  careerInterestLabels,
  fundingCoverageLabels,
  fundingTypeLabels,
} from '@/lib/labels';
import { defaultLetterProvider, letterTitle } from '@/lib/letters/compose';
import { gapsIn } from '@/lib/letters/questions';
import type { LetterAnswers, LetterFacts, LetterOpportunity } from '@/lib/letters/types';
import { audit } from '@/services/audit';

/**
 * Motivational letters.
 *
 * Every read and write is scoped by `studentProfileId` in the WHERE clause
 * rather than checked afterwards, so there is no path by which one student
 * reaches another's letter.
 */

const MAX_CONTENT = 20_000;

/** What the student's profile can contribute, with nothing filled in for them. */
export async function factsFor(studentProfileId: string): Promise<LetterFacts | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: {
      qualificationLevel: true,
      yearOfStudy: true,
      academicAverage: true,
      academicAverageUnknown: true,
      householdIncome: true,
      province: true,
      achievements: true,
      careerInterests: true,
      user: { select: { firstName: true, lastName: true } },
      currentInstitution: { select: { name: true } },
      currentProgramme: { select: { name: true } },
      subjectResults: {
        where: { percentage: { not: null } },
        orderBy: [{ year: 'desc' }],
        select: { percentage: true, year: true, subject: { select: { name: true } } },
      },
    },
  });
  if (!profile) return null;

  // Latest year wins, so an improved mark replaces the earlier one rather than
  // both appearing in the same letter.
  const bySubject = new Map<string, { subjectName: string; percentage: number; year: number }>();
  for (const result of profile.subjectResults) {
    const name = result.subject?.name;
    if (!name || result.percentage === null) continue;
    if (!bySubject.has(name)) {
      bySubject.set(name, { subjectName: name, percentage: result.percentage, year: result.year });
    }
  }

  return {
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    qualificationLevel: profile.qualificationLevel,
    programmeName: profile.currentProgramme?.name ?? null,
    institutionName: profile.currentInstitution?.name ?? null,
    yearOfStudy: profile.yearOfStudy,
    // An average the student said they do not know is not an average.
    academicAverage: profile.academicAverageUnknown ? null : profile.academicAverage,
    householdIncome:
      profile.householdIncome === 'DONT_KNOW' || profile.householdIncome === 'PREFER_NOT_TO_SAY'
        ? null
        : profile.householdIncome,
    province: profile.province,
    results: [...bySubject.values()],
    careerInterests: profile.careerInterests
      .filter((interest) => interest !== 'OTHER')
      .map((interest) => careerInterestLabels[interest]),
    achievements: profile.achievements
      .filter((achievement) => achievement !== 'NONE' && achievement !== 'OTHER')
      .map((achievement) => achievementLabels[achievement].toLowerCase()),
  };
}

/** What the funder states, in the funder's own terms. */
export async function opportunityFor(
  fundingProgrammeId: string,
): Promise<LetterOpportunity | null> {
  const programme = await prisma.fundingProgramme.findFirst({
    where: { id: fundingProgrammeId, status: 'PUBLISHED' },
    select: {
      name: true,
      fundingType: true,
      coverage: true,
      organisation: { select: { name: true } },
      supportedProgrammes: { select: { programme: { select: { name: true } } } },
      eligibility: {
        select: {
          minAcademicAverage: true,
          subjectRequirements: {
            select: { minimumPercentage: true, subject: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!programme) return null;

  return {
    name: programme.name,
    organisationName: programme.organisation.name,
    fundingType: fundingTypeLabels[programme.fundingType],
    coverage: programme.coverage
      .filter((item) => item !== 'OTHER')
      .map((item) => fundingCoverageLabels[item]),
    fieldsOfStudy: programme.supportedProgrammes.map((link) => link.programme.name).slice(0, 4),
    subjectRequirements:
      programme.eligibility?.subjectRequirements
        .filter((requirement) => Boolean(requirement.subject?.name))
        .map((requirement) => ({
          subjectName: requirement.subject.name,
          minimumPercentage: requirement.minimumPercentage,
        })) ?? [],
    minimumAverage: programme.eligibility?.minAcademicAverage ?? null,
  };
}

/**
 * A letter can also be written for an opportunity the student found elsewhere.
 * The funder then contributes nothing beyond its name, and the letter is built
 * entirely from the profile and the student's own answers — which is honest
 * about what we know rather than inventing criteria for a bursary we have
 * never read.
 */
export function manualOpportunity(name: string, organisationName: string): LetterOpportunity {
  return {
    name: name.trim(),
    organisationName: organisationName.trim(),
    fundingType: 'Bursary',
    coverage: [],
    fieldsOfStudy: [],
    subjectRequirements: [],
    minimumAverage: null,
  };
}

/** The questions worth putting to the student before anything is generated. */
export async function preparationFor(studentProfileId: string, fundingProgrammeId: string | null) {
  const facts = await factsFor(studentProfileId);
  if (!facts) return null;
  const opportunity = fundingProgrammeId ? await opportunityFor(fundingProgrammeId) : null;
  if (fundingProgrammeId && !opportunity) return null;
  return { facts, opportunity, gaps: gapsIn(facts, {}) };
}

function parseAnswers(value: Prisma.JsonValue | null): LetterAnswers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const answers: LetterAnswers = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      answers[key as keyof LetterAnswers] = entry;
    }
  }
  return answers;
}

export type GenerateInput = {
  studentProfileId: string;
  userId: string;
  fundingProgrammeId: string | null;
  /** Used only when there is no programme id: a bursary found elsewhere. */
  opportunityName?: string;
  organisationName?: string;
  answers: LetterAnswers;
};

export async function generateLetter(input: GenerateInput) {
  const facts = await factsFor(input.studentProfileId);
  if (!facts) return { ok: false as const, reason: 'Complete your profile first.' };

  let opportunity: LetterOpportunity | null = null;
  if (input.fundingProgrammeId) {
    opportunity = await opportunityFor(input.fundingProgrammeId);
    if (!opportunity) {
      return { ok: false as const, reason: 'That opportunity is no longer available.' };
    }
  } else {
    const name = (input.opportunityName ?? '').trim();
    const organisation = (input.organisationName ?? '').trim();
    if (name.length < 2 || organisation.length < 2) {
      return {
        ok: false as const,
        reason: 'Give the bursary name and the organisation offering it.',
      };
    }
    opportunity = manualOpportunity(name, organisation);
  }

  const answers = sanitiseAnswers(input.answers);
  const { content } = defaultLetterProvider.compose({ facts, opportunity, answers });

  const letter = await prisma.motivationalLetter.create({
    data: {
      studentProfileId: input.studentProfileId,
      fundingProgrammeId: input.fundingProgrammeId,
      opportunityName: opportunity.name,
      organisationName: opportunity.organisationName,
      title: letterTitle(opportunity.name, opportunity.organisationName),
      content,
      answers: answers as Prisma.InputJsonValue,
      generator: defaultLetterProvider.name,
    },
  });

  await audit({
    userId: input.userId,
    action: 'letter.generated',
    entityType: 'MotivationalLetter',
    entityId: letter.id,
    metadata: { generator: defaultLetterProvider.name, programmeId: input.fundingProgrammeId },
  });

  return { ok: true as const, letter, gaps: gapsIn(facts, answers) };
}

function sanitiseAnswers(answers: LetterAnswers): LetterAnswers {
  const cleaned: LetterAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    const text = (value ?? '').trim();
    if (text.length > 0) cleaned[key as keyof LetterAnswers] = text.slice(0, 2_000);
  }
  return cleaned;
}

/**
 * Regenerate from (possibly new) answers.
 *
 * A student who has edited the text themselves is warned in the UI before this
 * runs, because regenerating replaces what they wrote.
 */
export async function regenerateLetter(
  letterId: string,
  studentProfileId: string,
  userId: string,
  answers: LetterAnswers,
) {
  const existing = await prisma.motivationalLetter.findFirst({
    where: { id: letterId, studentProfileId },
  });
  if (!existing) return { ok: false as const, reason: 'That letter was not found.' };

  const facts = await factsFor(studentProfileId);
  if (!facts) return { ok: false as const, reason: 'Complete your profile first.' };

  const opportunity = existing.fundingProgrammeId
    ? await opportunityFor(existing.fundingProgrammeId)
    : null;
  const target =
    opportunity ?? manualOpportunity(existing.opportunityName, existing.organisationName);

  const merged = sanitiseAnswers({ ...parseAnswers(existing.answers), ...answers });
  const { content } = defaultLetterProvider.compose({
    facts,
    opportunity: target,
    answers: merged,
  });

  const letter = await prisma.motivationalLetter.update({
    where: { id: existing.id },
    data: {
      content,
      answers: merged as Prisma.InputJsonValue,
      generator: defaultLetterProvider.name,
      editedByStudent: false,
      status: 'DRAFT',
    },
  });

  await audit({
    userId,
    action: 'letter.regenerated',
    entityType: 'MotivationalLetter',
    entityId: letter.id,
  });

  return { ok: true as const, letter, gaps: gapsIn(facts, merged) };
}

/** The student's own edit. Saved verbatim. */
export async function saveLetter(
  letterId: string,
  studentProfileId: string,
  update: { content?: string; title?: string; status?: 'DRAFT' | 'READY' },
) {
  const existing = await prisma.motivationalLetter.findFirst({
    where: { id: letterId, studentProfileId },
    select: { id: true, content: true },
  });
  if (!existing) return { ok: false as const, reason: 'That letter was not found.' };

  const content = update.content?.trim();
  if (content !== undefined) {
    if (content.length === 0) return { ok: false as const, reason: 'A letter cannot be empty.' };
    if (content.length > MAX_CONTENT) {
      return { ok: false as const, reason: 'That letter is too long to save.' };
    }
  }
  const title = update.title?.trim();
  if (title !== undefined && title.length === 0) {
    return { ok: false as const, reason: 'Give the letter a title.' };
  }

  const letter = await prisma.motivationalLetter.update({
    where: { id: existing.id },
    data: {
      content,
      title: title?.slice(0, 200),
      status: update.status,
      // Only a real change to the text counts as the student's own edit.
      editedByStudent: content !== undefined && content !== existing.content ? true : undefined,
    },
  });
  return { ok: true as const, letter };
}

export async function deleteLetter(letterId: string, studentProfileId: string) {
  const { count } = await prisma.motivationalLetter.deleteMany({
    where: { id: letterId, studentProfileId },
  });
  return count > 0
    ? { ok: true as const }
    : { ok: false as const, reason: 'That letter was not found.' };
}

export async function letterFor(letterId: string, studentProfileId: string) {
  return prisma.motivationalLetter.findFirst({
    where: { id: letterId, studentProfileId },
    include: {
      fundingProgramme: {
        select: { id: true, slug: true, closingDate: true, availability: true },
      },
    },
  });
}

export async function lettersFor(studentProfileId: string) {
  return prisma.motivationalLetter.findMany({
    where: { studentProfileId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      opportunityName: true,
      organisationName: true,
      status: true,
      editedByStudent: true,
      updatedAt: true,
      fundingProgrammeId: true,
    },
  });
}

/** Answers already given, so a second letter does not ask the same questions. */
export async function previousAnswers(studentProfileId: string): Promise<LetterAnswers> {
  const recent = await prisma.motivationalLetter.findMany({
    where: { studentProfileId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { answers: true },
  });
  // Oldest first so the most recent answer wins.
  const merged: LetterAnswers = {};
  for (const row of [...recent].reverse()) Object.assign(merged, parseAnswers(row.answers));
  return merged;
}

/**
 * Opportunities a letter can be written for: what the student is applying to,
 * or has been matched with. Real published programmes only.
 */
export async function letterTargets(studentProfileId: string) {
  const [applications, published] = await Promise.all([
    prisma.application.findMany({
      where: { studentProfileId },
      select: {
        fundingProgramme: {
          select: { id: true, name: true, organisation: { select: { name: true } } },
        },
      },
    }),
    prisma.fundingProgramme.findMany({
      where: { status: 'PUBLISHED', availability: { in: ['OPEN', 'CLOSING_SOON', 'UPCOMING'] } },
      orderBy: { closingDate: 'asc' },
      take: 100,
      select: { id: true, name: true, organisation: { select: { name: true } } },
    }),
  ]);

  const seen = new Set<string>();
  const targets: { id: string; name: string; organisationName: string; applied: boolean }[] = [];
  for (const application of applications) {
    const programme = application.fundingProgramme;
    if (seen.has(programme.id)) continue;
    seen.add(programme.id);
    targets.push({
      id: programme.id,
      name: programme.name,
      organisationName: programme.organisation.name,
      applied: true,
    });
  }
  for (const programme of published) {
    if (seen.has(programme.id)) continue;
    seen.add(programme.id);
    targets.push({
      id: programme.id,
      name: programme.name,
      organisationName: programme.organisation.name,
      applied: false,
    });
  }
  return targets;
}
