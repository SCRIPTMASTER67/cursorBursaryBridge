import * as cheerio from 'cheerio';
import type { RegisteredSource } from './source-registry';
import { contentHash } from './dedupe';
import { tidy } from './normalise';
import { safeUrl } from './validate';
import type { RawOpportunity } from './types';

/**
 * Reading a page into candidate opportunities.
 *
 * Extraction is deliberately literal. Each field is either found on the page
 * or left unset; nothing is inferred from context, and no field is filled from
 * another. A listing page that yields nothing yields nothing — that is a
 * result, not a reason to relax.
 *
 * Only the facts needed to describe and locate the opportunity are taken. The
 * funder's prose is not copied wholesale: a short summary is kept so the card
 * is readable, and the student is sent to the source for the full text.
 */

const SUMMARY_LIMIT = 400;

export type ParseResult = {
  opportunities: RawOpportunity[];
  /** Links worth following to a detail page, in listing order. */
  detailLinks: string[];
};

export function parseListing(html: string, pageUrl: string, source: RegisteredSource): ParseResult {
  return source.adapter === 'zabursaries'
    ? parseZaBursaries(html, pageUrl, source)
    : parseGenericListing(html, pageUrl, source);
}

/**
 * A listing page of article-like blocks.
 *
 * Works on the common shape: a heading that links to the opportunity, with
 * some text beside it. Anything that does not look like that is skipped rather
 * than forced into shape.
 */
function parseGenericListing(html: string, pageUrl: string, source: RegisteredSource): ParseResult {
  const $ = cheerio.load(html);
  const readAt = new Date();
  const opportunities: RawOpportunity[] = [];
  const detailLinks: string[] = [];

  $('article, .post, .entry, li.bursary, div.bursary').each((_, element) => {
    const block = $(element);
    const anchor = block.find('h1 a, h2 a, h3 a, a.title').first();
    const title = tidy(anchor.text() || block.find('h1, h2, h3').first().text());
    if (!title) return;

    const href = safeUrl(absolute(anchor.attr('href'), pageUrl));
    if (href) detailLinks.push(href);

    const body = tidy(block.find('p').first().text());

    opportunities.push({
      title,
      organisationName: organisationFromTitle(title),
      sourceUrl: href ?? pageUrl,
      sourceName: source.name,
      sourceType: source.type,
      official: source.official,
      description: body ? body.slice(0, SUMMARY_LIMIT) : undefined,
      closingDateText: findLabelled(block.text(), /closing date|deadline|applications close/i),
      openDateText: findLabelled(block.text(), /opening date|applications open/i),
      statusText: findStatusWording(block.text()),
      contentHash: contentHash([title, body, href]),
      readAt,
    });
  });

  return { opportunities, detailLinks: unique(detailLinks) };
}

/**
 * ZA Bursaries detail pages.
 *
 * The site publishes one page per bursary with the closing date and
 * requirements written as labelled lines. The adapter reads those labels; it
 * does not copy the page.
 */
function parseZaBursaries(html: string, pageUrl: string, source: RegisteredSource): ParseResult {
  const $ = cheerio.load(html);
  const readAt = new Date();

  const title = tidy($('h1').first().text() || $('title').first().text());
  const detailLinks = unique(
    $('a[href]')
      .map((_, a) => safeUrl(absolute($(a).attr('href'), pageUrl)))
      .get()
      .filter((href): href is string => Boolean(href))
      .filter((href) => /bursar|scholarship|grant/i.test(href)),
  );

  // A page with no heading is a listing or an index, not an opportunity.
  if (!title) return { opportunities: [], detailLinks };

  const bodyText = tidy($('article').text() || $('main').text() || $('body').text());
  const summary = tidy($('article p, main p, .entry-content p').first().text());

  const opportunity: RawOpportunity = {
    title,
    organisationName: organisationFromTitle(title),
    sourceUrl: pageUrl,
    sourceName: source.name,
    sourceType: source.type,
    official: source.official,
    description: summary ? summary.slice(0, SUMMARY_LIMIT) : undefined,
    closingDateText: findLabelled(bodyText, /closing date|applications close|deadline/i),
    openDateText: findLabelled(bodyText, /opening date|applications open/i),
    statusText: findStatusWording(bodyText),
    fieldsOfStudyText: findLabelled(bodyText, /fields? of study|courses? covered|study fields?/i),
    institutionsText: findLabelled(bodyText, /institutions?|universit/i),
    requirementsText: findLabelled(bodyText, /requirements?|eligibility|who can apply/i),
    documentsText: findLabelled(bodyText, /documents? required|supporting documents?/i),
    minAverageText: findLabelled(bodyText, /minimum average|academic average|aggregate/i),
    applicationUrl: findOfficialLink($, pageUrl, source.official),
    applicationFormUrl: findFormLink($, pageUrl),
    contentHash: contentHash([title, summary, bodyText.slice(0, 2000)]),
    readAt,
  };

  return { opportunities: [opportunity], detailLinks };
}

