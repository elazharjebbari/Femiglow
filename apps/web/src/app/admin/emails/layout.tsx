/**
 * Layout segment for /admin/emails/* — mounts the global Cmd-K palette and
 * the SINGLE ToastProvider of the section (F01/TRV-02 : une seule live-region
 * polite ; tout feedback de mutation passe par useToast()).
 */
import type { ReactNode } from 'react';
import { GlobalCommandPalette } from '@/components/admin/emails/GlobalCommandPalette';
import { ToastProvider } from '@/components/admin/emails/ui/toast';

export default function AdminEmailsLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <GlobalCommandPalette />
    </ToastProvider>
  );
}
