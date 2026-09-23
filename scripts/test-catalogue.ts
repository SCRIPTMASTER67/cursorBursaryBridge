/** Canonical-name checks. These decide whether two catalogue entries are one. */
import { canonicalise, isUsableName, tidyName } from '../lib/catalogue';

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

console.log('\nSpelling noise collapses');
check(
  'trailing space',
  canonicalise('University of Johannesburg ') === canonicalise('University of Johannesburg'),
);
check('case', canonicalise('UNIVERSITY OF PRETORIA') === canonicalise('University of Pretoria'));
check(
  'punctuation',
  canonicalise('St. Augustine College') === canonicalise('St Augustine College'),
);
check('en dash vs hyphen', canonicalise('Wits–Johannesburg') === canonicalise('Wits-Johannesburg'));
check('double spaces', canonicalise('Computer  Science') === canonicalise('Computer Science'));
check('accents', canonicalise('Université') === canonicalise('Universite'));
check('ampersand', canonicalise('Science & Technology') === canonicalise('Science and Technology'));

console.log('\nGenuinely different names stay different');
check(
  'two universities',
  canonicalise('University of Cape Town') !== canonicalise('University of the Western Cape'),
);
check(
  'an abbreviation is not merged',
  canonicalise('UJ') !== canonicalise('University of Johannesburg'),
);
check('two courses', canonicalise('Computer Science') !== canonicalise('Computer Engineering'));

console.log('\nUnusable names are refused');
check('empty', !isUsableName(''));
check('whitespace', !isUsableName('   '));
check('punctuation only', !isUsableName('---'));
check('digits only', !isUsableName('2026'));
check('a single letter', !isUsableName('A'));
check('a real name is usable', isUsableName('Mathematics'));

console.log('\nStored names keep their casing');
check('casing preserved', tidyName('  University  of   Pretoria ') === 'University of Pretoria');

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);
