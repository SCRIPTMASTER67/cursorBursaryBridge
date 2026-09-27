/**
 * Find the PostgreSQL connection string.
 *
 * A managed platform injects the database connection under a name of its own
 * choosing. A Prisma Postgres store on Vercel, for instance, writes
 * `<prefix>_POSTGRES_URL`, `<prefix>_DATABASE_URL` and
 * `<prefix>_PRISMA_DATABASE_URL`, none of which is the plain `DATABASE_URL`
 * this application reads — and those values are stored as Sensitive, so they
 * cannot be read back and copied into a variable of the right name. The
 * connection can only be found from inside the running process, which is what
 * this does.
 *
 * Two of the three names a Prisma Postgres store provides hold a
 * `prisma+postgres://` Accelerate URL, which needs a client extension this
 * project does not use. So the scheme decides, not the name: the first
 * candidate holding a plain postgres URL wins, and an Accelerate URL is passed
 * over rather than handed to a client that cannot open it.
 *
 * `DATABASE_URL` is still preferred when it is usable, so an explicitly
 * configured connection always beats a platform-injected one.
 */
const PLAIN_POSTGRES = /^postgres(ql)?:\/\//;

export function resolveDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const named = [
    'DATABASE_URL',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_URL',
    'DIRECT_DATABASE_URL',
  ];
  const prefixed = Object.keys(env).filter((key) => /_POSTGRES_URL$/.test(key));
  const fallback = Object.keys(env).filter((key) => /_DATABASE_URL$/.test(key));

  for (const key of [...named, ...prefixed, ...fallback]) {
    const value = env[key]?.trim();
    if (value && PLAIN_POSTGRES.test(value)) return value;
  }
  return undefined;
}
