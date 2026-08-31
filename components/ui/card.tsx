import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  as: Component = 'div',
}: {
  className?: string;
  children: ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Component className={cn('rounded-card border border-line bg-white shadow-card', className)}>
      {children}
    </Component>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-6 pb-4 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-5 text-ink-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 pb-6', className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex items-center gap-3 border-t border-line px-6 py-4', className)}>
      {children}
    </div>
  );
}

/** The compact metric tile used across both dashboards. */
export function StatCard({
  value,
  label,
  sublabel,
  accent = 'brand',
  className,
}: {
  value: ReactNode;
  label: string;
  sublabel?: string;
  accent?: 'brand' | 'success' | 'warning' | 'info' | 'neutral';
  className?: string;
}) {
  const accents = {
    brand: 'text-brand-600',
    success: 'text-success-600',
    warning: 'text-warning-600',
    info: 'text-info-600',
    neutral: 'text-ink',
  } as const;

  return (
    <div className={cn('rounded-card border border-line bg-white px-5 py-4 shadow-card', className)}>
      <p className={cn('text-[28px] font-bold leading-none tracking-[-0.02em]', accents[accent])}>{value}</p>
      <p className="mt-2 text-[13px] font-medium leading-tight text-ink-600">{label}</p>
      {sublabel && <p className="mt-0.5 text-xs text-ink-400">{sublabel}</p>}
    </div>
  );
}
