# 06 — Plan d'action admin

Découpage de l'implémentation de l'interface back-office du composant « Rituels partagés ». Couvre layout, pages, composants, modales, e-mails et tests.

## 1. Inventaire des livrables

| # | Domaine | Livrable | Localisation |
| --- | --- | --- | --- |
| A1 | Layout | Layout admin rituals | `apps/web/src/app/admin/rituals/layout.tsx` |
| A2 | Pages | Queue page | `apps/web/src/app/admin/rituals/queue/page.tsx` |
| A3 | Pages | Liste publiée | `apps/web/src/app/admin/rituals/published/page.tsx` |
| A4 | Pages | Archivés | `apps/web/src/app/admin/rituals/archived/page.tsx` |
| A5 | Pages | Détail | `apps/web/src/app/admin/rituals/[id]/page.tsx` |
| A6 | Pages | Insights | `apps/web/src/app/admin/rituals/insights/page.tsx` |
| A7 | Pages | Politique éditeur | `apps/web/src/app/admin/rituals/politique/page.tsx` |
| A8 | Composants | `RitualsAdminTable` | `apps/web/src/components/admin/rituals/RitualsAdminTable.tsx` |
| A9 | Composants | `RitualsAdminFilters` | `.../RitualsAdminFilters.tsx` |
| A10 | Composants | `RitualDetailPreview` | `.../RitualDetailPreview.tsx` |
| A11 | Composants | `RitualDetailActions` | `.../RitualDetailActions.tsx` |
| A12 | Composants | `RitualDetailMetadata` | `.../RitualDetailMetadata.tsx` |
| A13 | Composants | `RitualPhotosPanel` | `.../RitualPhotosPanel.tsx` |
| A14 | Composants | `AuditLogList` | `.../AuditLogList.tsx` |
| A15 | Composants | `ModerationActionModals` | `.../ModerationActionModals.tsx` |
| A16 | Composants | `PolicyEditor` (Markdown) | `.../PolicyEditor.tsx` |
| A17 | Composants | `InsightsDashboard` | `.../InsightsDashboard.tsx` |
| A18 | Composants | `BulkActionsBar` | `.../BulkActionsBar.tsx` |
| A19 | Composants | `FaceDetectionOverlay` | `.../FaceDetectionOverlay.tsx` |
| A20 | Hooks | `useAdminRituals` | `apps/web/src/lib/rituals/hooks/admin/use-admin-rituals.ts` |
| A21 | Hooks | `useAdminRitualAction` | `.../use-admin-ritual-action.ts` |
| A22 | E-mails | Templates de retour | `apps/web/content/email-templates/rituals/*.md` |
| A23 | Navigation | Ajout entrée sidebar admin | `apps/web/src/components/admin/AdminSidebar.tsx` |
| A24 | RBAC | Vérification rôles dans actions | `apps/web/src/lib/auth/can-rituals.ts` |

## 2. Phase A1 — Layout admin

### 2.1 Structure

```tsx
// apps/web/src/app/admin/rituals/layout.tsx
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { RitualsTabs } from '@/components/admin/rituals/RitualsTabs';

export default async function RitualsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <AdminShell title="Rituels partagés">
      <RitualsTabs />
      {children}
    </AdminShell>
  );
}
```

### 2.2 Tabs

```tsx
const tabs = [
  { href: '/admin/rituals/queue', label: 'Queue', badge: 'pending_count' },
  { href: '/admin/rituals/published', label: 'Publiés' },
  { href: '/admin/rituals/archived', label: 'Masqués / Rejetés' },
  { href: '/admin/rituals/insights', label: 'Insights' },
  { href: '/admin/rituals/politique', label: 'Politique' },
];
```

Le badge `pending_count` est récupéré côté serveur RSC, affiché en rouge si > 0.

### 2.3 DoD

- ✓ Navigation entre 5 onglets fonctionnelle.
- ✓ Badge pending compte exact.
- ✓ Pas d'accès si non admin (redirect login).

## 3. Phase A2 — Page queue

### 3.1 Composition

