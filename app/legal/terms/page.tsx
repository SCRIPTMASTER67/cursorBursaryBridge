import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/landing/site-header';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink">Terms of Service</h1>

        <Alert tone="info" className="mt-6">
          Bursary-Bridge is a prototype. This page outlines the terms the production platform would
          set out; it is not a legal agreement and has not been reviewed by a legal practitioner.
        </Alert>

        <div className="mt-8 space-y-6 text-[13px] leading-7 text-ink-500">
          <section>
            <h2 className="text-[15px] font-semibold text-ink">Using Bursary-Bridge</h2>
            <p className="mt-2">
              Bursary-Bridge connects students with funding opportunities and gives organisations a
              place to publish and administer funding programmes. It is free for students.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold text-ink">Your account</h2>
            <p className="mt-2">
              You are responsible for the accuracy of the information in your profile and for keeping
              your password secure. Funders make decisions based on what you tell them, so
              information that is knowingly false may result in an application being rejected.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold text-ink">Funding decisions</h2>
            <p className="mt-2">
              Bursary-Bridge does not award funding. Match scores indicate how closely your profile
              fits a programme’s stated criteria; they are not a guarantee of eligibility or of an
              award. Every decision rests with the funding organisation.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold text-ink">Organisations</h2>
            <p className="mt-2">
              Organisations may only view applications submitted to their own programmes, and must
              use applicant information solely to assess those applications.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
