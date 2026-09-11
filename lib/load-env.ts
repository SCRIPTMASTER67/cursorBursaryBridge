import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Read .env into process.env.
 *
 * Next.js loads .env for the application and the Prisma CLI loads it for
 * migrations, but a script executed through tsx gets neither. Prisma Client
 * happens to load it on newer Node versions, which hides the gap on a
 * developer machine and then fails on Node 18 with "Environment variable not
 * found: DATABASE_URL". Loading it explicitly removes the dependency on that
 * behaviour.
 *
 * Values already present in the real environment win, so CI and deployment
 * settings are never overwritten by a stray file.
 */
export function loadEnvFile(file = '.env'): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;

    let value = raw.trim();
    if (value.length >= 2 && /^(["']).*\1$/s.test(value)) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();
