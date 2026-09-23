import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, apiStudent, zodFields } from '@/lib/auth/api';
import { generateLetter, lettersFor } from '@/services/motivational-letters';

/**
 * Motivational letters.
 *
 * The answers are the student's own sentences and are stored and used exactly
 * as typed. Nothing here fills a blank answer in.
 */
const answersSchema = z
  .object({
    whyApplying: z.string().trim().max(2000).optional(),
    goals: z.string().trim().max(2000).optional(),
    whyThisField: z.string().trim().max(2000).optional(),
    fundingChallenges: z.string().trim().max(2000).optional(),
    proudestAchievement: z.string().trim().max(2000).optional(),
    whySuitable: z.string().trim().max(2000).optional(),
    howItHelps: z.string().trim().max(2000).optional(),
  })
  .default({});

const createSchema = z.object({
  fundingProgrammeId: z.string().nullable().optional(),
  opportunityName: z.string().trim().max(200).optional(),
  organisationName: z.string().trim().max(200).optional(),
  answers: answersSchema,
});

export async function GET() {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;
  return apiOk({ letters: await lettersFor(auth.studentProfileId) });
}

export async function POST(request: NextRequest) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError('Check the details.', 422, zodFields(parsed.error));

  const result = await generateLetter({
    studentProfileId: auth.studentProfileId,
    userId: auth.user.id,
    fundingProgrammeId: parsed.data.fundingProgrammeId ?? null,
    opportunityName: parsed.data.opportunityName,
    organisationName: parsed.data.organisationName,
    answers: parsed.data.answers,
  });
  if (!result.ok) return apiError(result.reason, 422, { opportunityName: result.reason });

  return apiOk({ ok: true, letter: result.letter, gaps: result.gaps }, 201);
}
