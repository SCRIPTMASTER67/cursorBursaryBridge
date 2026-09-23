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
/**
 * ZA Bursaries.
 *
 * The site is organised in three layers: a homepage of categories, a category
 * page per field of study listing individual bursaries, and a page per
 * bursary. Only the third layer is an opportunity, and telling the layers
 * apart is most of this adapter's job — an earlier version treated any page
 * with a heading as a bursary, which turned "How to Apply for a Bursary:
 * Step-by-Step Guide" into a funding opportunity offered by an organisation
 * called "How to Apply for a". A student cannot apply to an article.
 *
 * A bursary page carries a recognisable set of questions as its section
 * headings ("WHAT IS THE CLOSING DATE FOR THE … BURSARY?", "HOW CAN I APPLY
 * …?"). Those headings are what the fields are read from, because this site
 * does not use "Closing date: …" anywhere — it answers a question under a
 * heading, and a label-matching parser finds nothing.
 */

/** A URL of the shape /<field>-bursaries-south-africa/<bursary-slug>/. */
function isDetailUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    if (!/zabursaries\.co\.za$/i.test(hostname.replace(/^www\./, ''))) return false;
    const segments = pathname.split('/').filter(Boolean);
    return segments.length === 2 && /-(bursaries|scholarships)-south-africa$/i.test(segments[0]);
  } catch {
    return false;
  }
}

/** The text under one of the page's question headings. */
function sectionText($: cheerio.CheerioAPI, heading: RegExp): string | undefined {
  let found: string | undefined;
  $('h2, h3').each((_, element) => {
    if (found) return;
    const $heading = $(element);
    if (!heading.test($heading.text())) return;

    const parts: string[] = [];
    let node = $heading.next();
    // Everything up to the next heading belongs to this question.
    while (node.length > 0 && !/^h[23]$/i.test(node.prop('tagName') ?? '')) {
      parts.push(node.text());
      node = node.next();
    }
    const text = tidy(parts.join(' '));
    if (text) found = text;
  });
  return found;
}

/** The first off-site link under a heading: where the student actually applies. */
function sectionLink($: cheerio.CheerioAPI, heading: RegExp, pageUrl: string): string | undefined {
  let found: string | undefined;
  $('h2, h3').each((_, element) => {
    if (found) return;
    const $heading = $(element);
    if (!heading.test($heading.text())) return;

    let node = $heading.next();
    while (node.length > 0 && !/^h[23]$/i.test(node.prop('tagName') ?? '')) {
      const links = node.is('a') ? node : node.find('a[href]');
      links.each((_index, anchor) => {
        if (found) return;
        const href = safeUrl(absolute($(anchor).attr('href'), pageUrl));
        // The publication links back to itself constantly; the funder's own
        // application page is the one that leaves the site.
        if (href && hostOf(href) !== hostOf(pageUrl)) found = href;
      });
      node = node.next();
    }
  });
  return found;
}

/**
 * The first sentence of an answer.
 *
 * The closing-date section answers with the date and then a warning about
 * late applications. Only the first sentence is the deadline; keeping the rest
 * would put a paragraph where the card shows a date.
 */
function firstSentence(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = /^[\s\S]{3,160}?[.!?](?=\s|$|\()/.exec(text.trim());
  return tidy(match ? match[0] : text.slice(0, 160)) || undefined;
}

const CLOSING_DATE = /closing date|when (?:is|does).*close|deadline/i;
const ELIGIBILITY = /eligibility|requirements|who (?:can|qualifies)|minimum (?:entry )?criteria/i;
const HOW_TO_APPLY = /how (?:can i|do i|to) apply|application process/i;
const DOCUMENTS = /documents?/i;
const FIELDS_OF_STUDY = /fields? of study|what (?:courses|fields)|which fields/i;
const ABOUT = /what does .* do\?/i;

function parseZaBursaries(html: string, pageUrl: string, source: RegisteredSource): ParseResult {
  const $ = cheerio.load(html);
  const readAt = new Date();

  // Only links to individual bursary pages are worth following. Category and
  // advice pages are where those links come from, not opportunities.
  //
  // Read from the article where there is one: every page on this site carries
  // a menu linking to all ~980 bursaries, so taking links document-wide would
  // mean a category page about accounting handed back the whole site in menu
  // order, and the first pages followed would have nothing to do with the
  // list the reader is actually on.
  const article = $('article').first();
  const anchors = article.length > 0 ? article.find('a[href]') : $('a[href]');
  const detailLinks = unique(
    anchors
      .map((_, a) => safeUrl(absolute($(a).attr('href'), pageUrl)))
      .get()
      .filter((href): href is string => Boolean(href))
      .filter(isDetailUrl),
  );

  const title = tidy($('h1').first().text() || $('title').first().text());
  if (!title) return { opportunities: [], detailLinks };

  const bodyText = tidy($('article').text() || $('main').text() || $('body').text());

  // Two page shapes answer to this adapter. The publication writes a bursary
  // as answers under question headings; a funder's own page, reached from one
  // of those bursaries, usually writes "Closing date: …" inline. Each field
  // is taken from whichever of the two the page actually uses, and is left
  // unset when neither does.
  const closingDateText =
    firstSentence(sectionText($, CLOSING_DATE)) ??
    findLabelled(bodyText, /closing date|applications close|deadline/i);
  const requirementsText =
    sectionText($, ELIGIBILITY) ??
    findLabelled(bodyText, /requirements?|eligibility|who can apply/i);
  const howToApply = sectionText($, HOW_TO_APPLY);

  // On the publication's own site, what makes a page an opportunity rather
  // than a page about opportunities: it sits at a bursary URL, and it answers
  // at least two of the three questions a bursary page answers. A category
  // page listing forty bursaries answers none of them about itself, and
  // "How to Apply for a Bursary: Step-by-Step Guide" is an article.
  //
  // Elsewhere the URL says nothing, so the page is taken on its content, as
  // any other source's would be.
  const onPublication = /zabursaries\.co\.za$/i.test(hostOf(pageUrl));
  if (onPublication) {
    const answers = [closingDateText, requirementsText, howToApply].filter(Boolean).length;
    if (!isDetailUrl(pageUrl) || answers < 2) return { opportunities: [], detailLinks };
  }

  const about = sectionText($, ABOUT);
  const summary = about ?? tidy($('article p, main p, .entry-content p').first().text());

  const opportunity: RawOpportunity = {
    title,
    organisationName: organisationFromTitle(title),
    sourceUrl: pageUrl,
    sourceName: source.name,
    sourceType: source.type,
    official: source.official,
    description: summary ? summary.slice(0, SUMMARY_LIMIT) : undefined,
    closingDateText,
    openDateText: findLabelled(bodyText, /opening date|applications open/i),
    statusText: findStatusWording(bodyText),
    fieldsOfStudyText:
      sectionText($, FIELDS_OF_STUDY) ??
      findLabelled(bodyText, /fields? of study|courses? covered|study fields?/i),
    requirementsText,
    documentsText:
      sectionText($, DOCUMENTS) ??
      findLabelled(bodyText, /documents? required|supporting documents?/i),
    // Stated inside the eligibility answer ("a minimum overall average of
    // 65%"), never guessed from a number elsewhere on the page.
    minAverageText: requirementsText,
    applicationUrl:
      sectionLink($, HOW_TO_APPLY, pageUrl) ?? findOfficialLink($, pageUrl, source.official),
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
