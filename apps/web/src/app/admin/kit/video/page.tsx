/**
 * `/admin/kit/video` — éditeur singleton de la section vidéo `/kit`.
 *
 * RSC qui charge l'override courant + la version résolue (draft) puis
 * délègue à `KitVideoEditor` (client). Auth admin obligatoire.
 *
 * cf. docs/video-gestes-optim-2026-05/06-admin-ui-ux-design.md
 */
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { KitVideoEditor } from '@/components/admin/kit-video/KitVideoEditor';
import { resolveKitVideoDraft } from '@/lib/kit/video/resolver';
import { getKitVideoOverride } from '@/lib/kit/video/store';

export const dynamic = 'force-dynamic';

export default async function AdminKitVideoPage(): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/kit/video');
  const override = getKitVideoOverride();
  const resolved = resolveKitVideoDraft();

  return (
    <AdminShell adminEmail={session.email} active="kit-video">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Rituel vidéo `/kit`
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Éditeur singleton de la section « Les gestes » : URL YouTube, provenance,
          chapitres, accent. Cascade : <em>override publié → mock</em>. Reset =
          retour au mock du repo.
        </p>
      </header>

      <KitVideoEditor initial={override} source={resolved.meta.source} />
    </AdminShell>
  );
}
