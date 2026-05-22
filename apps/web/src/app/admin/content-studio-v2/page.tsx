import { redirect } from 'next/navigation';
import Link from 'next/link';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function ContentStudioV2RootPage() {
  if (env.CONTENT_STUDIO_V2_ENABLED !== 'true') {
    return <DisabledPlaceholder />;
  }
  redirect('/admin/content-studio-v2/home');
}

function DisabledPlaceholder() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'var(--cs-bg-base)', color: 'var(--cs-fg-primary)' }}>
      <div className="max-w-md text-center">
        <p className="cs-eyebrow mb-3">Content Studio v2</p>
        <h1 className="text-3xl font-display mb-3" style={{ letterSpacing: '-0.015em' }}>
          La nouvelle interface est désactivée
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--cs-fg-secondary)' }}>
          Activez <code>CONTENT_STUDIO_V2_ENABLED=true</code> dans <code>.env</code> puis redémarrez
          le service pour voir la refonte. Le studio existant reste accessible.
        </p>
        <Link
          href="/admin/content-studio"
          className="cs-btn cs-btn-ghost inline-flex items-center gap-2"
        >
          ← Aller au Studio actuel
        </Link>
      </div>
    </main>
  );
}
