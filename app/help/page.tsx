import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/landing/site-header';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Help & Support' };

const faqs = [
  {
    question: 'How does matching work?',
    answer:
      'We compare your profile against each funding programme across six weighted criteria: your course (30%), institution (25%), academic results (20%), qualification level (10%), location (10%) and financial profile (5%). Every match shows exactly which criteria were met, so you always know why a score is what it is.',
  },
  {
    question: 'Why can I only add six study preferences?',
    answer:
      'Six is enough to cover realistic combinations of course and institution while keeping your matches meaningful. Each preference pairs a course with the institution you would study it at, because a bursary that funds Computer Science at one university is not necessarily open to the same course elsewhere.',
  },
  {
    question: 'Do I need documents to register?',
    answer:
      'No. Registration only establishes your identity and matching profile. Documents such as an ID, academic record or proof of income are collected later, when a specific application requires them.',
  },
  {
    question: 'Who can see my information?',
    answer:
      'Only you, until you apply. When you submit an application, that funder sees the profile you applied with and any documents you attached to that application. Other funders see nothing.',
  },
  {
    question: 'Is Bursary-Bridge free?',
    answer: 'Bursary-Bridge is free for students, and always will be.',
  },
];

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink">Help &amp; Support</h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-400">
          Answers to the questions students and organisations ask most often.
        </p>

        <div className="mt-8 space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.question} className="p-6">
              <h2 className="text-[15px] font-semibold text-ink">{faq.question}</h2>
              <p className="mt-2 text-[13px] leading-6 text-ink-500">{faq.answer}</p>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
