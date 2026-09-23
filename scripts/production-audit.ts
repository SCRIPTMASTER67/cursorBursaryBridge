/**
 * Production content audit.
 *
 * Two passes.
 *
 * The code pass looks for words that mark sample content, and reports every
 * occurrence with enough context to judge it. It does not try to be clever:
 * the point is to surface everything so a person decides, and a file that is
 * openly development-only is reported as such rather than hidden.
 *
 * The database pass is the one that matters for a deployment. Anything a
 * student could see is checked for a real organisation, a real source, and a
 * status that is actually supported by evidence.
 *
 *   npm run audit:production
 */
import '../lib/load-env';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { displayStatus } from '../lib/bursary-status';

const db = new PrismaClient();

const TERMS = [
  'lorem ipsum',
  'dummy',
  'placeholder',
  'mock',
  'fake',
  'example bursary',
  'sample bursary',
  'test bursary',
  'abc foundation',
  'xyz corporation',
  'coming soon',
  'todo',
];

/** Files that are openly development-only, and are expected to match. */
const DEVELOPMENT_ONLY = [
  'prisma/seed-demo.ts',
  'scripts/purge-mock-data.ts',
  'scripts/production-audit.ts',
  'scripts/fixtures/',
  'scripts/test-',
  'lib/ingest/validate.ts',
  'docs/',
];

type Category = 'user-visible' | 'code' | 'development-only';
type Finding = { file: string; line: number; term: string; text: string; category: Category };

/**
 * Where a match sits decides whether it matters.
 *
 * A prop called `placeholder`, a comment about a fake timer and a regex that
 * matches the words "coming soon" cannot appear to anybody. A quoted string
 * inside a page or a component can. Everything is reported either way, because
 * the requirement is to see all of it; only the third kind fails the audit.
 */
function categorise(file: string, rawLine: string, term: string): Category {
  if (DEVELOPMENT_ONLY.some((prefix) => file.startsWith(prefix))) return 'development-only';

  const line = rawLine.trim();
  // A comment cannot be rendered.
  if (/^(\/\/|\*|\/\*)/.test(line)) return 'code';
  // Neither can a property name, a JSX attribute name, a script name or a
  // regular expression. An attribute is named `placeholder=`, and the value
  // beside it is what a person reads -- the name itself never is.
  if (new RegExp(`\\b${escape(term)}\\??\\s*:`, 'i').test(line)) return 'code';
  if (new RegExp(`\\b${escape(term)}\\s*=`, 'i').test(line)) return 'code';
  if (/^"[a-z:]+":/.test(line)) return 'code';
  if (line.includes('RegExp') || /=\s*\//.test(line)) return 'code';

  const isUi = file.startsWith('app/') || file.startsWith('components/');
  if (!isUi) return 'code';

  // Only a quoted string or JSX text can reach a screen.
  const quoted = new RegExp(`['"\`>][^'"\`<]*${escape(term)}`, 'i');
  return quoted.test(line) ? 'user-visible' : 'code';
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanCode(): Finding[] {
  const files = execSync(
    "git ls-files '*.ts' '*.tsx' '*.prisma' '*.json' '*.md' | grep -v package-lock",
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);

  const findings: Finding[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, index) => {
      const lower = text.toLowerCase();
      for (const term of TERMS) {
        if (lower.includes(term)) {
          findings.push({
            file,
            line: index + 1,
            term,
            text: text.trim().slice(0, 140),
            category: categorise(file, text, term),
          });
        }
      }
    });
  }
  return findings;
}

