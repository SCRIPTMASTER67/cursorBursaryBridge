import type { MappedField } from './map';
import type { StudentProfileData } from './profile';

/**
 * Checking the result before it is offered to the student.
 *
 * Every populated field is re-examined against the profile it came from. The
 * check exists to catch a value that drifted between mapping and writing — a
 * value with no source, a value of the wrong shape, or one that no longer
 * matches what the source said.
 */

export type ValidationIssue = {
  targetFieldName: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
};

/** What the writer reported about a field it had trouble with. */
export type FillProblem = { message: string; written: boolean };

export function validateMapping(
  fields: MappedField[],
  profile: StudentProfileData,
  fillProblems: Map<string, FillProblem>,
): { issues: ValidationIssue[]; fields: MappedField[] } {
  const issues: ValidationIssue[] = [];
  const checked = fields.map((field) => {
    const problem = fillProblems.get(field.targetFieldName);
    if (problem) {
      issues.push({
        targetFieldName: field.targetFieldName,
        severity: 'WARNING',
        message: problem.message,
      });
      // A value that reached the page stays there: it is correct, and removing
      // it would leave the student with less than they had. One that did not
      // is cleared so the field reads as empty, which it is.
      return {
        ...field,
        status: 'NEEDS_REVIEW' as const,
        value: problem.written ? field.value : null,
        reason: problem.message,
      };
    }

    if (field.value === null) return field;

    // A populated field must trace back to something the source actually said.
    if (!field.canonicalKey || !profile.values[field.canonicalKey]) {
      issues.push({
        targetFieldName: field.targetFieldName,
        severity: 'ERROR',
        message: 'A value was produced with no source behind it, so it was removed.',
      });
      return {
        ...field,
        status: 'MISSING' as const,
        value: null,
        reason: 'Information required.',
      };
    }

    if (field.value.trim() === '') {
      issues.push({
        targetFieldName: field.targetFieldName,
        severity: 'WARNING',
        message: 'The value was empty after formatting.',
      });
      return { ...field, status: 'MISSING' as const, value: null, reason: 'Information required.' };
    }

    // A choice must be one this form actually offers.
    if (
      (field.kind === 'radio' || field.kind === 'dropdown') &&
      field.options &&
      !field.options.includes(field.value)
    ) {
      issues.push({
        targetFieldName: field.targetFieldName,
        severity: 'ERROR',
        message: 'The chosen option does not exist on this form, so it was removed.',
      });
      return {
        ...field,
        status: 'NEEDS_REVIEW' as const,
        value: null,
        reason: 'Please choose an option on this form yourself.',
      };
    }

    return field;
  });

  return { issues, fields: checked };
}
