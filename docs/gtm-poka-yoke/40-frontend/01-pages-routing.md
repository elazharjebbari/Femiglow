# Frontend — Pages et routing

## Pages créées

### `/admin/tracking/gtm/sync-status`
Page server-component principale du système. Affiche l'état complet du Poka-Yoke.

- **Fichier** : `apps/web/src/app/admin/tracking/gtm/sync-status/page.tsx`
- **Auth** : `requireAdmin('/admin/tracking/gtm/sync-status')`
- **Layout** : Utilise `TrackingShell` avec `active="gtm-sync"`.
- **SSR** : Affiche l'état initial.
- **Hydration** : Client-side auto-refresh toutes les 30s via `SyncStatusLive`.

### `/admin/tracking/gtm/validate-pair`
Page wizard pour valider les 2 fichiers avant import.

- **Fichier** : `apps/web/src/app/admin/tracking/gtm/validate-pair/page.tsx`
- **Auth** : `requireAdmin('/admin/tracking/gtm/validate-pair')`
- **Layout** : `TrackingShell` avec `active="gtm-validate"`.
- **Composant principal** : `ValidatePairWizard` (client component).

## Intégration menu `TrackingShell`

Ajout de 2 entrées :

```ts
const TABS = [
  // ... existing entries ...
  { key: 'mappings', href: '/admin/tracking/events/mappings', label: 'Mappings vendors' },
  // NEW:
  { key: 'gtm-sync',     href: '/admin/tracking/gtm/sync-status',  label: 'GTM Sync Status' },
  { key: 'gtm-validate', href: '/admin/tracking/gtm/validate-pair', label: 'Valider import GTM' },
];
```

Ordre choisi : juste après "Mappings vendors" car logiquement c'est leur monitoring.

## Composants

Tous sous `apps/web/src/components/admin/tracking/gtm/`.

### `SyncStatusView` (server)
Affiche les cards + history + timeline. Reçoit data du server.

### `SyncStatusLive` (client)
Wrapper qui auto-refresh toutes les 30s et passe à `SyncStatusView`.

### `DriftBanner` (server)
Banner global injecté dans `TrackingShell`. Lit le drift state.

### `ValidatePairWizard` (client)
Wizard 3 étapes :
1. Drop config.json
2. Drop mapping.json
3. Affiche diff

### `ValidationDiffViewer` (client)
Affiche les errors/warnings/recommendations avec badges colorés.

### `PingTimeline` (client)
Graphe à barres simple (CSS, pas de lib) montrant les pings/jour sur 30j.

## État

| State | Where | Détail |
|---|---|---|
| `syncStatus` (snapshot) | `SyncStatusLive` (useState) | Re-fetch 30s |
| Wizard step (1, 2, 3) | `ValidatePairWizard` (useState) | local |
| Files uploadés | `ValidatePairWizard` (useState) | local, jamais persisté |
| Drift global (banner) | `TrackingShell` (server-fetch) | cache 60s côté serveur |

## Auto-refresh

```ts
// SyncStatusLive.tsx
useEffect(() => {
  const interval = setInterval(() => {
    void refresh();
  }, 30_000);
  return () => clearInterval(interval);
}, [refresh]);
```

Pause si la page est en arrière-plan (`document.visibilityState !== 'visible'`).

## Banner drift global

Le `DriftBanner` est rendu en haut de chaque page admin (via `TrackingShell`).

```tsx
// TrackingShell.tsx (extrait)
import { getDriftStatusForBanner } from '@/lib/tracking/gtm/banner-fetcher';

export async function TrackingShell({ ... }: Props) {
  const drift = await getDriftStatusForBanner();  // cache 60s
  return (
    <AdminShell adminEmail={adminEmail}>
      {drift.status !== 'ok' && <DriftBanner status={drift.status} reasons={drift.reasons} />}
      {/* ... rest of shell */}
    </AdminShell>
  );
}
```

## Loading / Error states

- **Loading** : Skeleton cards (Tailwind animate-pulse) pendant le premier fetch.
- **Error** : Banner d'erreur "Impossible de charger le statut GTM. Vérifier la connectivité DB." avec retry.
- **Empty** : "Aucun ping reçu pour le moment. Cela peut prendre quelques minutes après le premier import."

## A11y

- `aria-live="polite"` sur le drift banner pour annoncer les changements.
- `aria-busy` sur les cards en refresh.
- Focus visible sur tous les liens "Voir détails".
- Touche `R` pour refresh manuel (raccourci documenté).
