import type { ReactNode } from 'react';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';

export default function AIEngineLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
