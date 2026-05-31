import type { DriftStatusEnum } from '@/lib/tracking/gtm/sentinel-schemas';

type Props = {
  status: Exclude<DriftStatusEnum, 'ok'>;
  humanMessage: string;
  linkTo: string;
};

const STYLES: Record<Props['status'], { bg: string; text: string; cta: string; icon: string; label: string }> = {
  warning: {
    bg: 'border-amber-300 bg-amber-50',
    text: 'text-amber-900',
    cta: 'bg-amber-900 text-amber-50 hover:bg-amber-800',
    icon: '⚠',
    label: 'Attention',
  },
  critical: {
    bg: 'border-red-300 bg-red-50',
    text: 'text-red-900',
    cta: 'bg-red-900 text-red-50 hover:bg-red-800',
    icon: '🚨',
    label: 'Drift critique',
  },
};

export function DriftBanner({ status, humanMessage, linkTo }: Props) {
  const style = STYLES[status];
  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="drift-banner"
      data-status={status}
      className={`mb-4 rounded-md border ${style.bg} px-4 py-3 text-sm ${style.text}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg" aria-hidden="true">{style.icon}</span>
        <div className="flex-1">
          <strong className="font-medium">{style.label}</strong> — {humanMessage}
        </div>
        <a
          href={linkTo}
          data-testid="drift-banner-link"
          className={`whitespace-nowrap rounded-md ${style.cta} px-3 py-1 text-xs font-medium`}
        >
          Voir détails →
        </a>
      </div>
    </div>
  );
}