async function main() {
  console.log('PRODUCTION CONTENT AUDIT\n' + '='.repeat(70));

  console.log('\n1. Source code\n');
  const findings = scanCode();
  const userFacing = findings.filter((f) => f.category === 'user-visible');
  const code = findings.filter((f) => f.category === 'code');
  const devOnly = findings.filter((f) => f.category === 'development-only');

  console.log(`  ${findings.length} occurrence(s) of sample-content wording in total.\n`);

  if (userFacing.length === 0) {
    console.log('  Text a production user could read:  none.');
  } else {
    console.log(`  Text a production user could read:  ${userFacing.length}\n`);
    for (const f of userFacing) {
      console.log(`    ${f.file}:${f.line}  [${f.term}]`);
      console.log(`      ${f.text}`);
    }
  }

  console.log(
    `\n  Identifiers, comments, regexes and script names: ${code.length}. ` +
      `These cannot be rendered.`,
  );
  for (const f of code) console.log(`    ${f.file}:${f.line}  [${f.term}]`);

  console.log(
    `\n  Files that never run in production: ${devOnly.length} occurrence(s) across the demo\n` +
      `  seed, the purge script, test fixtures, this audit and the validator that refuses\n` +
      `  such content.`,
  );
  const devFiles = [...new Set(devOnly.map((f) => f.file))];
  for (const file of devFiles) console.log(`    ${file}`);

  console.log('\n2. Database\n');

  const total = await db.fundingProgramme.count();
  const visible = await db.fundingProgramme.findMany({
    where: { status: { in: ['PUBLISHED', 'CLOSED'] } },
    select: {
      id: true,
      name: true,
      origin: true,
      sourceUrl: true,
      sourceName: true,
      availability: true,
      verificationStatus: true,
      lastVerifiedAt: true,
      closingDate: true,
      deadlineKind: true,
      organisation: { select: { name: true, origin: true } },
    },
  });

  console.log(`  Funding opportunities in total:       ${total}`);
  console.log(`  Visible to students:                  ${visible.length}`);

  const problems: string[] = [];

  for (const row of visible) {
    if (row.origin === 'EXTERNAL' && !row.sourceUrl) {
      problems.push(`"${row.name}" is externally sourced but has no source URL.`);
    }
    if (TERMS.some((t) => `${row.name} ${row.organisation.name}`.toLowerCase().includes(t))) {
      problems.push(`"${row.name}" (${row.organisation.name}) reads as sample content.`);
    }
    const shown = displayStatus(row);
    if (shown === 'OPEN' && row.origin === 'EXTERNAL' && !row.lastVerifiedAt) {
      problems.push(`"${row.name}" would show as OPEN without ever having been verified.`);
    }
    if (row.deadlineKind === 'FIXED' && row.closingDate === null && shown === 'OPEN') {
      problems.push(`"${row.name}" claims a fixed deadline but carries no date.`);
    }
  }

  const orphanOrgs = await db.organisation.count({
    where: { origin: 'EXTERNAL', sourceUrl: null },
  });
  if (orphanOrgs > 0) {
    problems.push(`${orphanOrgs} externally-recorded organisation(s) have no source URL.`);
  }

  const demoUsers = await db.user.count({
    where: { email: { contains: '@demo.bursarybridge.local' } },
  });
  if (demoUsers > 0) problems.push(`${demoUsers} demo account(s) still exist.`);

  const byStatus = new Map<string, number>();
  for (const row of visible) {
    const shown = displayStatus(row);
    byStatus.set(shown, (byStatus.get(shown) ?? 0) + 1);
  }
  console.log('\n  As shown to a student:');
  for (const [status, count] of [...byStatus].sort()) {
    console.log(`    ${status.padEnd(20)} ${count}`);
  }
  if (visible.length === 0) {
    console.log('    (none — the directory is empty)');
  }

  console.log('');
  if (problems.length === 0) {
    console.log('  No problems found in user-visible data.');
  } else {
    console.log(`  ${problems.length} problem(s):`);
    for (const p of problems) console.log(`    - ${p}`);
  }

  console.log('\n' + '='.repeat(70));
  const failed = userFacing.length > 0 || problems.length > 0;
  console.log(failed ? 'AUDIT FAILED' : 'AUDIT PASSED');

  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