```tsx
export default async function QueuePage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseFiltersFromSearchParams(searchParams);
  const data = await fetchAdminQueue(filters);

  return (
    <>
      <RitualsAdminFilters value={filters} />
      <BulkActionsBar selectedIds={[]} />
      <RitualsAdminTable items={data.items} hasMore={data.hasMore} variant="queue" />
    </>
  );
}
```

### 3.2 Table queue

Composant `RitualsAdminTable` avec variants `queue`, `published`, `archived`.

Variant `queue` affiche les cartes au lieu d'un tableau :

```tsx
<div role="list" className="space-y-4">
  {items.map((item) => (
    <article key={item.id} className="ritual-queue-card">
      {item.autoFlags.includes('face_detected') && (
        <span className="badge-priority">PRIORITÉ</span>
      )}
      {item.autoFlags.length > 0 && (
        <FlagsIndicator flags={item.autoFlags} />
      )}
      <Cormorant.Italic>« {truncate(item.body, 120)} »</Cormorant.Italic>
      <Signature {...item.signature} />
      <Metadata source={item.source} verifiedPurchase={item.verifiedPurchase} createdAt={item.createdAt} />
      <Button asChild variant="primary">
        <Link href={`/admin/rituals/${item.id}`}>Voir détail</Link>
      </Button>
    </article>
  ))}
</div>
```

### 3.3 Tests

```tsx
describe('QueuePage', () => {
  it('liste les PENDING par défaut', async () => {
    setupAdminMSW({ rituals: [{ status: 'PENDING' }, { status: 'PENDING' }] });
    render(<QueuePage searchParams={{}} />);
    expect(await screen.findAllByRole('article')).toHaveLength(2);
  });

  it('badge PRIORITÉ si auto-flag face_detected', async () => {
    setupAdminMSW({ rituals: [{ status: 'PENDING', autoFlags: ['face_detected'] }] });
    render(<QueuePage searchParams={{}} />);
    expect(await screen.findByText('PRIORITÉ')).toBeInTheDocument();
  });

  it('tri par défaut : plus ancien d’abord', async () => {
    setupAdminMSW({ rituals: [old, recent] });
    render(<QueuePage searchParams={{}} />);
    const cards = await screen.findAllByRole('article');
    expect(within(cards[0]).getByText(/Initiée fixt-old/)).toBeInTheDocument();
  });
});
```

### 3.4 DoD

- ✓ Liste PENDING affichée.
- ✓ Filtres et tri opérationnels.
- ✓ Tests verts.

## 4. Phase A5 — Page détail

### 4.1 Layout 2 colonnes

```tsx
export default async function DetailPage({ params }: { params: { id: string } }) {
  const ritual = await fetchAdminRitualDetail(params.id);
  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-8">
      <main>
        <RitualDetailPreview ritual={ritual} />
      </main>
      <aside className="sticky top-4 h-fit space-y-6">
        <RitualDetailActions ritual={ritual} />
        <RitualDetailMetadata ritual={ritual} />
        <AuditLogList testimonialId={ritual.id} />
      </aside>
    </div>
  );
}
```

### 4.2 `RitualDetailPreview`

Rendu **fidèle** de la carte telle qu'elle sera publiée :

- Citation Cormorant 17 pt italic.
- Photos affichées avec rectangles ML si visages détectés (composant `FaceDetectionOverlay`).
- Tags + signature + badge.
- Bouton « Voir en plein écran » qui ouvre une preview modale 480 px (taille drawer réelle).

### 4.3 `RitualDetailActions`

```tsx
<aside className="space-y-3">
  <Button onClick={openApproveModal} disabled={ritual.status === 'APPROVED'} variant="primary">
    Approuver
  </Button>
  <Button onClick={openRejectModal} variant="secondary">
    Rejeter
  </Button>
  {ritual.status === 'APPROVED' && (
    <>
      <Button onClick={openHideModal} variant="secondary">Masquer</Button>
      <Button onClick={() => toggleFeatured(ritual.id)} variant="secondary">
        {ritual.featured ? 'Retirer la mise en avant' : 'Mettre en avant'}
      </Button>
    </>
  )}
  {(ritual.status === 'HIDDEN' || ritual.status === 'REJECTED') && (
    <Button onClick={openRestoreModal} variant="secondary">Restaurer</Button>
  )}
  <Button onClick={openCorrectModal} variant="secondary-small">Corriger une coquille</Button>
</aside>
```

