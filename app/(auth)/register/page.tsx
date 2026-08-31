import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Card } from '@/components/ui/card';
import { ArrowRight, Building, GraduationCap } from '@/components/icons';
import { getCurrentUser, homePathForRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Create an account' };

const paths = [
  {
    href: '/register/student',
    icon: <GraduationCap className="h-5 w-5" />,
    tone: 'bg-brand-50 text-brand-600',
    title: 'I’m a Student',
    body: 'Find bursaries and scholarships matched to what you want to study.',
  },
  {
    href: '/register/organisation',
    icon: <Building className="h-5 w-5" />,
    tone: 'bg-success-50 text-success-600',
    title: 'I’m an Organisation',
    body: 'Create funding programmes and find the right applicants.',
  },
];

export default async function RegisterChooserPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <Card className="p-7 sm:p-8">
      <div className="mb-7 hidden lg:block">
        <Logo />
      </div>

      <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Create your account</h1>
      <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
        Tell us who you are so we can set up the right experience for you.
      </p>

      <div className="mt-6 space-y-3">
        {paths.map((path) => (
          <Link
            key={path.href}
            href={path.href}
            className="flex items-center gap-4 rounded-card border border-line p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${path.tone}`}>
              {path.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{path.title}</span>
              <span className="mt-0.5 block text-[13px] leading-5 text-ink-400">{path.body}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" />
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-400">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </Card>
  );
}
