import { incomeBandLabels, qualificationLabels } from '@/lib/labels';
import type { LetterAnswers, LetterInput, LetterProvider } from './types';

/**
 * Composing the letter.
 *
 * This is not a language model, and does not pretend to be one. It assembles
 * the letter from facts already in the student's profile and sentences the
 * student wrote themselves, joined by the small amount of connective prose a
 * letter needs. Every clause can be traced to one or the other.
 *
 * That constraint is the point rather than a compromise. A letter is sent
 * under the student's name to somebody deciding whether to fund them; a
 * plausible sentence about a passion they never expressed, or an achievement
 * they never mentioned, is a lie they did not tell. A composer cannot produce
 * one. `LetterProvider` is where a model-backed writer would go, under the
 * same rule.
 *
 * The house style, applied throughout: the student's own words are quoted
 * intact rather than paraphrased into something smoother. Paraphrasing is
 * where invention creeps in, and a student's plain sentence reads more like a
 * person than a polished one does.
 */

/** Tidy a student's answer without rewriting it. */
function clean(value: string | undefined): string | null {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < 2) return null;
  // Give it a full stop if the student did not, so paragraphs join cleanly.
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Lower-case the first letter, for quoting an answer mid-sentence. */
function joinOn(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function list(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export class ComposedLetter implements LetterProvider {
  readonly name = 'composer-v1';

  compose(input: LetterInput) {
    const { facts, opportunity, answers } = input;
    const used: (keyof LetterAnswers)[] = [];
    const paragraphs: string[] = [];

    const studying = [
      facts.qualificationLevel ? qualificationLabels[facts.qualificationLevel] : null,
      facts.programmeName,
    ]
      .filter(Boolean)
      .join(' in ');

    // --- who they are, and what they are applying for ----------------------
    const opening: string[] = [];
    opening.push(
      `I am writing to apply for the ${opportunity.name}${
        opportunity.organisationName ? ` offered by ${opportunity.organisationName}` : ''
      }.`,
    );

    if (studying && facts.institutionName) {
      const year = facts.yearOfStudy !== null ? `, currently in year ${facts.yearOfStudy},` : '';
      opening.push(
        `I am studying towards a ${studying} at ${facts.institutionName}${year} and this bursary would go directly towards completing that qualification.`,
      );
    } else if (studying) {
      opening.push(`I am studying towards a ${studying}.`);
    } else if (facts.institutionName) {
      opening.push(`I am a student at ${facts.institutionName}.`);
    }

    const why = clean(answers.whyApplying);
    if (why) {
      used.push('whyApplying');
      opening.push(why);
    }
    paragraphs.push(opening.join(' '));

    // --- what drew them to the field ---------------------------------------
    const field = clean(answers.whyThisField);
    if (field) {
      used.push('whyThisField');
      paragraphs.push(field);
    }

    // --- the academic record, stated plainly -------------------------------
    const academic: string[] = [];
    if (facts.academicAverage !== null) {
      academic.push(`My current academic average is ${facts.academicAverage}%.`);
    }

    // Cite a met requirement specifically: it answers the funder's own
    // criterion in their own terms, which a general claim cannot.
    const met = opportunity.subjectRequirements
      .map((requirement) => {
        const result = facts.results.find((r) => r.subjectName === requirement.subjectName);
        return result && result.percentage >= requirement.minimumPercentage
          ? `${requirement.subjectName} at ${result.percentage}%, against the ${requirement.minimumPercentage}% this bursary requires`
          : null;
      })
      .filter((line): line is string => line !== null);

    if (met.length > 0) {
      academic.push(`I achieved ${list(met)}.`);
    } else if (facts.results.length > 0) {
      const strongest = [...facts.results]
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 3)
        .map((r) => `${r.subjectName} (${r.percentage}%)`);
      academic.push(`My strongest results are ${list(strongest)}.`);
    }

    if (
      opportunity.minimumAverage !== null &&
      facts.academicAverage !== null &&
      facts.academicAverage >= opportunity.minimumAverage
    ) {
      academic.push(
        `This meets the minimum average of ${opportunity.minimumAverage}% set for this bursary.`,
      );
    }

    const achievement = clean(answers.proudestAchievement);
    if (achievement) {
      used.push('proudestAchievement');
      academic.push(`Beyond my marks, ${joinOn(achievement)}`);
    } else if (facts.achievements.length > 0) {
      // Only achievements already recorded on the profile. Nothing is added.
      academic.push(`I have also been recognised for ${list(facts.achievements)}.`);
    }

    if (academic.length > 0) paragraphs.push(academic.join(' '));

    // --- where they are going ----------------------------------------------
    const goals = clean(answers.goals);
    if (goals) {
      used.push('goals');
      const tie =
        opportunity.fieldsOfStudy.length > 0
          ? ` I understand that ${opportunity.organisationName} supports students in ${list(opportunity.fieldsOfStudy)}, which is the direction I am taking.`
          : '';
      paragraphs.push(`${goals}${tie}`);
    } else if (facts.careerInterests.length > 0) {
      paragraphs.push(`My interests lie in ${list(facts.careerInterests)}.`);
    }

    // --- why them ----------------------------------------------------------
    const suitable = clean(answers.whySuitable);
    if (suitable) {
      used.push('whySuitable');
      paragraphs.push(suitable);
    }

    // --- circumstances, only where the student has spoken to them ----------
    const circumstances: string[] = [];
    const challenges = clean(answers.fundingChallenges);
    if (challenges) {
      used.push('fundingChallenges');
      circumstances.push(challenges);
    }
    if (facts.householdIncome) {
      circumstances.push(
        `My household income falls within the ${incomeBandLabels[facts.householdIncome]} band.`,
      );
    }
    const helps = clean(answers.howItHelps);
    if (helps) {
      used.push('howItHelps');
      circumstances.push(helps);
    } else if (opportunity.coverage.length > 0 && circumstances.length > 0) {
      circumstances.push(
        `Support with ${list(opportunity.coverage).toLowerCase()} would remove the obstacle that concerns me most.`,
      );
    }
    if (circumstances.length > 0) paragraphs.push(circumstances.join(' '));

    // --- close --------------------------------------------------------------
    paragraphs.push(
      'Thank you for considering my application. I would welcome the opportunity to discuss it further, and I am happy to provide any further documents you need.',
    );

    const greeting = opportunity.organisationName
      ? `Dear ${opportunity.organisationName} Bursary Committee,`
      : 'Dear Sir or Madam,';

    const content = [
      greeting,
      '',
      ...paragraphs.flatMap((paragraph) => [paragraph, '']),
      'Yours faithfully,',
      `${facts.firstName} ${facts.lastName}`,
    ]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { content, usedAnswers: used };
  }
}

export const defaultLetterProvider: LetterProvider = new ComposedLetter();

/** A title the student can tell one letter from another by. */
export function letterTitle(opportunityName: string, organisationName: string): string {
  const name = opportunityName.trim() || 'bursary application';
  return `Motivational Letter — ${organisationName.trim() || name}`;
}
