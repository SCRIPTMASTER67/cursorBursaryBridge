/**
 * The Vercel build.
 *
 * Vercel injects the database connection under whatever name the attached
 * store chooses -- a Prisma Postgres store writes `<prefix>_POSTGRES_URL`,
 * `<prefix>_DATABASE_URL` and `<prefix>_PRISMA_DATABASE_URL`, none of which is
 * the plain `DATABASE_URL` this application reads. Those values are stored as
 * Sensitive, so they cannot be read back and copied into a variable of the
 * right name; they can only be used from inside the build. This resolves them
 * here instead.
 *
 * Two of the three are unusable. `prisma+postgres://` is an Accelerate URL and
 * needs a client extension this project does not use, so only a value with a
 * plain postgres scheme is accepted, and the first one found wins.
 *
 * The same URL is used for the migration connection. A pooled connection
 * breaks `prisma migrate deploy` -- it multiplexes statements across backends,
 * which defeats the advisory locks migrations take -- so where the two differ,
 * the direct one must be used for both rather than the pooled one.
 *
 * Nothing here prints a connection string. Only the name of the variable it
 * came from is logged, so a build log can be shared without leaking anything.
 */
import { execSync } from 'node:child_process';

const CANDIDATES = [
  'DIRECT_DATABASE_URL',
  'DATABASE_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL',
  ...Object.keys(process.env).filter((k) => /_POSTGRES_URL$/.test(k)),
  ...Object.keys(process.env).filter((k) => /_DATABASE_URL$/.test(k)),
];

const usable = (value) =>
  typeof value === 'string' && /^postgres(ql)?:\/\//.test(value.trim());

const found = CANDIDATES.find((key) => usable(process.env[key]));

if (!found) {
  console.error(
    '\nNo usable PostgreSQL connection string was found.\n' +
      'Looked at: ' + CANDIDATES.join(', ') + '\n' +
      'One of them must hold a postgres:// or postgresql:// URL. A\n' +
      'prisma+postgres:// value is an Accelerate URL and cannot be used here.\n',
  );
  process.exit(1);
}

const url = process.env[found].trim();
console.log(`[build] database connection taken from ${found}`);

const env = { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url };
const run = (command, { optional = false } = {}) => {
  console.log(`\n[build] ${command}`);
  try {
    execSync(command, { stdio: 'inherit', env });
  } catch (error) {
    if (!optional) throw error;
    console.warn(`[build] ${command} did not finish; continuing.`);
  }
};

run('npx prisma migrate deploy');

// Reference data and the bursary snapshot both upsert, so every deploy repeats
// them harmlessly. They are optional: a seed that cannot finish should leave
// the site buildable rather than block the deployment entirely.
run('npx tsx prisma/seed.ts', { optional: true });
run('npx tsx scripts/import-snapshot.ts', { optional: true });

run('npx prisma generate');
run('npx next build');
