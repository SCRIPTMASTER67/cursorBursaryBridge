import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, InfoCircle } from '@/components/icons';
import { cn } from '@/lib/utils';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const config: Record<AlertTone, { wrap: string; icon: ReactNode }> = {
  info: {
    wrap: 'bg-info-50 text-info-700 border-info-100',
    icon: <InfoCircle className="h-[18px] w-[18px] shrink-0 text-info-600" />,
  },
  success: {
    wrap: 'bg-success-50 text-success-700 border-success-100',
    icon: <CheckCircle className="h-[18px] w-[18px] shrink-0 text-success-600" />,
  },
  warning: {
    wrap: 'bg-warning-50 text-warning-700 border-warning-100',
    icon: <AlertTriangle className="h-[18px] w-[18px] shrink-0 text-warning-600" />,
  },
  danger: {
    wrap: 'bg-danger-50 text-danger-700 border-danger-100',
    icon: <AlertCircle className="h-[18px] w-[18px] shrink-0 text-danger-600" />,
  },
};

/**
 * Inline feedback. Errors are given role="alert" so assistive technology
 * announces them the moment they appear.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-field border px-4 py-3', config[tone].wrap, className)}
    >
      {config[tone].icon}
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
