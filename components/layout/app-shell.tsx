import type { ReactNode } from 'react';
import { Sidebar, type NavItem } from './sidebar';
import { cn } from '@/lib/utils';

/**
 * Sidebar + content shell used by both the student and corporate applications.
 */
export function AppShell({
  primary,
  secondary,
  children,
}: {
  primary: NavItem[];
  secondary?: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-muted">
      <Sidebar primary={primary} secondary={secondary} />
      <div className="lg:pl-[248px]">
        <main id="main" className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Standard page frame: title row, optional actions, then content. */
export function PageHeader({
  title,
  description,
  actions,
  className,
  breadcrumb,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumb && <div className="mb-2.5">{breadcrumb}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
          {description && <p className="mt-1.5 text-[13px] leading-6 text-ink-400">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-shell px-5 py-6 sm:px-7 sm:py-8', className)}>{children}</div>;
}
