import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/landing/site-header';
import { HeroIllustration } from '@/components/landing/hero-illustration';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowRight,
  Bell,
  Building,
  CheckCircle,
  ClipboardList,
  GraduationCap,
  Globe,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wallet,
} from '@/components/icons';

export const metadata: Metadata = {
  title: 'Find funding. Build your future.',
};

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

const testimonials = [
  {
    quote:
      'I found a bursary that covered my tuition and accommodation. Bursary-Bridge made the whole process so much easier!',
    name: 'Lerato M.',
    detail: 'University of Pretoria',
  },
  {
    quote:
      'I love that I can apply to many opportunities without filling in my details over and over again.',
    name: 'Sipho D.',
    detail: 'Wits University',
  },
  {
    quote:
      'The reminders and tracking feature helped me stay on top of all my applications.',
    name: 'Ayesha K.',
    detail: 'Stellenbosch University',
  },
];

/**
 * Demonstration funders.
 *
 * These are deliberately fictional. A prototype must not display real
 * companies as partners of a platform they have not endorsed.
 */
const demoPartners = [
  'Kgotso Holdings',
  'Umoya Energy',
  'Thuto Foundation',
  'Sizani Group',
  'Ubuntu Telecom',
  'Amandla Mining',
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main id="main">
        {/* ---------------------------------------------------------------- Hero */}
        <section className="border-b border-line bg-white">
          <div className="mx-auto grid max-w-shell items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-20">
            <div>
              <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
                Connecting Talent. Funding Futures.
              </span>

              <h1 className="mt-6 text-[38px] font-bold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[46px] lg:text-[52px]">
                Find funding.
                <br />
                <span className="text-brand-600">Build your future.</span>
              </h1>

              <p className="mt-5 max-w-lg text-[15px] leading-7 text-ink-500">
                Bursary-Bridge connects students with bursaries, scholarships and funding
                opportunities and helps organisations invest in tomorrow’s leaders.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/register/student" size="lg" trailingIcon={<ArrowRight className="h-4 w-4" />}>
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

              <ul className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
                {[
                  { icon: <CheckCircle className="h-4 w-4" />, label: 'Free for students' },
                  { icon: <Users className="h-4 w-4" />, label: 'Trusted by organisations' },
                  { icon: <Globe className="h-4 w-4" />, label: 'Opportunities nationwide' },
                ].map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-[13px] font-medium text-ink-500">
                    <span className="text-ink-400">{item.icon}</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>

            <HeroIllustration />
          </div>
        </section>

        {/* ------------------------------------------------ Audience value cards */}
        <section id="for-organisations" className="border-b border-line bg-surface-muted">
          <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[30px]">
                A better way to connect funding with talent
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-ink-400">
                Bursary-Bridge makes the journey simple, transparent and impactful for everyone.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {audiences.map((audience) => (
                <Card key={audience.title} className="flex flex-col p-6">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-[12px] ${audience.tone}`}>
                    {audience.icon}
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-ink">{audience.title}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-6 text-ink-400">{audience.body}</p>
                  <Link
                    href={audience.cta.href}
                    className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {audience.cta.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- How it works */}
        <section id="how-it-works" className="border-b border-line bg-white">
          <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[30px]">How it works</h2>
              <p className="mt-3 text-[15px] leading-7 text-ink-400">
                Three simple steps for students to find and apply for funding.
              </p>
            </div>

            <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
              {steps.map((step, index) => (
                <li key={step.title} className="relative">
                  <StepArtwork index={index} />
                  <div className="mt-6 flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">{step.title}</h3>
                      <p className="mt-1.5 text-[13px] leading-6 text-ink-400">{step.body}</p>
                    </div>
                  </div>
                </li>
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
        <section id="opportunities" className="border-b border-line bg-white">
          <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[30px]">
                Why students love Bursary-Bridge
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-ink-400">
                Everything you need to find opportunities and reach your goals.
              </p>
            </div>

            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    {benefit.icon}
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-ink">{benefit.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-[13px] leading-6 text-ink-400">{benefit.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- Testimonials */}
        <section id="about" className="border-b border-line bg-surface-muted">
          <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[30px]">
                Real students. Real impact.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-ink-400">
                Hear from students who found opportunities through Bursary-Bridge.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.name} className="p-6">
                  <span aria-hidden="true" className="text-2xl font-bold leading-none text-brand-200">
                    “
                  </span>
                  <blockquote className="mt-3 text-[13px] leading-6 text-ink-600">
                    {testimonial.quote}
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                      {testimonial.name.charAt(0)}
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold text-ink">{testimonial.name}</span>
                      <span className="block text-xs text-ink-400">{testimonial.detail}</span>
                    </span>
                  </figcaption>
                </Card>
              ))}
            </div>

            {/* ------------------------------------------------------- Partners */}
            <div className="mt-16 text-center">
              <h3 className="text-lg font-bold text-ink">Our partners</h3>
              <p className="mt-2 text-[13px] text-ink-400">
                Demonstration funders shown for this prototype.
              </p>
              <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
                {demoPartners.map((partner) => (
                  <li
                    key={partner}
                    className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink-300"
                  >
                    <Sparkles className="h-4 w-4" />
                    {partner}
                  </li>
                ))}
              </ul>
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
                Join thousands of students finding funding and organisations building brighter futures.
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
        <rect x="18" y="10" width="144" height="80" rx="8" fill="#FFFFFF" stroke="#E8E8F0" />
        {index === 0 && (
          <>
            <circle cx="46" cy="38" r="11" fill="#EBE6FD" />
            <path d="M38 56c0-5 4-8 8-8s8 3 8 8" stroke="#5B2EDB" strokeWidth="2.4" strokeLinecap="round" />
            <rect x="66" y="30" width="76" height="7" rx="3.5" fill="#EBE6FD" />
            <rect x="66" y="45" width="56" height="7" rx="3.5" fill="#F4F4F9" />
            <rect x="38" y="68" width="104" height="7" rx="3.5" fill="#F4F4F9" />
            <circle cx="140" cy="72" r="13" fill="#12874A" />
            <path d="m134.5 72 4 4 7-7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {index === 1 && (
          <>
            <rect x="32" y="24" width="116" height="20" rx="6" fill="#F8F8FC" stroke="#E8E8F0" />
            <rect x="40" y="31" width="52" height="6" rx="3" fill="#D9CFFB" />
            <rect x="118" y="29" width="22" height="10" rx="5" fill="#12874A" opacity="0.16" />
            <rect x="32" y="50" width="116" height="20" rx="6" fill="#F8F8FC" stroke="#E8E8F0" />
            <rect x="40" y="57" width="66" height="6" rx="3" fill="#EBE6FD" />
            <rect x="118" y="55" width="22" height="10" rx="5" fill="#5B2EDB" opacity="0.16" />
          </>
        )}
        {index === 2 && (
          <>
            <rect x="34" y="24" width="112" height="9" rx="4.5" fill="#EBE6FD" />
            <rect x="34" y="41" width="86" height="7" rx="3.5" fill="#F4F4F9" />
            <rect x="34" y="55" width="96" height="7" rx="3.5" fill="#F4F4F9" />
            <circle cx="126" cy="70" r="13" fill="#5B2EDB" opacity="0.12" />
            <circle cx="124" cy="68" r="7" stroke="#5B2EDB" strokeWidth="2.4" />
            <path d="m129.5 73.5 5 5" stroke="#5B2EDB" strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  );
}
