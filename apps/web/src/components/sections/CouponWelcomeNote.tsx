/**
 * `CouponWelcomeNote` — module « geste d'accueil » (CPN-14).
 *
 * Re-scénarise la remise en invitation de la maison. Affiché uniquement
 * quand un coupon `welcome_auto` est actif en bucket `treatment` (la gate
 * est décidée par l'appelant — ce composant est purement présentationnel).
 *
 * Charte STRICTE : fond crème, texte encre, accent sauge, filet fin. PAS de
 * rouge retail, PAS de countdown, PAS d'emoji. Note éditoriale, pas sticker.
 * cf. docs/coupons-qa-2026-06-02/14-landing-welcome-note/.
 */
import { cn } from '@/lib/utils/cn';
import { InvitationCodeField, type InvitationCodeKind } from './InvitationCodeField';

export interface CouponWelcomeNoteProps {
  /** Prix final formaté (ex. « 199 MAD » / « 199 درهم »). */
  finalPriceLabel: string;
  /** Montant offert formaté (ex. « 90 MAD offerts »). */
  savingsLabel: string;
  /** Mention de validité civile (ex. « Valable jusqu'au 30 juin 2026 »). null = omise. */
  endsAtLabel?: string | null;
  /** Active la copie arabe (RTL). */
  isArabic?: boolean;
  className?: string;
  /**
   * Code de fidélité validé dans le champ d'invitation → remonte au parent
   * (PriceBlock) qui applique le crédit au store et actualise tous les prix.
   */
  onCouponValid?: (code: string, valueCents: number, kind: InvitationCodeKind) => void;
  /** Code ré-édité/vidé → retire le crédit (re-validation requise). */
  onCouponClear?: () => void;
  /**
   * Code déjà appliqué (reprise / URL de campagne) : pré-remplit le champ en
   * état « appliqué » et ouvre la porte pour que la cliente voie son code.
   */
  appliedCoupon?: { code: string; valueCents: number; kind: InvitationCodeKind } | null;
}

const COPY = {
  fr: {
    title: 'Votre geste d’accueil est appliqué.',
    finalPrefix: 'Prix final aujourd’hui :',
    nonCumul: 'Hors cumul.',
    invitation: 'J’ai un code d’invitation',
  },
  ar: {
    // D-5 : copie arabe indicative, à valider par la rédaction maison.
    title: 'لقد تم تطبيق هدية الترحيب الخاصة بك.',
    finalPrefix: 'السعر النهائي اليوم:',
    nonCumul: 'غير قابل للجمع.',
    invitation: 'لدي رمز دعوة',
  },
} as const;

export function CouponWelcomeNote({
  finalPriceLabel,
  savingsLabel,
  endsAtLabel,
  isArabic = false,
  className,
  onCouponValid,
  onCouponClear,
  appliedCoupon = null,
}: CouponWelcomeNoteProps): JSX.Element {
  const t = isArabic ? COPY.ar : COPY.fr;
  return (
    <aside
      data-testid="coupon-welcome-note"
      dir={isArabic ? 'rtl' : undefined}
      aria-label={t.title}
      className={cn(
        // crème + encre + filet fin sauge, coins discrets (pas d'arrondi massif)
        'mx-auto max-w-md rounded-md border border-sauge/40 bg-creme/60 px-4 py-3 text-center',
        className,
      )}
    >
      <p className="text-sm font-medium text-encre">{t.title}</p>
      <p className="mt-1 text-sm text-encre/80">{savingsLabel}</p>
      <p className="mt-2 text-sm text-encre">
        <span className="text-encre/70">{t.finalPrefix}</span>{' '}
        <span className="font-display tabular-nums" data-testid="coupon-welcome-final-price">
          {finalPriceLabel}
        </span>
      </p>
      {endsAtLabel ? (
        <p className="mt-1 text-xs text-encre/60">
          {endsAtLabel} · {t.nonCumul}
        </p>
      ) : (
        <p className="mt-1 text-xs text-encre/60">{t.nonCumul}</p>
      )}

      {/* Porte discrète, repliée par défaut, INERTE en Phase 1 (D-6 : pas de
          champ). Aucune friction : ne s'ouvre que sur action explicite. */}
      <details className="mt-2 text-xs" open={!!appliedCoupon || undefined}>
        <summary
          data-testid="coupon-invitation-disclosure"
          className="cursor-pointer list-none text-encre/55 underline decoration-encre/25 underline-offset-2"
        >
          {t.invitation}
        </summary>
        <div className="mt-1">
          <InvitationCodeField
            isArabic={isArabic}
            initialCode={appliedCoupon?.code ?? ''}
            initialValueCents={appliedCoupon?.valueCents ?? 0}
            initialKind={appliedCoupon?.kind ?? 'credit'}
            onValid={onCouponValid}
            onClear={onCouponClear}
          />
        </div>
      </details>
    </aside>
  );
}
