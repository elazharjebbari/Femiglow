# Component-Media — runbook opérationnel

## 1. Bootstrap initial (premier déploiement)

```bash
# 1. Synchroniser le registry TS → DB
pnpm --filter @femiglow/web tsx scripts/seed-components.ts --dry-run
# Vérifier le rapport : components.synced > 0, errors = []

# 2. Lancer le seed réel (toujours avec --dry-run d'abord !)
pnpm --filter @femiglow/web tsx scripts/seed-components.ts
# → 36 composants, 7 animations, ~43 images

# 3. Activer les bindings depuis l'admin
# /admin/components/[key] → bouton « Activer » sur chaque slot prioritaire
# (ou --auto-activate au seed pour tout activer en bloc — déconseillé en prod)
```

## 2. Ajouter un nouveau composant

1. Ajouter une entrée dans `apps/web/src/lib/components/registry.ts` :
   - `key` stable (jamais renommer après prod !),
   - `slots: SlotDefinition[]`,
   - `defaultSvgFallback`, `defaultLoadingStrategy`, `defaultFetchPriority`,
   - `supportsAnimation` + `metadata.animationProfile`.
2. Créer un `MyComponentBound.tsx` (cf. `04-frontend/component-media.md`).
3. Câbler le bound dans la page concernée.
4. Run `pnpm --filter @femiglow/web typecheck` + `test`.
5. Déployer ; le nouveau composant apparaît dans `/admin/components` après
   premier `resolveComponentSlot` (qui upsert via cache miss) ou via
   `pnpm --filter @femiglow/web sync:components`.

## 3. Re-seed depuis `docs/images/values/`

Trois modes d'entrée :

- **CLI** : `pnpm --filter @femiglow/web tsx scripts/seed-components.ts --dry-run`
- **API** : `POST /api/admin/components/seed-from-docs` (rate-limité 3/5min/IP)
- **UI**  : `/admin/components/seed`

Flags clés :

| Flag             | Effet                                                      |
| ---------------- | ---------------------------------------------------------- |
| `--dry-run`      | Aucune mutation DB ni storage. **Toujours commencer ici.**|
| `--auto-activate`| Force `isActive=true` sur les bindings créés.              |
| `--force`        | Régénère les variants même si le slug existe déjà.         |
| `--force-alt`    | Sur-écrit les `media.alt` existants depuis `seed-alt.ts`.  |
| `--filter <pg>`  | Ne traite que ce `pageGroup` (ex. `home`).                 |

## 4. Rollback rapide d'une mauvaise image

> Pas besoin de toucher la DB. Le binding garde la trace.

1. Aller sur `/admin/components/<key>`.
2. Sur le slot concerné, cliquer **Désactiver**.
3. La page publique tombe sur le SVG fallback (ou le CMS featuredImage si
   défini, selon le composant).
4. Délai de propagation : `revalidateTag('components')` invalide le cache
   immédiatement, mais la CDN reste sur sa TTL (~3600s pour `app/page.tsx`).
   Pour forcer : redéploiement ou purge CDN côté Vercel.

## 5. Renommer / supprimer un composant

⚠ **Renommer une `key` après seed prod = orphelins.** Procédure safe :

1. Désactiver tous les bindings du composant via UI.
2. Retirer du registry TS.
3. Run `DELETE` manuel SQL (ou via task admin) :
   ```sql
   DELETE FROM component_animation_bindings WHERE component_id IN (SELECT id FROM site_components WHERE key = 'old-key');
   DELETE FROM component_media_bindings     WHERE component_id IN (SELECT id FROM site_components WHERE key = 'old-key');
   DELETE FROM site_components              WHERE key = 'old-key';
   ```
4. Déployer la nouvelle version (sans l'ancien composant dans le registry).

## 6. Monitoring & dashboards

- Rate-limit des seeds : tag `seed-components` dans `auditTrackingChange`.
- Bindings inactifs : `SELECT count(*) FROM component_media_bindings WHERE is_active = false;`
- Couverture : `SELECT key FROM site_components WHERE NOT EXISTS (SELECT 1 FROM component_media_bindings WHERE component_id = site_components.id AND is_active = true);`
- Animations sans default : `SELECT key FROM site_components c WHERE supports_animation = true AND NOT EXISTS (SELECT 1 FROM component_animation_bindings WHERE component_id = c.id AND is_default = true);`

## 7. Troubleshooting

| Symptôme                                         | Diagnostic / fix                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Page publique affiche le SVG fallback partout    | Vérifier `is_active` des bindings ; vérifier le tag `components` invalidé.   |
| `400 image.*video` au POST binding              | Le `media.kind` ne match pas `slot.acceptKinds` — choisir un autre média.    |
| Seed renvoie `unmapped: ["..."]`                 | Le filename ne correspond à aucun composant ; renommer le PNG ou ajouter un alias dans `seed-mapping.ts`. |
| `tsx: command not found`                         | Lancer via `pnpm --filter @femiglow/web exec tsx ...` (alias dans le path pnpm). |
| Cache stale en dev                               | `RM -rf .next/cache` puis `pnpm dev` ; en prod, `revalidateTag` est suffisant.|

## 8. Critères de Done

- [x] Registry TS aligné avec les composants RSC consommateurs.
- [x] Seed dry-run sans erreur (errors=[]).
- [x] Au moins un binding actif par slot Hero (`home-hero`, `rituel-hero-lifestyle`, …).
- [x] `/admin/components` accessible avec `admin-storage.json` Playwright.
- [x] Tests : registry, queries, resolver, RTL admin (122 files / 555+ tests verts).
- [x] `next build` sans erreur RSC.
- [x] Documentation à jour dans `docs/admin/specifications/`.
