/**
 * Synthetic HTML fixtures for the ingestion pipeline.
 *
 * These are NOT bursaries and are never seeded. They exist so the parser,
 * normaliser, deduplicator, validator and conflict handling can be proven
 * without a network, and every organisation named here is invented for that
 * purpose. The test that uses them deletes everything it writes.
 *
 * Each page is shaped to exercise one thing the pipeline must get right.
 */

export const LISTING_URL = 'https://listing.test/bursaries/';
export const OFFICIAL_URL = 'https://ndlovu-test.example/careers/bursary';

/** A listing page carrying six entries, three of which must be refused. */
export const LISTING_PAGE = `<!doctype html><html><body>
<article>
  <h2><a href="/bursaries/ndlovu-engineering-2027">Ndlovu Test Holdings Engineering Bursary 2027</a></h2>
  <p>A bursary for undergraduate engineering students studying at a South African university.</p>
  <p>Closing date: 15 October 2027</p>
</article>
<article>
  <h2><a href="/bursaries/kalahari-rolling">Kalahari Test Trust Science Bursary</a></h2>
  <p>Supports science undergraduates.</p>
  <p>Closing date: Applications are accepted on a rolling basis throughout the year.</p>
</article>
<article>
  <h2><a href="/bursaries/mopane-closed">Mopane Test Group Accounting Bursary 2026</a></h2>
  <p>For students pursuing a Bachelor of Accounting.</p>
  <p>Closing date: 31 August 2026</p>
  <p>Applications are now closed for this cycle.</p>
</article>
<article>
  <h2><a href="/bursaries/no-deadline">Sefako Test Foundation Teaching Bursary</a></h2>
  <p>For students who intend to teach in rural schools.</p>
</article>

<!-- The three below must all be refused. -->
<article>
  <h2><a href="/bursaries/example">Example Bursary</a></h2>
  <p>Lorem ipsum dolor sit amet.</p>
</article>
<article>
  <h2><a href="/bursaries/abc">ABC Foundation Bursary 2027</a></h2>
  <p>Placeholder opportunity.</p>
</article>
<article>
  <h2><a href="/bursaries/blank">Apply</a></h2>
  <p></p>
</article>
</body></html>`;

/**
 * The same Ndlovu programme on the funder's own site, with a different closing
 * date. The official source must win and the disagreement must be recorded.
 */
export const OFFICIAL_PAGE = `<!doctype html><html><body>
<article>
  <h1>Ndlovu Test Holdings Engineering Bursary 2027</h1>
  <p>Full cost of study for engineering undergraduates.</p>
  <p>Closing date: 30 September 2027</p>
  <p>Applications are open.</p>
  <a href="https://ndlovu-test.example/apply">Apply online</a>
  <a href="https://ndlovu-test.example/forms/bursary-2027.pdf">Download the application form</a>
</article>
</body></html>`;

/** A near-duplicate of the same programme under a slightly different name. */
export const SECONDARY_DUPLICATE_PAGE = `<!doctype html><html><body>
<article>
  <h1>Ndlovu Test Holdings Engineering Bursary 2027</h1>
  <p>Engineering bursary.</p>
  <p>Closing date: 15 October 2027</p>
</article>
</body></html>`;

export const ROBOTS_ALLOW_ALL = 'User-agent: *\nDisallow:\n';
export const ROBOTS_DISALLOW_ALL = 'User-agent: *\nDisallow: /\n';
export const ROBOTS_PARTIAL = `User-agent: *
Disallow: /private/
Allow: /private/public-listing
Crawl-delay: 5

User-agent: BursaryBridgeBot
Disallow: /members/
`;
