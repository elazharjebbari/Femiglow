/**
 * /admin/emails/suppression — Liste de suppression consultable & réversible
 * (UX-COCKPIT-001).
 *
 * Écran opérateur enfin existant : voir les adresses blocklistées et en retirer
 * une (faux positif bounce, suppress par mégarde, réinscription RGPD). La page
 * RSC fait l'auth gate puis délègue au composant client `SuppressionList`. Un
 * deep-link `?email=…` (depuis le détail d'un envoi suppressed) pré-remplit la
 * recherche.
 */
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { Breadcrumb, EMAILS_ROOT } from '@/components/admin/emails/common/Breadcrumb';
import { SuppressionList } from '@/components/admin/emails/cockpit/SuppressionList';

export const dynamic = 'force-dynamic';

export default async function SuppressionPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const session = await requireAdmin('/admin/emails/suppression');
  const initialEmail = typeof searchParams.email === 'string' ? searchParams.email : '';

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <Breadcrumb segments={[EMAILS_ROOT, { label: 'Liste de suppression' }]} />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Liste de suppression
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Adresses bloquées pour tous les envois (transactionnel et campagnes). Retirer une adresse
          la rend de nouveau joignable — réservé aux faux positifs et aux demandes de réinscription.
        </p>
      </header>

      <SuppressionList initialEmail={initialEmail} />
    </AdminShell>
  );
}
