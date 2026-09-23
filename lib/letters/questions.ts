import type { LetterAnswers, LetterFacts, LetterGap } from './types';

/**
 * What the student is asked.
 *
 * None of these is required. A student in a hurry can generate a letter from
 * their profile alone; it will be shorter and plainer, which is honest. Each
 * question exists because its answer replaces something a generic letter would
 * otherwise assert on the student's behalf.
 */
export const QUESTIONS: {
  key: keyof LetterAnswers;
  label: string;
  hint: string;
  rows: number;
}[] = [
  {
    key: 'whyApplying',
    label: 'Why are you applying for this bursary?',
    hint: 'What made you choose this one in particular?',
    rows: 3,
  },
  {
    key: 'whyThisField',
    label: 'What drew you to this field?',
    hint: 'A moment, a person or a problem that pointed you this way.',
    rows: 3,
  },
  {
    key: 'goals',
    label: 'What do you want to do after you qualify?',
    hint: 'Where you want to work, or what you want to build or change.',
    rows: 3,
  },
  {
    key: 'fundingChallenges',
    label: 'What makes funding your studies difficult?',
    hint: 'Only what you are comfortable sharing. Leave it blank if you would rather not.',
    rows: 3,
  },
  {
    key: 'proudestAchievement',
    label: 'What achievement are you most proud of?',
    hint: 'It does not have to be academic.',
    rows: 2,
  },
  {
    key: 'whySuitable',
    label: 'Why do you believe you are a suitable candidate?',
    hint: 'What you would bring that the marks alone do not show.',
    rows: 3,
  },
  {
    key: 'howItHelps',
    label: 'How would this funding change things for you?',
    hint: 'What it would let you do that you otherwise could not.',
    rows: 2,
  },
];

/**
 * What is missing that the student should be asked for.
 *
 * Returned before generating rather than filled in silently. A letter that
 * says nothing about why somebody wants to study medicine, because nobody
 * asked them, is a weak letter; a letter that invents a reason is a dishonest
 * one. This produces the first.
 */
export function gapsIn(facts: LetterFacts, answers: LetterAnswers): LetterGap[] {
  const gaps: LetterGap[] = [];

  if (!answers.whyApplying?.trim()) {
    gaps.push({
      key: 'whyApplying',
      question: 'Why are you applying for this bursary?',
      because: 'Without it the letter cannot say what drew you to this funder rather than another.',
    });
  }
  if (!answers.goals?.trim()) {
    gaps.push({
      key: 'goals',
      question: 'What do you want to do after you qualify?',
      because: 'Funders fund outcomes. This is the paragraph that describes yours.',
    });
  }
  if (!facts.programmeName || !facts.institutionName) {
    gaps.push({
      key: 'profile',
      question: 'Add your course and institution to your profile',
      because: 'The opening paragraph names what you study and where.',
    });
  }
  if (facts.academicAverage === null && facts.results.length === 0) {
    gaps.push({
      key: 'profile',
      question: 'Add your results',
      because: 'Without a mark the letter cannot point at your academic record.',
    });
  }

  return gaps;
}