### 4.4 `ModerationActionModals`

Une modale par action :

| Action | Champs requis | Action serveur |
| --- | --- | --- |
| Approve | Confirmation simple ; si `face_detected` flag, modal renforcée avec choix `Publier sans cette photo` / `Annuler` | `PATCH /api/admin/rituals/[id] { action: 'approve' }` |
| Reject | Raison interne (textarea) + sélecteur template + zone édition | `PATCH ... { action: 'reject', note, emailTemplate, emailBody }` |
| Hide | Raison | `PATCH ... { action: 'hide', note }` |
| Restore | Confirmation | `PATCH ... { action: 'restore' }` |
| Correct | Editor texte avec diff visuel, max 5 chars | `PATCH ... { action: 'correct', newBody, note }` |

### 4.5 Tests

```tsx
describe('RitualDetailActions', () => {
  it('approve déclenche PATCH', async () => {
    const ritual = makeFixture({ status: 'PENDING' });
    const { user } = render(<RitualDetailActions ritual={ritual} />);
    await user.click(screen.getByText('Approuver'));
    await user.click(screen.getByText('Confirmer'));
    expect(mswHandlerInvocations.PATCH).toHaveBeenCalledWith(
      `/api/admin/rituals/${ritual.id}`,
      expect.objectContaining({ body: expect.objectContaining({ action: 'approve' }) })
    );
  });

  it('reject ouvre modal avec template pré-rempli si face_detected', async () => {
    const ritual = makeFixture({ autoFlags: ['face_detected'] });
    const { user } = render(<RitualDetailActions ritual={ritual} />);
    await user.click(screen.getByText('Rejeter'));
    const textarea = screen.getByLabelText(/Message à l'auteure/);
    expect(textarea).toHaveValue(expect.stringContaining('Pour préserver l’intimité de notre maison'));
  });

  it('correction > 5 chars demande re-modération', async () => {
    const ritual = makeFixture({ body: 'Original text here' });
    const { user } = render(<RitualDetailActions ritual={ritual} />);
    await user.click(screen.getByText('Corriger une coquille'));
    const editor = screen.getByRole('textbox', { name: /Texte corrigé/ });
    await user.clear(editor);
    await user.type(editor, 'Very different new text completely');
    await user.click(screen.getByText('Sauvegarder'));
    expect(screen.getByText(/Cette correction est substantielle/)).toBeInTheDocument();
  });
});
```

### 4.6 DoD

- ✓ 5 actions opérationnelles.
- ✓ Audit log mis à jour après chaque action.
- ✓ Modales validées par Souheila.

## 5. Phase A13 — Panneau photos

### 5.1 `RitualPhotosPanel`

```tsx
export function RitualPhotosPanel({ photos, onOverride, onReject, onRecheck }: Props) {
  return (
    <section aria-label="Photos du témoignage">
      {photos.map((photo) => (
        <div key={photo.id} className="photo-admin-card">
          <FaceDetectionOverlay photo={photo} />
          <div className="photo-status">
            <Badge variant={statusColor(photo.facesStatus)}>{statusLabel(photo.facesStatus)}</Badge>
            {photo.facesCount > 0 && <span>{photo.facesCount} visage(s) détecté(s)</span>}
          </div>
          {photo.facesStatus === 'MANUAL_REVIEW' && (
            <div className="photo-actions">
              <Button onClick={() => onOverride(photo.id)}>Approuver la photo</Button>
              <Button onClick={() => onReject(photo.id)}>Rejeter la photo</Button>
              <Button variant="link" onClick={() => onRecheck(photo.id)}>Re-run vision ML</Button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
```

### 5.2 `FaceDetectionOverlay`

Composant qui superpose les bounding boxes sur la photo (canvas ou divs absolus).

### 5.3 Tests

Cf. `↗ 17-moderation-workflow.md § 4.3`. Particulièrement tester que :

