import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/landing/site-header';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = { title: 'Privacy Notice' };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink">Privacy Notice</h1>

        <Alert tone="info" className="mt-6">
          Bursary-Bridge is a prototype. This page describes the privacy approach the production
          platform would follow; it is not a legal notice and has not been reviewed by a legal
          practitioner.
        </Alert>

        <div className="mt-8 space-y-6 text-[13px] leading-7 text-ink-500">
          <section>
            <h2 className="text-[15px] font-semibold text-ink">What we collect</h2>
            <p className="mt-2">
              Your name and contact details, your education and study preferences, your academic
              results, your funding needs, an income band rather than an exact figure, your province
              and town, and any documents you choose to upload.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold text-ink">What we deliberately do not collect</h2>
            <p className="mt-2">
              Registration never asks for your street address, ID number, bank details, a parent’s ID
              or detailed financial records. Sensitive information is requested only when a specific
              application actually requires it.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold text-ink">Who sees your information</h2>
            <p className="mt-2">
              Your profile is private until you apply. Submitting an application shares that profile,
              and any documents you attached, with that funder alone. Other organisations cannot see
              it, and we never sell your information.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold text-ink">Your choices</h2>
            <p className="mt-2">
              You can update or remove information at any time from your profile, turn off email
              notifications in Settings, and delete uploaded documents. Under POPIA you may request
              access to the personal information we hold about you.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
