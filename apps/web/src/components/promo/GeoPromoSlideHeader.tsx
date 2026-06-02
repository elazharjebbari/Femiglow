'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTracking } from '@/lib/tracking/use-tracking';
import type {
  GeoPromoLocationPayload,
  GeoPromoMotion,
  GeoPromoTag,
  GeoPromoTheme,
} from '@/lib/promo-slide-header/types';

const STORAGE_PREFIX = 'femiglow:geo-promo-slide-header';

function storageKey(payload: GeoPromoLocationPayload): string {
  const campaign = payload.campaignKey ?? 'default';
  if (payload.dismissMode === 'day') {
    const day = new Date().toISOString().slice(0, 10);
    return `${STORAGE_PREFIX}:${campaign}:${day}`;
  }
  return `${STORAGE_PREFIX}:${campaign}:session`;
}

function canUseMotion(motion: GeoPromoMotion | undefined): boolean {
  if (!motion || motion === 'none') return false;
  if (typeof window === 'undefined') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function themeClass(theme: GeoPromoTheme | undefined): string {
  if (theme === 'cream') {
    return 'border-encre/10 bg-creme text-encre shadow-stone-900/5';
  }
  if (theme === 'sage') {
    return 'border-sauge-900/10 bg-sauge-900 text-creme shadow-sauge-900/15';
  }
  return 'border-stone-950/10 bg-stone-950 text-creme shadow-stone-950/20';
}

function tagClass(theme: GeoPromoTheme | undefined): string {
  if (theme === 'cream') return 'border-encre/10 bg-white/80 text-encre';
  return 'border-white/15 bg-white/10 text-creme';
}

export function GeoPromoSlideHeader() {
  const pathname = usePathname();
  const [payload, setPayload] = useState<GeoPromoLocationPayload | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const { emit } = useTracking();

  useEffect(() => {
    if (pathname !== '/kit') {
      setPayload(null);
      return;
    }

    let cancelled = false;
    void fetch('/api/promo/location', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GeoPromoLocationPayload | null) => {
        if (cancelled || !data?.enabled) {
          if (!cancelled) setPayload(null);
          return;
        }
        const key = storageKey(data);
        const isDismissed =
          data.dismissMode !== 'none' &&
          typeof window !== 'undefined' &&
          window.sessionStorage.getItem(key) === '1';
        setDismissed(isDismissed);
        setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!payload?.enabled || dismissed) return;
    emit('geo_promo_header_impression', {
      campaign_key: payload.campaignKey,
      route: '/kit',
      geo_mode: payload.cityLabel ? 'city' : 'fallback',
      discount_pct: payload.discountPct ?? undefined,
      theme: payload.theme,
    });
  }, [dismissed, emit, payload]);

  const shouldAnimate = useMemo(() => canUseMotion(payload?.motion), [payload?.motion]);

  if (pathname !== '/kit' || !payload?.enabled || dismissed) return null;

  const close = () => {
    if (payload.dismissMode !== 'none' && typeof window !== 'undefined') {
      window.sessionStorage.setItem(storageKey(payload), '1');
    }
    setDismissed(true);
    emit('geo_promo_header_dismiss', {
      campaign_key: payload.campaignKey,
      route: '/kit',
    });
  };

  const clickCta = () => {
    emit('geo_promo_header_click', {
      campaign_key: payload.campaignKey,
      route: '/kit',
      discount_pct: payload.discountPct ?? undefined,
    });
  };

  const density =
    payload.density === 'comfortable'
      ? 'min-h-[56px] py-2.5'
      : 'min-h-[46px] py-1.5';
  const animation = shouldAnimate
    ? payload.motion === 'fade'
      ? 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200'
      : 'motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:fade-in motion-safe:duration-200'
    : '';

  return (
    <section
      role="region"
      aria-label={payload.ariaLabel ?? 'Offre FemiGlow'}
      data-testid="geo-promo-slide-header"
      className={[
        // S'épingle SOUS le header sticky (qui reste au-dessus en z-index) pour
        // ne jamais recouvrir la nav + le switch de langue au scroll. `top-14`
        // (56px) = hauteur du header mobile au repos ; en mode scrollé (64px) le
        // léger recouvrement haut est masqué derrière le header (z supérieur).
        'sticky top-14 z-[calc(var(--z-sticky)+1)] border-b shadow-sm',
        themeClass(payload.theme),
        density,
        animation,
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/15 bg-white/10">
            <PromoIcon name="Sparkles" />
          </span>
          <p className="min-w-0 truncate text-[13px] font-medium leading-5 sm:text-sm">
            {payload.message}
          </p>
          {payload.tags?.map((tag) => (
            <PromoTagView key={tag.key} tag={tag} theme={payload.theme} />
          ))}
        </div>

        {payload.ctaHref && payload.ctaLabel ? (
          <a
            href={payload.ctaHref}
            onClick={clickCta}
            className={[
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              payload.theme === 'cream'
                ? 'bg-encre text-creme hover:bg-encre/90 focus-visible:ring-encre'
                : 'bg-creme text-encre hover:bg-white focus-visible:ring-creme',
            ].join(' ')}
          >
            {payload.ctaLabel}
          </a>
        ) : null}

        {payload.dismissible ? (
          <button
            type="button"
            onClick={close}
            aria-label="Fermer l'offre"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/15 transition hover:bg-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
          >
            <PromoIcon name="X" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function PromoTagView({ tag, theme }: { tag: GeoPromoTag; theme?: GeoPromoTheme }) {
  return (
    <span
      className={[
        'hidden shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium leading-none sm:inline-flex',
        tagClass(theme),
      ].join(' ')}
      data-testid={`geo-promo-tag-${tag.key}`}
    >
      <PromoIcon name={tag.icon} />
      <span>{tag.label}</span>
    </span>
  );
}

function PromoIcon({
  name,
}: {
  name:
    | GeoPromoTag['icon']
    | 'Sparkles'
    | 'X';
}) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
    className: 'shrink-0',
  } as const;
  const stroke = {
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'Sparkles') {
    return (
      <svg {...common}>
        <path {...stroke} d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8L12 3z" />
        <path {...stroke} d="M19 15l.7 2.2L22 18l-2.3.8L19 21l-.7-2.2L16 18l2.3-.8L19 15z" />
      </svg>
    );
  }
  if (name === 'BadgePercent') {
    return (
      <svg {...common}>
        <path {...stroke} d="M12 3l2.2 2.1 3-.4.5 3 2.3 2-1.4 2.7.8 3-2.8 1.2-1.2 2.8-3-.8-2.7 1.4-2-2.3-3-.5.4-3L3 12l2.1-2.2-.4-3 3-.5 2-2.3 2.7 1.4z" />
        <path {...stroke} d="M9 15l6-6" />
        <path {...stroke} d="M9 9h.01M15 15h.01" />
      </svg>
    );
  }
  if (name === 'Truck') {
    return (
      <svg {...common}>
        <path {...stroke} d="M3 6h11v9H3zM14 9h3l3 3v3h-6z" />
        <path {...stroke} d="M7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      </svg>
    );
  }
  if (name === 'HandCoins') {
    return (
      <svg {...common}>
        <path {...stroke} d="M4 14h4l3 3h4.5a3 3 0 0 0 2.1-.9L21 13" />
        <path {...stroke} d="M4 10h4.5a3 3 0 0 1 2.1.9l1.4 1.4a1.7 1.7 0 0 1-2.4 2.4L8 13" />
        <path {...stroke} d="M16 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
      </svg>
    );
  }
  if (name === 'ShieldCheck') {
    return (
      <svg {...common}>
        <path {...stroke} d="M12 3l7 3v5c0 4.5-2.9 8.2-7 10-4.1-1.8-7-5.5-7-10V6l7-3z" />
        <path {...stroke} d="M8.5 12l2.2 2.2L15.8 9" />
      </svg>
    );
  }
  if (name === 'MapPinned') {
    return (
      <svg {...common}>
        <path {...stroke} d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
        <path {...stroke} d="M15 6v15M9 3v15" />
        <path {...stroke} d="M18 8.5c0 1.8-2 3.5-2 3.5s-2-1.7-2-3.5a2 2 0 1 1 4 0z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path {...stroke} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
