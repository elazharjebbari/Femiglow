/**
 * Layout segment for /admin/emails/* — monte les éléments PERSISTANTS de la
 * section :
 *   - EmailsTabs : barre d'onglets des 9 sections avec badges compteurs
 *     (F02/TRV-03 — la structure est statique, les compteurs arrivent côté
 *     client : aucun coût ajouté au rendu RSC) ;
 *   - ToastProvider : l'UNIQUE live-region de feedback (F01/TRV-02) ;
 *   - GlobalCommandPalette : ⌘K / Ctrl-K.
 */
import type { ReactNode } from 'react';
import { EmailsTabs } from '@/components/admin/emails/EmailsTabs';
import { GlobalCommandPalette } from '@/components/admin/emails/GlobalCommandPalette';
import { ToastProvider } from '@/components/admin/emails/ui/toast';

export default function AdminEmailsLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <EmailsTabs />
      {children}
      <GlobalCommandPalette />
    </ToastProvider>
  );
}
