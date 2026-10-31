'use client';

import { useState } from 'react';

import { InvitationCodeField } from '@/components/sections/InvitationCodeField';
import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';
import { useAppliedCoupon } from '@/lib/checkout/state/use-applied-coupon';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { cn } from '@/lib/utils/cn';

/**
 * Phase 3 — crédit de fidélité (optionnel). Porte DISCRÈTE repliée par défaut
 * (esprit coupon-doc : zéro friction pour qui n'a pas de code) ; s'ouvre sur
 * clic, ou d'office si un code est déjà saisi (reprise). Validé via
 * /api/coupons/redeem → store → total.
 */
export function AddressCouponDisclosure() {
  const { t, language } = useWizardTranslation();
  const appliedCoupon = useAppliedCoupon({ hydrationSafe: false });
  const couponCode = appliedCoupon.code;
  const setCoupon = useWizardStore((s) => s.setCoupon);
  const clearCoupon = useWizardStore((s) => s.clearCoupon);
  const [open, setOpen] = useState<boolean>(!!couponCode);

  return (
    <details
      data-testid="wizard-coupon-field"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="text-sm"
    >
      <summary
        data-testid="wizard-coupon-summary"
        className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-encre/65 transition-colors hover:text-encre [&::-webkit-details-marker]:hidden"
      >
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden
          className={cn(
            'shrink-0 text-sauge transition-transform duration-300 rtl:-scale-x-100',
            open && 'rotate-90',
          )}
        >
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="underline decoration-encre/20 underline-offset-4">
          {t.address.couponToggle}
        </span>
      </summary>
      <div className="mt-2 max-w-[18rem]">
        <InvitationCodeField
          isArabic={language === 'ar'}
          isEnglish={language === 'en'}
          initialCode={couponCode ?? ''}
          initialValueCents={appliedCoupon.creditCents}
          initialKind={appliedCoupon.kind ?? 'credit'}
          onValid={(code, cents, kind) => setCoupon(code, cents, kind)}
          onClear={clearCoupon}
        />
      </div>
    </details>
  );
}