- Photo `OK` n'a pas d'overlay.
- Photo `MANUAL_REVIEW` affiche rectangle orange.
- Photo `REJECTED_FACE` affiche rectangle rouge.
- Click `Approuver la photo` appelle l'endpoint d'override.

## 6. Phase A6 — Dashboard Insights

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  KPI globaux                                                 │
│  ┌─────────┬─────────┬─────────┬─────────┐                   │
│  │  26     │   3     │   1     │   0     │                   │
│  │ publiés │ pending │ rejetés │ masqués │                   │
│  └─────────┴─────────┴─────────┴─────────┘                   │
│                                                              │
│  Reviendraient : 92,3 % (24 sur 26)                          │
│  Avec photos : 69,2 %                                        │
│  Initiée vérifiée : 80,8 %                                   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Tags les plus mentionnés                                    │
│  ongles plus lisses    ████████████████  17                  │
│  plaque souple         █████████████     14                  │
│  ...                                                         │
├─────────────────────────────────────────────────────────────┤
│  Soumissions dans le temps (90 j)                            │
│  [graphique linéaire]                                        │
├─────────────────────────────────────────────────────────────┤
│  Sources / SLA / Taux d'approbation                          │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Composants

Réutilise `lib/analytics/format.ts`. Composants `KpiTile`, `HorizontalBarChart`, `TimeSeriesLineChart` à créer dans `components/admin/charts/` ou réutilisation existante.

### 6.3 DoD

- ✓ Dashboard affiche les KPI réels.
- ✓ Alerte rouge si SLA dépassé.

## 7. Phase A7 — Éditeur politique

### 7.1 PolicyEditor

```tsx
'use client';
import { useState } from 'react';
import { MarkdownPreview } from '@/components/markdown/MarkdownPreview';

export function PolicyEditor({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);

  const save = async () => {
    setSaving(true);
    await fetch('/api/admin/rituals/policy', { method: 'PATCH', body: JSON.stringify({ text }) });
    setSaving(false);
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={20} />
      <MarkdownPreview content={text} />
      <Button onClick={save} disabled={saving}>Publier</Button>
      <PolicyVersionsList versions={versions} onRestore={(v) => setText(v.text)} />
    </div>
  );
}
```

### 7.2 Tests

```tsx
describe('PolicyEditor', () => {
  it('preview met à jour en temps réel', async () => {
    render(<PolicyEditor initialText="# Titre" />);
    const editor = screen.getByRole('textbox');
    await userEvent.clear(editor);
    await userEvent.type(editor, '# Nouveau titre');
    expect(screen.getByRole('heading', { name: 'Nouveau titre' })).toBeInTheDocument();
  });

  it('publish appelle PATCH', async () => {
    render(<PolicyEditor initialText="texte" />);
    await userEvent.click(screen.getByText('Publier'));
    expect(mswHandlerInvocations.PATCH).toHaveBeenCalledWith('/api/admin/rituals/policy', expect.anything());
  });
});
```

## 8. Phase A18 — Bulk actions

### 8.1 BulkActionsBar

Apparaît en haut de la queue dès qu'au moins un témoignage est coché.

```tsx
<div className="bulk-bar">
  <span>{selectedIds.length} sélectionné(s)</span>
  <Button onClick={bulkApprove} disabled={hasCriticalFlags}>Approuver en masse</Button>
  <Button onClick={openBulkReject}>Rejeter en masse</Button>
  <Button variant="link" onClick={clearSelection}>Désélectionner tout</Button>
</div>
```

### 8.2 Sécurité

Bulk approve **interdit** si au moins une carte sélectionnée a un flag critique (`face_detected`, `forbidden_word`). Le bouton est désabilité avec tooltip.

## 9. Phase A14 — Audit log

### 9.1 Composant

