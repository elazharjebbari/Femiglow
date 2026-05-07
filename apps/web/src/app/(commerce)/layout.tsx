import type { ReactNode } from 'react';
import { CommerceHeader, Footer } from '@/components/layout';

export default function CommerceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CommerceHeader />
      <main id="main" tabIndex={-1} className="bg-creme min-h-[60vh]">
        {children}
      </main>
      <Footer />
    </>
  );
}
