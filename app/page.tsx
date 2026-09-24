import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/landing/site-header';
import { HeroMedia } from '@/components/landing/hero-media';
import { Parallax } from '@/components/landing/parallax';
import { Reveal } from '@/components/landing/reveal';
import { directoryTotals } from '@/services/bursary-directory';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowRight,
  Bell,
  Building,
  CheckCircle,
  ClipboardList,
  Clock,
  GraduationCap,
  Globe,
  Search,
  ShieldCheck,
  Target,
  Users,
  Wallet,
} from '@/components/icons';

export const metadata: Metadata = {
  title: 'Find funding. Build your future.',
};

/**
 * The hero states how many bursaries are open, so the page has to be built
 * against the database rather than baked at deploy time. An hour is fresh
 * enough for a figure that moves when a deadline passes, and keeps the landing
 * page a cached render rather than a query per visitor.
 */
export const revalidate = 3600;

const audiences = [
  {
    icon: <GraduationCap className="h-5 w-5" />,
    tone: 'bg-brand-50 text-brand-600',
    title: 'For Students',
    body: 'Discover opportunities that match your studies and goals. Apply once, reuse your profile, and track your applications in one place.',
    cta: { label: 'Explore as a student', href: '/register/student' },
  },
  {
    icon: <Building className="h-5 w-5" />,
    tone: 'bg-success-50 text-success-600',
    title: 'For Organisations',
    body: 'Manage funding programmes efficiently, reach the right students, and make a lasting impact in your communities.',
    cta: { label: 'Explore as an organisation', href: '/register/organisation' },
  },
  {
    icon: <Users className="h-5 w-5" />,
    tone: 'bg-warning-50 text-warning-600',
    title: 'For Education',
    body: 'Help your students access more opportunities and track outcomes that drive real change across your institution.',
    cta: { label: 'Learn more', href: '/#about' },
  },
];

const steps = [
  {
    title: 'Create your profile',
    body: 'Tell us about your studies, achievements and what funding you need.',
  },
  {
    title: 'Get matched',
    body: 'We match you with relevant bursaries and funding opportunities.',
  },
  {
    title: 'Apply & track',
    body: 'Apply with one click and track your applications in real time.',
  },
];

const benefits = [
  {
    icon: <Target className="h-5 w-5" />,
    title: 'Personalised matches',
    body: 'Get opportunities that match your course, institution, achievements and financial needs.',
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    title: 'One profile, many applications',
    body: 'Apply to multiple opportunities without repeating your information.',
  },
  {
    icon: <Search className="h-5 w-5" />,
    title: 'Application tracking',
    body: 'Track your applications, deadlines and responses all in one dashboard.',
  },
  {
    icon: <Bell className="h-5 w-5" />,
    title: 'Deadline reminders',
    body: 'Never miss a deadline with smart email reminders and notifications.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Trusted & secure',
    body: 'Your data is protected and used responsibly. We never share your information.',
  },
  {
    icon: <Wallet className="h-5 w-5" />,
    title: 'It’s free',
    body: 'Bursary-Bridge is and will always be free for students.',
  },
];

/**
 * How the directory is sourced.
 *
 * Each of these is a statement about the implementation rather than a claim
 * about our popularity, which is the only kind of claim we can make honestly.
 */
const provenance = [
  {
    icon: <Globe className="h-5 w-5" />,
    title: 'Read from published sources',
    body: 'Opportunities are collected from public bursary listings and the funders’ own pages — never written by us, and never invented to fill a page.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Every listing shows its source',
    body: 'Each bursary carries a link to the page it came from and the date it was last checked, so you can confirm anything before you apply.',
  },
  {
    icon: <Clock className="h-5 w-5" />,
    title: 'Closed bursaries stay visible',
    body: 'A bursary that has closed is marked CLOSED rather than hidden, so you can see what exists and plan for when it opens again.',
  },
];