```tsx
export function AuditLogList({ testimonialId }: { testimonialId: string }) {
  const { data } = useQuery({
    queryKey: ['admin', 'rituals', testimonialId, 'audit'],
    queryFn: () => fetchAuditLog(testimonialId),
  });

  return (
    <ol className="audit-log">
      {data?.map((event) => (
        <li key={event.id}>
          <time>{formatRelative(event.createdAt)}</time>
          <span>{event.actorName ?? 'système'}</span>
          <code>{event.action}</code>
          {event.note && <p>{event.note}</p>}
        </li>
      ))}
    </ol>
  );
}
```

### 9.2 Tests

- Render avec fixtures.
- Tri du plus récent au plus ancien.
- Pas de log → message « Aucune action enregistrée ».

## 10. Phase A22 — E-mail templates

### 10.1 Templates

Fichiers Markdown dans `apps/web/content/email-templates/rituals/` :

- `j45.md` — invitation J+45 après commande.
- `approved.md` — confirmation publication.
- `rejected-face.md` — rejet visage.
- `rejected-other.md` — rejet autre raison.
- `photo-rejected.md` — photo seule rejetée.

Cf. `↗ 10-interface-admin.md § 14` et `↗ 17-moderation-workflow.md § 7` pour contenu.

### 10.2 Rendu

Utilise `lib/markdown/` existant. Variables remplacées au send via Mustache-like simple `{{firstName}}`.

### 10.3 Tests

```ts
describe('email templates', () => {
  it('j45 remplace {{firstName}} et {{ctaUrl}}', () => {
    const rendered = renderEmail('rituals/j45.md', { firstName: 'Amal', ctaUrl: 'https://...' });
    expect(rendered).toContain('Bonjour Amal');
    expect(rendered).toContain('https://...');
  });
});
```

## 11. Phase A23 — Navigation sidebar

### 11.1 Patch

`apps/web/src/components/admin/AdminSidebar.tsx` (ou équivalent) :

```diff
  const items = [
    { href: '/admin', label: 'Tableau de bord' },
    ...
+   {
+     label: 'Communauté',
+     children: [
+       { href: '/admin/leads', label: 'Leads' },
+       { href: '/admin/rituals/queue', label: 'Rituels partagés', badge: 'pending' },
+     ],
+   },
    ...
  ];
```

### 11.2 Badge

Pending count fetché côté server, affiché si > 0 en rouge feutré.

## 12. Phase A24 — RBAC

### 12.1 `can-rituals.ts`

```ts
export type RitualAction = 'view' | 'approve' | 'reject' | 'hide' | 'restore' | 'feature' | 'correct' | 'delete_rgpd';

export function canRitualAction(role: string, action: RitualAction): boolean {
  const matrix: Record<string, RitualAction[]> = {
    admin: ['view', 'approve', 'reject', 'hide', 'restore', 'feature', 'correct', 'delete_rgpd'],
    moderator: ['view', 'approve', 'reject', 'hide', 'restore', 'correct'],
    viewer: ['view'],
  };
  return matrix[role]?.includes(action) ?? false;
}
```

### 12.2 Usage

```tsx
const canApprove = canRitualAction(session.role, 'approve');
<Button disabled={!canApprove}>Approuver</Button>;
```

Côté serveur, vérifier dans le handler PATCH avant d'appliquer.

### 12.3 Tests

```ts
describe('canRitualAction', () => {
  it('admin peut tout faire', () => {
    expect(canRitualAction('admin', 'delete_rgpd')).toBe(true);
  });
  it('moderator ne peut pas feature', () => {
    expect(canRitualAction('moderator', 'feature')).toBe(false);
  });
  it('viewer peut seulement view', () => {
    expect(canRitualAction('viewer', 'approve')).toBe(false);
    expect(canRitualAction('viewer', 'view')).toBe(true);
  });
});
```

## 13. Charge admin récapitulative

| Phase | Charge |
| --- | --- |
| A1 Layout | 0,3 j |
| A2 Queue page | 1 j |
| A3-A4 Publiés + archivés | 0,5 j |
| A5 Détail page | 1 j |
| A6 Insights | 1 j |
| A7 Politique editor | 0,5 j |
| A8 RitualsAdminTable | 0,5 j |
| A9 RitualsAdminFilters | 0,5 j |
| A10-A12 Detail components | 0,5 j |
| A13 RitualPhotosPanel + FaceOverlay | 0,5 j |
| A14 AuditLogList | 0,3 j |
| A15 Moderation modals | 0,5 j |
| A16 PolicyEditor | 0,3 j |
| A17 InsightsDashboard | 0,5 j |
| A18 BulkActions | 0,3 j |
| A20-A21 Hooks | 0,5 j |
| A22 E-mail templates | 0,3 j |
| A23 Sidebar nav | 0,2 j |
| A24 RBAC | 0,3 j |
| **Total** | **~9 j** |

