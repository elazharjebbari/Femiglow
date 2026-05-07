'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckoutHeader } from '@/components/layout/CheckoutHeader';
import { FooterMinimal } from '@/components/layout/FooterMinimal';
import { CheckoutFlow } from './CheckoutFlow';
import { LeaveCheckoutModal } from './LeaveCheckoutModal';
import {
  clearCheckoutDraft,
  saveCheckoutDraft,
} from '@/lib/stores/checkout-draft';
import { routes } from '@/lib/routes';

export function CheckoutPage() {
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = useState(false);

  return (
    <>
      <CheckoutHeader onLeaveClick={() => setLeaveOpen(true)} />
      <main
        id="main"
        tabIndex={-1}
        className="bg-creme min-h-[60vh]"
      >
        <CheckoutFlow />
      </main>
      <FooterMinimal />

      <LeaveCheckoutModal
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onResumeLater={() => {
          // Le draft est déjà persisté à chaque blur via CheckoutFlow.
          saveCheckoutDraft({});
          router.push(routes.home);
        }}
        onQuit={() => {
          clearCheckoutDraft();
          router.push(routes.home);
        }}
      />
    </>
  );
}
