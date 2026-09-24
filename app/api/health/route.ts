import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Liveness and readiness for whatever is running the container.
 *
 * A load balancer needs to know more than "the process answered": Next.js
 * serves pages perfectly well while the database is unreachable, and every one
 * of them then fails. So this actually asks the database a question. The query
 * is `SELECT 1` -- enough to prove the connection is up and a statement round
 * trips, without touching a table whose absence would make an otherwise
 * healthy instance look broken during a migration.
 *
 * 200 with ok:true means it is safe to send traffic here. 503 means it is not,
 * and the reason is included so whoever is paged does not have to guess.
 * Nothing about the deployment -- no connection string, no host name -- is in
 * the response, because this endpoint is unauthenticated by necessity.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[health] the database did not answer', error);
    return NextResponse.json(
      { ok: false, database: 'unreachable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { ok: true, database: 'ok', latencyMs: Date.now() - startedAt },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
}
