import type { SubjectLevel } from '@prisma/client';

/**
 * The subject catalogue.
 *
 * School subjects are the National Senior Certificate list published by the
 * Department of Basic Education — real subjects with real names, which is what
 * lets a bursary requiring "Mathematics" find a student's Mathematics mark.
 *
 * No tertiary modules are listed. Module names differ at every institution and
 * there is no national list to draw on, so inventing one would be inventing
 * facts; a university student types their own module names and those become
 * custom catalogue entries.
 */
export const subjects: { name: string; level: SubjectLevel }[] = [
  // NSC compulsory
  { name: 'Mathematics', level: 'SCHOOL' },
  { name: 'Mathematical Literacy', level: 'SCHOOL' },
  { name: 'Life Orientation', level: 'SCHOOL' },

  // NSC languages
  { name: 'English Home Language', level: 'SCHOOL' },
  { name: 'English First Additional Language', level: 'SCHOOL' },
  { name: 'Afrikaans Home Language', level: 'SCHOOL' },
  { name: 'Afrikaans First Additional Language', level: 'SCHOOL' },
  { name: 'isiZulu', level: 'SCHOOL' },
  { name: 'isiXhosa', level: 'SCHOOL' },
  { name: 'Sepedi', level: 'SCHOOL' },
  { name: 'Setswana', level: 'SCHOOL' },
  { name: 'Sesotho', level: 'SCHOOL' },
  { name: 'Xitsonga', level: 'SCHOOL' },
  { name: 'siSwati', level: 'SCHOOL' },
  { name: 'Tshivenda', level: 'SCHOOL' },
  { name: 'isiNdebele', level: 'SCHOOL' },

  // NSC sciences and commerce
  { name: 'Physical Sciences', level: 'SCHOOL' },
  { name: 'Life Sciences', level: 'SCHOOL' },
  { name: 'Agricultural Sciences', level: 'SCHOOL' },
  { name: 'Geography', level: 'SCHOOL' },
  { name: 'Accounting', level: 'SCHOOL' },
  { name: 'Business Studies', level: 'SCHOOL' },
  { name: 'Economics', level: 'SCHOOL' },
  { name: 'History', level: 'SCHOOL' },

  // NSC technical and vocational
  { name: 'Information Technology', level: 'SCHOOL' },
  { name: 'Computer Applications Technology', level: 'SCHOOL' },
  { name: 'Engineering Graphics and Design', level: 'SCHOOL' },
  { name: 'Mechanical Technology', level: 'SCHOOL' },
  { name: 'Electrical Technology', level: 'SCHOOL' },
  { name: 'Civil Technology', level: 'SCHOOL' },
  { name: 'Technical Mathematics', level: 'SCHOOL' },
  { name: 'Technical Sciences', level: 'SCHOOL' },

  // NSC arts and services
  { name: 'Visual Arts', level: 'SCHOOL' },
  { name: 'Dramatic Arts', level: 'SCHOOL' },
  { name: 'Music', level: 'SCHOOL' },
  { name: 'Design', level: 'SCHOOL' },
  { name: 'Consumer Studies', level: 'SCHOOL' },
  { name: 'Hospitality Studies', level: 'SCHOOL' },
  { name: 'Tourism', level: 'SCHOOL' },
];