export default async function LandingPage() {
  // A real count, or nothing. If the directory is empty the hero says 0, which
  // is the truth, and the empty state elsewhere explains why.
  const { counts } = await directoryTotals();
  const openCount = counts.OPEN + counts.CLOSING_SOON;

  return (
    <>
      <SiteHeader />

      <main id="main">
        {/* ---------------------------------------------------------------- Hero
         *
         * The entrance is staged rather than simultaneous: eyebrow, headline,
         * rule, paragraph, buttons, assurances, artwork — each a beat behind
         * the last. Every element animates from its final position, so the
         * hero never reflows and the buttons are clickable from the first
         * frame. With reduced motion asked for, the whole sequence resolves
         * instantly and nothing is lost but the movement.
         */}
        <section className="border-b border-line bg-surface-cream">
          <div className="mx-auto grid max-w-shell items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-20">
            <Parallax speed={0.07} max={44}>
              <span className="inline-flex animate-rise-in items-center rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-brand-700 [animation-delay:60ms]">
                Connecting Talent. Funding Futures.
              </span>

              <h1 className="mt-6 animate-rise-in text-display font-bold text-ink [animation-delay:140ms]">
                Real opportunities.
                <br />
                <span className="text-brand-600">A brighter tomorrow.</span>
              </h1>

              {/* The coral rule from the reference, drawn in rather than
                  appearing, which is what makes it read as underlining the
                  headline rather than decorating it. */}
              <span
                aria-hidden="true"
                className="mt-6 block h-[3px] w-28 origin-left animate-draw-rule rounded-full bg-accent-500 [animation-delay:320ms]"
              />

              <p className="mt-6 max-w-lg animate-rise-in text-[15px] leading-7 text-ink-500 [animation-delay:240ms]">
                Bursary-Bridge connects students with bursaries, scholarships and funding
                opportunities and helps organisations invest in tomorrow’s leaders.
              </p>

              <div className="mt-8 flex animate-rise-in flex-col gap-3 [animation-delay:340ms] sm:flex-row">
                <ButtonLink
                  href="/register/student"
                  size="lg"
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  I’m a Student
                </ButtonLink>
                <ButtonLink
                  href="/register/organisation"
                  size="lg"
                  variant="outline"
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  I’m an Organisation
                </ButtonLink>
              </div>

              {/* Statements about how the product works, not statistics. There
                  is no "10,000 students" here, because that number would have
                  to be invented. */}
              <ul className="mt-8 flex animate-rise-in flex-wrap items-center gap-x-7 gap-y-3 [animation-delay:440ms]">
                {[
                  { icon: <CheckCircle className="h-4 w-4" />, label: 'Free for students' },
                  {
                    icon: <ShieldCheck className="h-4 w-4" />,
                    label: 'Verified against the source',
                  },
                  { icon: <Globe className="h-4 w-4" />, label: 'Opportunities nationwide' },
                ].map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-2 text-[13px] font-medium text-ink-500"
                  >
                    <span className="text-brand-600">{item.icon}</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </Parallax>

            <Parallax speed={-0.05} max={36} className="animate-scale-in [animation-delay:260ms]">
              <HeroMedia openCount={openCount} />
            </Parallax>
          </div>
        </section>

        {/* ------------------------------------------------ Audience value cards */}
        <section id="for-organisations" className="border-b border-line bg-surface-muted">
          <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
            <Parallax speed={0.05} max={28} className="mx-auto max-w-2xl">
              <Reveal className="text-center">
                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[30px]">
                  A better way to connect funding with talent
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-ink-500">
                  Bursary-Bridge makes the journey simple, transparent and impactful for everyone.
                </p>
              </Reveal>
            </Parallax>

            {/* Each card a beat behind the one before it: enough to read as
                deliberate, not enough to make anyone wait. */}
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {audiences.map((audience, index) => (
                <Reveal key={audience.title} delay={index * 90} className="flex">
                  <Card className="group flex w-full flex-col p-6 transition duration-300 ease-entrance hover:-translate-y-1 hover:shadow-elevated">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-field ${audience.tone}`}
                    >
                      {audience.icon}
                    </span>
                    <h3 className="mt-5 text-base font-semibold text-ink">{audience.title}</h3>
                    <p className="mt-2 flex-1 text-[13px] leading-6 text-ink-500">
                      {audience.body}
                    </p>
                    <Link
                      href={audience.cta.href}
                      className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {audience.cta.label}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-entrance group-hover:translate-x-1" />
                    </Link>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- How it works */}
        <section id="how-it-works" className="border-b border-line bg-white">
          <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
            <Parallax speed={0.05} max={28} className="mx-auto max-w-2xl">
              <Reveal className="text-center">
                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[30px]">
                  How it works
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-ink-500">
                  Three simple steps for students to find and apply for funding.
                </p>
              </Reveal>
            </Parallax>

            <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
              {steps.map((step, index) => (
                <Reveal as="li" key={step.title} delay={index * 110} className="relative">
                  <StepArtwork index={index} />
                  <div className="mt-6 flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">{step.title}</h3>
                      <p className="mt-1.5 text-[13px] leading-6 text-ink-500">{step.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ol>

            <div className="mt-12 flex justify-center">
              <ButtonLink href="/register/student" variant="outline" size="lg">
                Create your free account
              </ButtonLink>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- Student benefits */}
        <section id="opportunities" className="border-b border-line bg-surface-muted">
          <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
            <Parallax speed={0.05} max={28} className="mx-auto max-w-2xl">
              <Reveal className="text-center">
                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[30px]">
                  Why students love Bursary-Bridge
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-ink-500">
                  Everything you need to find opportunities and reach your goals.
                </p>
              </Reveal>
            </Parallax>

            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((benefit, index) => (
                <Reveal key={benefit.title} delay={index * 70} className="group text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition duration-300 ease-entrance group-hover:scale-105 group-hover:bg-brand-100">
                    {benefit.icon}
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-ink">{benefit.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-[13px] leading-6 text-ink-500">
                    {benefit.body}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Where the data is from
         *
         * This replaced a testimonial wall and a row of partner logos. Both
         * were invented — quotes attributed to named students at named
         * universities, and six funders that do not exist — and invented
         * social proof on a page asking students to trust us with their
         * funding search is the one thing this product cannot afford. What
         * follows is true of the implementation and checkable by anyone.
         */}
        <section id="about" className="border-b border-line bg-surface-cream">
          <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
            <Parallax speed={0.05} max={28} className="mx-auto max-w-2xl">
              <Reveal className="text-center">
                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[30px]">
                  Where the opportunities come from
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-ink-500">
                  Every bursary on Bursary-Bridge was read from a published source, and says so.
                </p>
              </Reveal>
            </Parallax>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {provenance.map((item, index) => (
                <Reveal key={item.title} delay={index * 90}>
                  <Card className="h-full p-6 transition duration-300 ease-entrance hover:-translate-y-1 hover:shadow-elevated">
                    <span className="flex h-11 w-11 items-center justify-center rounded-field bg-brand-50 text-brand-600">
                      {item.icon}
                    </span>
                    <h3 className="mt-5 text-base font-semibold text-ink">{item.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-ink-500">{item.body}</p>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- Final CTA */}
        <section className="bg-white px-5 py-14 sm:px-8">
          <div className="mx-auto flex max-w-shell flex-col items-start justify-between gap-6 rounded-panel bg-brand-600 px-7 py-9 sm:px-10 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-[22px] font-bold tracking-[-0.02em] text-white sm:text-2xl">
                Ready to take the next step?
              </h2>
              <p className="mt-2 max-w-xl text-[13px] leading-6 text-brand-100">
                Create a free profile, see what you qualify for, and apply without filling in the
                same details over and over.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink
                href="/register/student"
                className="bg-white text-brand-700 shadow-none hover:bg-brand-50"
                trailingIcon={<ArrowRight className="h-4 w-4" />}
              >
                I’m a Student
              </ButtonLink>
              <ButtonLink
                href="/register/organisation"
                className="border border-white/40 bg-transparent text-white shadow-none hover:bg-white/10"
                trailingIcon={<ArrowRight className="h-4 w-4" />}
              >
                I’m an Organisation
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/** Small abstract UI vignettes standing in for the reference's step artwork. */
function StepArtwork({ index }: { index: number }) {
  return (
    <div className="flex h-[152px] items-center justify-center rounded-card border border-line bg-surface-muted p-5">
      <svg viewBox="0 0 180 100" className="h-full w-full" fill="none" aria-hidden="true">
        <rect x="18" y="10" width="144" height="80" rx="8" className="fill-white stroke-line" />
        {index === 0 && (
          <>
            <circle cx="46" cy="38" r="11" className="fill-brand-100" />
            <path
              d="M38 56c0-5 4-8 8-8s8 3 8 8"
              className="stroke-brand-600"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <rect x="66" y="30" width="76" height="7" rx="3.5" className="fill-brand-100" />
            <rect x="66" y="45" width="56" height="7" rx="3.5" className="fill-surface-subtle" />
            <rect x="38" y="68" width="104" height="7" rx="3.5" className="fill-surface-subtle" />
            <circle cx="140" cy="72" r="13" className="fill-success-600" />
            <path
              d="m134.5 72 4 4 7-7.5"
              stroke="white"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {index === 1 && (
          <>
            <rect
              x="32"
              y="24"
              width="116"
              height="20"
              rx="6"
              className="fill-surface-muted stroke-line"
            />
            <rect x="40" y="31" width="52" height="6" rx="3" className="fill-brand-200" />
            <rect
              x="118"
              y="29"
              width="22"
              height="10"
              rx="5"
              className="fill-success-600"
              opacity="0.16"
            />
            <rect
              x="32"
              y="50"
              width="116"
              height="20"
              rx="6"
              className="fill-surface-muted stroke-line"
            />
            <rect x="40" y="57" width="66" height="6" rx="3" className="fill-brand-100" />
            <rect
              x="118"
              y="55"
              width="22"
              height="10"
              rx="5"
              className="fill-brand-600"
              opacity="0.16"
            />
          </>
        )}
        {index === 2 && (
          <>
            <rect x="34" y="24" width="112" height="9" rx="4.5" className="fill-brand-100" />
            <rect x="34" y="41" width="86" height="7" rx="3.5" className="fill-surface-subtle" />
            <rect x="34" y="55" width="96" height="7" rx="3.5" className="fill-surface-subtle" />
            <circle cx="126" cy="70" r="13" className="fill-brand-600" opacity="0.12" />
            <circle cx="124" cy="68" r="7" className="stroke-brand-600" strokeWidth="2.4" />
            <path
              d="m129.5 73.5 5 5"
              className="stroke-brand-600"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}