/**
 * The text that follows a label.
 *
 * Returns undefined when the label is not present. It does not fall back to
 * "the nearest date on the page", because the nearest date is frequently a
 * different bursary's.
 */
export function findLabelled(text: string, label: RegExp): string | undefined {
  const source = label.source;
  const pattern = new RegExp(`(?:${source})\\s*[:\\-–—]\\s*([^.\\n]{2,160})`, 'i');
  const match = pattern.exec(text);
  return match ? tidy(match[1]) || undefined : undefined;
}

/** A sentence stating whether applications are open, in the source's words. */
export function findStatusWording(text: string): string | undefined {
  const pattern =
    /[^.\n]{0,80}\b(applications?\s+(?:are\s+)?(?:now\s+)?(?:open|closed)|now\s+closed|now\s+open|closing\s+date\s+has\s+passed|opens?\s+on)\b[^.\n]{0,80}/i;
  const match = pattern.exec(text);
  return match ? tidy(match[0]) || undefined : undefined;
}

/**
 * Where the student actually applies.
 *
 * On a listing site the useful link is the one that leaves for the funder's
 * own site, so an on-site link is skipped. On the funder's own page the
 * opposite holds: its own "Apply" link is the best one there is.
 */
function findOfficialLink(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  sourceIsOfficial: boolean,
): string | undefined {
  const here = hostOf(pageUrl);
  const links = $('a[href]')
    .filter((_, a) => /apply|official|website|application/i.test($(a).text()))
    .map((_, a) => safeUrl(absolute($(a).attr('href'), pageUrl)))
    .get()
    .filter((href): href is string => Boolean(href))
    // A link to a form file is a form, not an application page.
    .filter((href) => !/\.pdf(\?|$)/i.test(href));

  if (sourceIsOfficial) return links[0] ?? undefined;
  return links.find((href) => hostOf(href) !== here);
}

/** A link to a downloadable application form. */
function findFormLink($: cheerio.CheerioAPI, pageUrl: string): string | undefined {
  const candidate = $('a[href]')
    .map((_, a) => safeUrl(absolute($(a).attr('href'), pageUrl)))
    .get()
    .find((href): href is string => Boolean(href) && /\.pdf(\?|$)/i.test(href));
  return candidate ?? undefined;
}

/**
 * Subjects that name what a bursary is FOR, not who is offering it.
 *
 * Only stripped when the word sits immediately before the funding word, which
 * is where a subject appears ("Holdings Engineering Bursary"). A company with
 * the word in its own name keeps it, because something else follows it there
 * ("Nkosi Engineering Trust Bursary").
 */
const SUBJECT_WORDS =
  /^(engineering|science|sciences|technology|medical|medicine|nursing|law|legal|accounting|accountancy|finance|financial|teaching|education|agriculture|agricultural|mining|geoscience|it|ict|computing|computer|pharmacy|veterinary|commerce|business|actuarial|architecture|construction|artisan|postgraduate|undergraduate|honours|masters|doctoral|bachelor|bachelors)$/i;

/**
 * The funder's name, taken from the start of the listing title.
 *
 * "Sasol Bursaries 2027" gives "Sasol". This is a reading of what the source
 * wrote, not a lookup: a title that does not name its funder clearly will
 * produce an imprecise name, and the record is refused rather than guessed at
 * when nothing usable is left. An official source later in the pipeline
 * outranks a listing and corrects it.
 */
export function organisationFromTitle(title: string): string {
  const cut = title.split(
    /\s+(?:bursar(?:y|ies)|scholarships?|grants?|programme|program|fund(?:ing)?)\b/i,
  )[0];
  let cleaned = tidy(cut.replace(/\b20\d{2}\b/g, ''));

  const words = cleaned.split(' ');
  if (words.length > 2 && SUBJECT_WORDS.test(words[words.length - 1])) {
    cleaned = words.slice(0, -1).join(' ');
  }

  return cleaned.length >= 2 ? cleaned : tidy(title);
}

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
