'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Logo, LogoMark } from '@/components/brand/logo';
import { LogOut, Menu, X } from '@/components/icons';
import { cn } from '@/lib/utils';

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
};

/**
 * The dark application sidebar from the reference dashboards.
 *
 * On desktop it is a fixed 248px rail; below `lg` it collapses behind a top
 * bar and slides in as an overlay, preserving the same navigation and visual
 * identity rather than shrinking the desktop layout.
 */
export function Sidebar({
  primary,
  secondary,
  showWordmark = true,
}: {
  primary: NavItem[];
  secondary?: NavItem[];
  showWordmark?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <Logo href="/" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="rounded-md p-2 text-ink"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-sidebar transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-[68px] items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2" aria-label="Bursary-Bridge home">
            <LogoMark tone="light" className="h-6 w-9" />
            {showWordmark && (
              <span className="text-[15px] font-bold tracking-[-0.02em] text-white">Bursary-Bridge</span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-sidebar-text hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {primary.map((item) => (
              <li key={item.href}>
                <NavLink item={item} onNavigate={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/[0.08] px-3 py-3">
          <ul className="space-y-1">
            {secondary?.map((item) => (
              <li key={item.href}>
                <NavLink item={item} onNavigate={() => setOpen(false)} />
              </li>
            ))}
            <li>
              <LogoutButton />
            </li>
          </ul>
        </div>
      </aside>
    </>
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname();
  // Dashboard must match exactly; every other section matches its subtree.
  const active =
    item.href.endsWith('/dashboard') ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 items-center gap-3 rounded-btn px-3 text-[13px] font-medium transition-colors',
        active
          ? 'bg-sidebar-active text-white'
          : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
      )}
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      {typeof item.badge === 'number' && item.badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/15 px-1.5 text-[10px] font-bold text-white">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="flex h-10 w-full items-center gap-3 rounded-btn px-3 text-[13px] font-medium
                 text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-white disabled:opacity-60"
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <LogOut className="h-[18px] w-[18px]" />
      </span>
      Log out
    </button>
  );
}
