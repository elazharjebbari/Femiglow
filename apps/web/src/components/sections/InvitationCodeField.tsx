/**
 * `InvitationCodeField` — saisie d'un code de crédit fidélité (Phase 3).
 *
 * Valide le code via /api/coupons/redeem (prévisualisation, sans consommer) et
 * affiche un retour sobre. L'application réelle du crédit a lieu au paiement
 * (le code est transmis à la commande). Charte : lien/champ discrets, encre,
 * pas de rouge agressif. cf. docs/coupons-qa-2026-06-02 (Phase 3).
 */
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'valid'; valueCents: number }
  | { kind: 'invalid'; reason: string };

function formatMad(cents: number): string {
  return `${(cents / 100).toFixed(0)} MAD`;
}

export interface InvitationCodeFieldProps {
  isArabic?: boolean;
  /** Notifie le parent du code validé (pour transmission à la commande). */
  onValid?: (code: string, valueCents: number) => void;
  /**
   * Anti-stale : appelé quand le code est ré-édité/vidé après une validation,
   * pour invalider tout crédit précédemment appliqué (re-validation requise).
   */
  onClear?: () => void;
  /** Valeur initiale (reprise depuis le store). */
  initialCode?: string;
}

export function InvitationCodeField({
  isArabic = false,
  onValid,
  onClear,
  initialCode = '',
}: InvitationCodeFieldProps): JSX.Element {
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  function handleChange(next: string) {
    setCode(next);
    // Toute édition invalide une validation précédente.
    if (status.kind === 'valid' || status.kind === 'invalid') {
      setStatus({ kind: 'idle' });
      onClear?.();
    }
  }

  async function check() {
    const c = code.trim();
    if (c.length < 3) return;
    setStatus({ kind: 'checking' });
    try {
      const res = await fetch('/api/coupons/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      const json = (await res.json()) as { valid?: boolean; valueCents?: number; reason?: string };
      if (json.valid && typeof json.valueCents === 'number') {
        setStatus({ kind: 'valid', valueCents: json.valueCents });
        onValid?.(c.toUpperCase(), json.valueCents);
      } else {
        setStatus({ kind: 'invalid', reason: json.reason ?? 'invalid' });
      }
    } catch {
      setStatus({ kind: 'invalid', reason: 'error' });
    }
  }

  const t = isArabic
    ? {
        ph: 'رمز الدعوة',
        hint: 'FG-XXXXXX',
        btn: 'تطبيق',
        checking: '…',
        ok: (v: string) => `رصيد ${v} صالح — يُطبَّق عند الدفع.`,
        ko: 'الرمز غير صالح أو منتهي.',
      }
    : {
        ph: 'Votre code',
        hint: 'FG-XXXXXX',
        btn: 'Appliquer',
        checking: '…',
        ok: (v: string) => `Crédit de ${v} appliqué — déduit au paiement.`,
        ko: 'Code introuvable ou expiré.',
      };

  const isValid = status.kind === 'valid';
  const isInvalid = status.kind === 'invalid';
  const canSubmit = code.trim().length >= 3 && status.kind !== 'checking';

  return (
    <div className="flex flex-col gap-1.5" data-testid="invitation-code-field">
      {/* Input-group : champ pleine largeur + bouton « Appliquer » attaché.
          Aligné à gauche, états sauge (valide) / sobre (invalide). */}
      <div
        className={cn(
          'flex items-stretch overflow-hidden rounded-md border bg-white transition-colors',
          isValid
            ? 'border-sauge'
            : isInvalid
              ? 'border-encre/30'
              : 'border-encre/20 focus-within:border-sauge/70',
        )}
      >
        <input
          aria-label={t.ph}
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t.hint}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm uppercase tracking-wide text-encre placeholder:normal-case placeholder:tracking-normal placeholder:text-encre/30 focus:outline-none"
        />
        {isValid ? (
          <span
            aria-hidden
            className="flex shrink-0 items-center border-l border-sauge/30 bg-sauge/10 px-3 text-sauge"
          >
            <svg viewBox="0 0 16 16" width="13" height="13">
              <path
                d="M4 8.4l2.6 2.6 5.4-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : (
          <button
            type="button"
            onClick={check}
            disabled={!canSubmit}
            className="shrink-0 border-l border-encre/10 px-3.5 text-xs font-medium uppercase tracking-wide text-sauge transition-colors hover:bg-sauge/10 disabled:opacity-40"
          >
            {status.kind === 'checking' ? t.checking : t.btn}
          </button>
        )}
      </div>
      {isValid && (
        <p
          data-testid="invitation-code-ok"
          className="flex items-center gap-1 text-xs font-medium text-sauge"
        >
          {t.ok(formatMad((status as { valueCents: number }).valueCents))}
        </p>
      )}
      {isInvalid && (
        <p data-testid="invitation-code-ko" role="alert" className="text-xs text-encre/55">
          {t.ko}
        </p>
      )}
    </div>
  );
}
