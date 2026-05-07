import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Console FemiGlow',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-stone-50 text-stone-900">{children}</div>;
}
