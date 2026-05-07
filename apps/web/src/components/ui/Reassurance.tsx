import type { ReassuranceIcon } from '@/lib/schemas';
import { cn } from '@/lib/utils/cn';

interface ReassuranceProps {
  icon: ReassuranceIcon;
  label: string;
  detail?: string;
  align?: 'inline' | 'stacked';
  className?: string;
}

const ShippingIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <path d="M3 7h11v9H3z" />
    <path d="M14 10h4l3 3v3h-7" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17.5" cy="18" r="1.6" />
  </svg>
);

const ReturnIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M3 4v5h5" />
  </svg>
);

const PaymentIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <rect x="5" y="10" width="14" height="10" rx="1.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const iconMap: Record<ReassuranceIcon, () => JSX.Element> = {
  shipping: ShippingIcon,
  return: ReturnIcon,
  payment: PaymentIcon,
};

export function Reassurance({
  icon,
  label,
  detail,
  align = 'inline',
  className,
}: ReassuranceProps) {
  const Icon = iconMap[icon];
  return (
    <div
      className={cn(
        'flex gap-2 text-encre/70',
        align === 'inline' ? 'items-center' : 'flex-col items-start',
        className,
      )}
    >
      <span aria-hidden="true" className="text-encre/80">
        <Icon />
      </span>
      <div className={cn('flex flex-col', align === 'inline' && 'leading-tight')}>
        <span className="text-xs font-medium uppercase tracking-[0.05em] text-encre">
          {label}
        </span>
        {detail ? (
          <span className="text-xs text-encre/60">{detail}</span>
        ) : null}
      </div>
    </div>
  );
}
