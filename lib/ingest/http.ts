import { USER_AGENT, mayFetch } from './robots';
import type { FetchOutcome } from './types';

/**
 * Fetching, politely.
 *
 * Every request identifies itself, waits its turn, gives up quickly, and stops
 * reading once a page is implausibly large. robots.txt is consulted first —
 * the only caller that skips that check is the one fetching robots.txt itself.
 *
 * When outbound network access is unavailable the difference matters: a run
 * that could not reach anything must say so, not report zero opportunities as
 * though the sources were empty.
 */

const DEFAULT_DELAY_MS = 2_000;
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 4 * 1024 * 1024;

/** Last request time per host, so the delay is per-site rather than global. */
const lastRequestAt = new Map<string, number>();

export type FetchOptions = {
  /** Only true for robots.txt itself. */
  skipRobots?: boolean;
  /** Overrides the default politeness delay, e.g. from Crawl-delay. */
  delayMs?: number;
};

export async function politeFetch(url: string, options: FetchOptions = {}): Promise<FetchOutcome> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return { ok: false, reason: `Not a valid URL: ${url}`, kind: 'error' };
  }

  let delay = options.delayMs ?? DEFAULT_DELAY_MS;

  if (!options.skipRobots) {
    const verdict = await mayFetch(url);
    if (!verdict.allowed) {
      return { ok: false, reason: verdict.reason, kind: 'blocked-by-robots' };
    }
    if (verdict.crawlDelaySeconds !== null) {
      delay = Math.max(delay, verdict.crawlDelaySeconds * 1000);
    }
  }

  await waitForTurn(origin, delay);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': `${USER_AGENT} (+https://bursarybridge.co.za/bot)`,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: `${response.status} ${response.statusText}`, kind: 'http' };
    }

    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_BYTES) {
      return { ok: false, reason: `Response is larger than ${MAX_BYTES} bytes.`, kind: 'error' };
    }

    const body = await readCapped(response);
    if (body === null) {
      return {
        ok: false,
        reason: `Response exceeded ${MAX_BYTES} bytes while reading.`,
        kind: 'error',
      };
    }

    return { ok: true, status: response.status, body, url: response.url || url };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: message,
      kind: looksLikeEgressBlock(message) ? 'no-egress' : 'error',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tell a policy block apart from a site being down.
 *
 * A proxy refusing the tunnel and a host that does not exist produce very
 * different follow-up actions, so the pipeline reports them differently.
 */
function looksLikeEgressBlock(message: string): boolean {
  return /403|407|proxy|tunnel|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|fetch failed|network/i.test(
    message,
  );
}

async function readCapped(response: Response): Promise<string | null> {
  if (!response.body) return await response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(concat(chunks, total));
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function waitForTurn(origin: string, delayMs: number) {
  const last = lastRequestAt.get(origin);
  if (last !== undefined) {
    const wait = last + delayMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt.set(origin, Date.now());
}