## 14. Module import — extension admin

Le système d'import ajoute les livrables admin suivants. Spécification détaillée dans `↗ 14-import-wizard-ui-specification.md`.

| # | Livrable | Localisation | Charge |
| --- | --- | --- | --- |
| A25 | Route `/admin/rituals/import` (étape 1 par défaut) | `apps/web/src/app/admin/rituals/import/page.tsx` | 0,3 j |
| A26 | Route `/admin/rituals/import/[batchId]/[step]` | `.../[batchId]/[step]/page.tsx` | 0,2 j |
| A27 | Layout import (stepper sticky) | `.../layout.tsx` | 0,3 j |
| A28 | `ImportWizardStep1Format` | `components/admin/rituals/import/Step1Format.tsx` | 0,2 j |
| A29 | `ImportWizardStep2Upload` (drop + progress) | `.../Step2Upload.tsx` | 0,3 j |
| A30 | `ImportWizardStep3Mapping` (table colonnes) | `.../Step3Mapping.tsx` | 0,3 j |
| A31 | `ImportWizardStep4Preview` (synthèse + filtre + bulk + cards) | `.../Step4Preview.tsx` | 0,7 j |
| A32 | `ImportRowEditModal` | `.../ImportRowEditModal.tsx` | 0,2 j |
| A33 | `ImportWizardStep5Commit` (confirmation) | `.../Step5Commit.tsx` | 0,2 j |
| A34 | `ImportWizardStep6Report` (succès + rollback) | `.../Step6Report.tsx` | 0,2 j |
| A35 | Page `/admin/rituals/import/history` | `.../history/page.tsx` | 0,3 j |
| A36 | Page `/admin/rituals/import/help` | `.../help/page.tsx` | 0,3 j |
| A37 | `BulkActionBar` générique | `components/admin/bulk/BulkActionBar.tsx` | 0,3 j |
| A38 | `BulkActionModal` + `BulkActionDestructiveModal` | `.../BulkActionModal.tsx` | 0,3 j |
| A39 | `BulkSelectionContext` + hook `useBulkSelection` | `lib/admin/bulk/` | 0,3 j |
| A40 | Intégration bulk sur queue, published, archived | mise à jour des pages existantes | 0,5 j |
| **Total** | | | **~5 j** |

Le cumul admin (interface modération existante + import + bulk) = **~14 j**.

## 15. Synthèse — règles d'or admin

1. **`requireAdmin()` au layout**, pas seulement à chaque page (sécurité par défaut).
2. **Toutes les mutations passent par `PATCH` typed**, validation Zod stricte côté API.
3. **Audit log écrit avant la réponse** (pas après — atomicité).
4. **Bulk approve désabilité si flag critique** parmi les sélections — option `skipFlagged` proposée.
5. **Pas de suppression directe**, sauf RGPD avec **double confirmation et tapage explicite**.
6. **RBAC matrix** (`admin` / `moderator` / `viewer`) maintenue dans un seul fichier, étendu aux actions import et bulk.
7. **Templates e-mails versionnés en BDD** (`app_config`).
8. **Preview admin = preview public** exact pour éviter les surprises post-publish.
9. **Tests Vitest > 85 % couverture** sur composants admin.
10. **Pas de mutation depuis la liste** ; toujours passer par la vue détail (sauf bulk explicite).
11. **Import : preview obligatoire avant commit**, rollback 24 h possible.
12. **Bulk system générique réutilisable** : composants découplés du composant rituals.
13. **Page d'aide import éditable en Markdown** depuis `app_config`.
14. **Stepper sticky du wizard import** toujours visible pour orientation.
