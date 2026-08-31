import { ButtonLink } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-10" />
      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">We couldn’t find that page</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink-400">
        The page you’re looking for may have been moved, or the link may be out of date.
      </p>
      <div className="mt-8">
        <ButtonLink href="/">Back to home</ButtonLink>
      </div>
    </main>
  );
}
