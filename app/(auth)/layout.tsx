import { Logo } from '@/components/brand/logo';

/**
 * Centred single-column shell shared by login, registration and email
 * verification — the layout used by screens 1 and 2 of the reference journeys.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <div className="flex justify-center px-5 pt-8 sm:pt-12 lg:hidden">
        <Logo />
      </div>
      <main id="main" className="flex flex-1 items-center justify-center px-5 py-8 sm:py-12">
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
      <footer className="px-5 pb-8 text-center text-xs text-ink-300">
        © {new Date().getFullYear()} Bursary-Bridge
      </footer>
    </div>
  );
}
