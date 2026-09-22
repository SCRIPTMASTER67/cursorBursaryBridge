/**
 * Label-matching checks for the PDF auto-fill engine.
 *
 * Verifies the variations the specification calls out, and — just as
 * importantly — that ambiguous and third-party labels match nothing.
 */
import { defaultMatcher } from '../lib/pdf/match';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function expect(label: string, key: string | null, minConfidence?: 'HIGH' | 'MEDIUM' | 'LOW') {
  const result = defaultMatcher.match(label);
  const keyOk = result.key === key;
  const confOk =
    !minConfidence ||
    (result.confidence !== null &&
      ['LOW', 'MEDIUM', 'HIGH'].indexOf(result.confidence) >=
        ['LOW', 'MEDIUM', 'HIGH'].indexOf(minConfidence));
  if (keyOk && confOk) {
    passed += 1;
    console.log(
      `  PASS  ${label.padEnd(38)} -> ${result.key ?? 'none'} (${result.confidence ?? '-'})`,
    );
  } else {
    failed += 1;
    failures.push(label);
    console.log(
      `  FAIL  ${label.padEnd(38)} -> ${result.key ?? 'none'} (${result.confidence ?? '-'}) -- expected ${key ?? 'none'} ${minConfidence ?? ''} :: ${result.reason}`,
    );
  }
}

console.log('\nSurname variations (spec section 7)');
expect('Surname', 'lastName', 'HIGH');
expect('Family Name', 'lastName', 'HIGH');
expect('Last Name', 'lastName', 'HIGH');
expect("Applicant's Surname", 'lastName', 'MEDIUM');

console.log('\nDate of birth variations (spec section 7)');
expect('Date of Birth', 'dateOfBirth', 'HIGH');
expect('DOB', 'dateOfBirth', 'HIGH');
expect('Birth Date', 'dateOfBirth', 'HIGH');
expect('Applicant Date of Birth', 'dateOfBirth', 'MEDIUM');

console.log('\nFirst name and institution variations (spec section 12)');
expect('First Name', 'firstName', 'HIGH');
expect('Given Name', 'firstName', 'HIGH');
expect('Forename', 'firstName', 'HIGH');
expect('Institution', 'institution', 'HIGH');
expect('University', 'institution', 'HIGH');
expect('College', 'institution', 'HIGH');
expect('Tertiary Institution', 'institution', 'HIGH');
expect('Institution currently attending', 'institution', 'MEDIUM');

console.log('\nContact variations (spec section 11)');
expect('Mobile Number', 'mobile', 'HIGH');
expect('Cellphone Number', 'mobile', 'HIGH');
expect('Applicant Contact Number', 'mobile', 'MEDIUM');
expect('Mobile', 'mobile', 'HIGH');

console.log('\nThird-party labels must not map to the applicant');
expect('Parent/Guardian ID Number', null);
expect("Parent's Surname", null);
expect('Next of Kin Contact Number', null);
expect('Referee Email Address', null);
expect('Name of Institution', 'institution', 'MEDIUM');

console.log('\nAmbiguous or unknown labels must not be guessed');
expect('Office use only', null);
expect('Reference Number', null);
expect('', null);

console.log('\nRegressions found by the accuracy harness');
// "First Names" once matched fullName, which put the surname in a first-name box.
expect('First Names', 'firstName', 'HIGH');
expect('Given Names', 'firstName', 'HIGH');
expect('Other Names', null);
// A bare "Name" is genuinely ambiguous on a bursary form, so it is left alone.
expect('Name', null);
expect('Names', null);
// A leading "Applicant" states the default and should not weaken the match...
expect('Applicant Full Name', 'fullName', 'HIGH');
expect('Student Email Address', 'email', 'HIGH');
// ...but "Student Number" is not a number belonging to a student.
expect('Student Number', 'studentNumber', 'HIGH');
// Field names flatten "E-mail" to "E mail" when the hyphen is read as a separator.
expect('E mail Address', 'email', 'HIGH');

console.log('\nLonger phrase wins over shorter');
expect('Student Number', 'studentNumber', 'HIGH');
expect('Annual Household Income', 'householdIncome', 'HIGH');

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exitCode = failed > 0 ? 1 : 0;
