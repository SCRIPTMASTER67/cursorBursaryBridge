import { Logo } from '@/components/brand/logo';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-[64px] max-w-shell items-center px-5 sm:px-8">
          <Logo href="/" />
        </div>
      </header>
      <main id="main" className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
