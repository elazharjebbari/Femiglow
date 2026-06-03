/**
 * `LoyaltyCodeCard` — code de fidélité mémorable remis en fin de commande.
 *
 * Geste de la maison (pas un coupon retail) : médaillon crème/filet sauge, code
 * `tabular-nums`, valeur en accent terracotta, mention d'activation civile (pas
 * de countdown), bouton copier discret. cf. docs/promo-code-loyalty-2026-06-03.
 */
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface LoyaltyCodeCardProps {
  code: string;
  valueCents: number;
  /** ISO ; date à partir de laquelle le code est utilisable. */
  activatesAt?: string | null;
  isArabic?: boolean;
  className?: string;
}

function formatMad(cents: number, isArabic: boolean): string {
  return `${(cents / 100).toFixed(0)} ${isArabic ? 'درهم' : 'MAD'}`;
}

function formatCivil(iso: string | null | undefined, isArabic: boolean): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(isArabic ? 'ar-MA' : 'fr-MA', {
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export function LoyaltyCodeCard({
  code,
  valueCents,
  activatesAt,
  isArabic = false,
  className,
}: LoyaltyCodeCardProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const activation = formatCivil(activatesAt, isArabic);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible — le code reste lisible/sélectionnable */
    }
  }

  const t = isArabic
    ? {
        title: 'لفتة لزيارتك القادمة',
        value: (v: string) => `${v} على طلبك القادم.`,
        from: (d: string) => `صالح ابتداءً من ${d} · لمدة 60 يومًا.`,
        keep: 'احتفظي به — مرتبط برقم هاتفك.',
        copy: 'نسخ',
        copied: 'تم النسخ',
      }
    : {
        title: 'Un geste pour votre prochaine visite',
        value: (v: string) => `${v} sur votre prochaine commande.`,
        from: (d: string) => `Utilisable à partir du ${d} · valable 60 jours.`,
        keep: 'Gardez-le — il est lié à votre numéro.',
        copy: 'Copier',
        copied: 'Copié',
      };

  return (
    <aside
      data-testid="loyalty-code-card"
      dir={isArabic ? 'rtl' : undefined}
      className={cn(
        'mx-auto mt-6 max-w-sm rounded-md border border-sauge/40 bg-creme/60 px-4 py-4 text-center',
        className,
      )}
    >
      <p className="text-xs uppercase tracking-[0.14em] text-encre/60">{t.title}</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <span
          data-testid="loyalty-code-value"
          className="font-display text-2xl tracking-wide tabular-nums text-encre"
        >
          {code}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={t.copy}
          data-testid="loyalty-code-copy"
          className="rounded border border-sauge/40 px-2 py-1 text-xs text-sauge transition-colors hover:bg-sauge/10"
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <p className="mt-2 text-sm text-encre">
        <span className="font-semibold tabular-nums text-[#C28A6E]">
          {formatMad(valueCents, isArabic)}
        </span>{' '}
        <span className="text-encre/80">
          {isArabic ? 'على طلبك القادم.' : 'sur votre prochaine commande.'}
        </span>
      </p>
      {activation && (
        <p className="mt-1 text-xs text-encre/55">{t.from(activation)}</p>
      )}
      <p className="mt-1 text-xs text-encre/55">{t.keep}</p>
    </aside>
  );
}
