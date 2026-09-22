import { politeFetch } from './http';

/**
 * robots.txt, honoured rather than checked off.
 *
 * Nothing is fetched from a host until its robots.txt has been read and the
 * path checked against it. A disallowed path is not fetched — there is no
 * override, no "ignore robots" flag, and a host whose robots.txt cannot be
 * read at all is treated as disallowed rather than permitted.
 *
 * This is the rule that decides whether the pipeline may run at all, so it is
 * deliberately the most conservative part of it.
 */

export type RobotsRules = {
  /** Paths this agent may not fetch. */
  disallow: string[];
  /** Paths explicitly re-allowed inside a broader disallow. */
  allow: string[];
  /** Seconds the host asks callers to wait between requests. */
  crawlDelaySeconds: number | null;
  /** The raw file, kept so a decision can be shown to a person. */
  raw: string;
};

export type RobotsVerdict =
  | { allowed: true; crawlDelaySeconds: number | null }
  | { allowed: false; reason: string };

export const USER_AGENT = 'BursaryBridgeBot';

const cache = new Map<string, RobotsRules | 'unreadable'>();

/** Read and parse a host's robots.txt. Cached for the life of the process. */
export async function loadRobots(origin: string): Promise<RobotsRules | 'unreadable'> {
  const cached = cache.get(origin);
  if (cached) return cached;

  const result = await politeFetch(`${origin}/robots.txt`, { skipRobots: true });
  if (!result.ok) {
    cache.set(origin, 'unreadable');
    return 'unreadable';
  }

  const rules = parseRobots(result.body);
  cache.set(origin, rules);
  return rules;
}

/**
 * Parse the groups that apply to us: the ones for our agent, plus `*`.
 * A group naming our agent specifically takes precedence over the wildcard.
 */
export function parseRobots(text: string): RobotsRules {
  const lines = text.split(/\r?\n/);
  const groups: { agents: string[]; disallow: string[]; allow: string[]; delay: number | null }[] =
    [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const line of lines) {
    const withoutComment = line.split('#')[0].trim();
    if (!withoutComment) continue;
    const [rawKey, ...rest] = withoutComment.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'disallow') current.disallow.push(value);
    else if (key === 'allow') current.allow.push(value);
    else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n)) current.delay = n;
    }
  }

  const ours = groups.find((g) => g.agents.includes(USER_AGENT.toLowerCase()));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const chosen = ours ?? wildcard;

  return {
    disallow: chosen?.disallow ?? [],
    allow: chosen?.allow ?? [],
    crawlDelaySeconds: chosen?.delay ?? null,
    raw: text,
  };
}

/** Whether a URL may be fetched. An unreadable robots.txt means no. */
export async function mayFetch(url: string): Promise<RobotsVerdict> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: 'Not a valid URL.' };
  }
  if (parsed.protocol !== 'https:') {
    return { allowed: false, reason: 'Only HTTPS sources are fetched.' };
  }

  const rules = await loadRobots(parsed.origin);
  if (rules === 'unreadable') {
    return {
      allowed: false,
      reason: `robots.txt could not be read for ${parsed.origin}. Treated as disallowed.`,
    };
  }

  const path = `${parsed.pathname}${parsed.search}`;

  // An explicit Allow beats a Disallow when it is the more specific rule,
  // which is how the original specification resolves the two.
  const longestDisallow = longestMatch(rules.disallow, path);
  const longestAllow = longestMatch(rules.allow, path);

  if (longestDisallow !== null && (longestAllow === null || longestAllow < longestDisallow)) {
    return {
      allowed: false,
      reason: `robots.txt for ${parsed.origin} disallows ${path}.`,
    };
  }

  return { allowed: true, crawlDelaySeconds: rules.crawlDelaySeconds };
}

/** Length of the longest rule matching this path, or null if none match. */
function longestMatch(patterns: string[], path: string): number | null {
  let best: number | null = null;
  for (const pattern of patterns) {
    if (pattern === '') continue; // "Disallow:" with no value allows everything
    if (matches(pattern, path) && (best === null || pattern.length > best)) {
      best = pattern.length;
    }
  }
  return best;
}

/** robots.txt path matching, including `*` and a trailing `$`. */
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`).test(path);
}
