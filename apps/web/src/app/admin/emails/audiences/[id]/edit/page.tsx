/**
 * /admin/emails/audiences/[id]/edit — Édition d'une audience existante (UX-AUD-001).
 *
 * Avant : le PATCH /api/admin/emails/audiences/[id] existait mais AUCUNE surface
 * UI ne l'appelait → une audience mal réglée devait être supprimée et recréée
 * (slug immutable → perte du slug). Cette page réutilise AudienceWizard en mode
 * 'edit', pré-rempli depuis getAudienceById, et soumet en PATCH.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAudienceById } from '@/lib/mail/audiences/queries';
import {
  AudienceWizard,
  type AudienceWizardInitial,
} from '@/components/admin/emails/audiences/AudienceWizard';
import {
  ExclusionFlagsSchema,
  RulesGroupSchema,
} from '@/lib/mail/audiences/rules-types';

export const dynamic = 'force-dynamic';

export default async function EditAudiencePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin(`/admin/emails/audiences/${params.id}/edit`);
  const audience = await getAudienceById(params.id);
  if (!audience) notFound();

  // Les rules/exclusions stockées en jsonb : on les valide (best-effort) pour
  // pré-remplir le builder avec une shape sûre. Si les rules stockées sont
  // illisibles (drift historique), on retombe sur un groupe vide plutôt que de
  // crasher la page — l'opérateur reconstruira.
  const parsedRules = RulesGroupSchema.safeParse(audience.rules);
  const parsedExclusions = ExclusionFlagsSchema.safeParse(audience.exclusionFlags);

  const initial: AudienceWizardInitial = {
    slug: audience.slug,
    name: audience.name,
    description: audience.description,
    rules: parsedRules.success ? parsedRules.data : { kind: 'all', conditions: [] },
    exclusionFlags: parsedExclusions.success ? parsedExclusions.data : undefined,
    evaluationMode: audience.evaluationMode,
  };

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link
            href={`/admin/emails/audiences/${audience.id}`}
            className="text-sm text-stone-500 underline-offset-2 hover:underline"
          >
            ← Détail
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            Modifier « {audience.name} »
          </h1>
          <p className="mt-1 font-mono text-xs text-stone-500">{audience.slug}</p>
        </div>
      </header>

      <AudienceWizard mode="edit" audienceId={audience.id} initial={initial} />
    </AdminShell>
  );
}
