import type { Metadata } from 'next';
import { LoginForm } from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connexion — Console FemiGlow',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-medium tracking-tight text-stone-900">
            Console FemiGlow
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Espace réservé à la fondatrice.
          </p>
        </header>
        <LoginForm next={searchParams.next} />
      </div>
    </main>
  );
}
