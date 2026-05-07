import type { ReactNode } from 'react';
import { ScrollProgress } from '@/components/patterns/ScrollProgress';

export default function RituelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ScrollProgress />
      {children}
    </>
  );
}
