# Routing — admin/tracking

## 1. Nouvelles routes

| Route | Composant | Description |
|---|---|---|
| `/admin/tracking` | `TrackingPlanHome` | Dashboard d'entrée |
| `/admin/tracking/plans` | `TrackingPlanList` | Liste de toutes les versions |
| `/admin/tracking/plans/new` | `TrackingPlanWizard` | Crée + édite un nouveau plan |
| `/admin/tracking/plans/[id]` | `TrackingPlanDetail` | Vue read-only du plan |
| `/admin/tracking/plans/[id]/edit` | `TrackingPlanWizard` ou `TrackingPlanExpert` selon `?mode=` | Éditeur principal |
| `/admin/tracking/plans/[id]/preview` | `JsonPreview` (page dédiée) | Aperçu JSON exporté avec env switcher |
| `/admin/tracking/sync` | `SyncDashboard` | Drift monitor + diff viewer |

## 2. Query params

### `/admin/tracking/plans/[id]/edit`

- `?mode=wizard` (défaut) | `?mode=expert`
- `?step=1..5` (mode wizard uniquement) — état partagé via URL pour links et reload
- `?focus=providers.meta.pixelId` — scroll & focus auto sur un champ spécifique (utilisé par les redirections legacy)

### `/admin/tracking/plans/[id]/preview`

- `?env=production|staging|preview|dev`
- `?format=pretty|minified`

## 3. Redirections legacy

| Ancienne route | Redirige vers | Notes |
|---|---|---|
| `/admin/tracking/pixels` | `/admin/tracking/plans/active/edit?focus=providers.meta` | "active" résout en uuid via lookup |
| `/admin/tracking/events/mappings` | `/admin/tracking/plans` | Liste des plans (ancien = mappings) |
| `/admin/tracking/events/mappings/[id]` | `/admin/tracking/plans/[id]` | Si mapping_id → plan_id mapping (lookup table temporaire) |
| `/admin/tracking/events/mappings/[id]/edit` | `/admin/tracking/plans/[id]/edit?focus=events` | |
| `/admin/tracking/gtm` | `/admin/tracking/plans/active/edit?mode=expert&focus=envs` | |
| `/admin/tracking/gtm/configurations` | `/admin/tracking/plans/active/edit?focus=identifiers` | |
| `/admin/tracking/gtm/validate-pair` | `/admin/tracking/plans/active/preview?env=production` | La validation est intégrée à l'éditeur |
| `/admin/tracking/gtm/sync-status` | `/admin/tracking/sync` | |

Toutes ces redirections sont des `permanent: false` (302) pour permettre rollback en cas de problème.

## 4. Layout

```tsx
// app/admin/tracking/layout.tsx

export default function TrackingLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <Breadcrumbs items={...} />
      <TrackingNavBar /> {/* tabs : Plans | Sync | Aide */}
      <main className="container mx-auto p-6">
        {children}
      </main>
    </AdminShell>
  );
}
```

## 5. Server / Client components

- **Server components** : pages qui font fetch initial (`page.tsx` racine) + skeletons.
- **Client components** : tous les composants interactifs (`TrackingPlanWizard`, formulaires, store consumers).

Pattern :
```tsx
// app/admin/tracking/plans/[id]/edit/page.tsx
import { TrackingPlanEditClient } from '@/components/admin/tracking/plan/TrackingPlanEditClient';

export default async function Page({ params, searchParams }) {
  const planRecord = await fetchPlanById(params.id); // server-side
  if (!planRecord) notFound();
  return <TrackingPlanEditClient initialPlan={planRecord} mode={searchParams.mode ?? 'wizard'} />;
}
```

## 6. Guards

- **Authentication** : layout vérifie `getServerSession()` → `redirect('/login')` si null.
- **Role** : middleware `requireRole('admin' | 'tracking-manager')`.
- **Active plan present** : redirection `?focus=` nécessite un plan actif — sinon redirige vers `/admin/tracking/plans/new`.

## 7. Loading states

- `loading.tsx` à chaque niveau de route → skeletons.
- `error.tsx` → fallback avec retry.
- `not-found.tsx` → message + lien retour liste.
