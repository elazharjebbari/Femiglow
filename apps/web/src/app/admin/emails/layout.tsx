/**
 * Layout segment for /admin/emails/* — mounts the global Cmd-K palette.
 */
import type { ReactNode } from 'react';
import { GlobalCommandPalette } from '@/components/admin/emails/GlobalCommandPalette';

export default function AdminEmailsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <GlobalCommandPalette />
    </>
  );
}
