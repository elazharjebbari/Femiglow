# 00.1 — Executive summary

## Contexte

FemiGlow track ~30 événements canoniques (purchase, form_start, lead_capture,
view_item, etc.) qui doivent être traduits vers 6 providers vendors :
Meta, GA4, Google Ads, TikTok, Snap, Pinterest. Aujourd'hui ces mappings
sont **hardcodés** dans `apps/web/src/lib/tracking/providers/event-mapping.ts`.

**Friction métier identifiée** :
- Renommer un Meta CustomEvent = PR + review + build + deploy (~24h)
- Ajouter un nouveau provider = code dans event-mapping.ts + propagation dispatcher + tests
- Marketing dépendant de l'équipe dev pour toute modif tagging
- Export GTM se fait manuellement (export JSON → import GTM UI)

## Objectif

Livrer une **console admin** versionnée et exportable qui permet de :
1. Visualiser tous les mappings event→vendor dans un tableau pivot
2. Éditer les mappings par cellule sans toucher au code
3. Versionner chaque changement (clone, audit, rollback)
4. Exporter une version vers GTM Container JSON importable
5. Revenir au default factory en 1 click

## Enjeux business

| Métier | Mesure actuelle | Objectif post-livraison | Levier |
|---|---|---|---|
| Time-to-deploy d'un nouveau mapping | ~24h (PR + deploy) | **~5 min** (admin → activate) | UI admin self-service |
| Risque d'erreur lors d'un import GTM manuel | élevé (copy-paste) | **nul** | Export Container JSON officiel |
| Audit trail des changements mappings | git log seul | **DB versions + audit_log structuré** | Versioning DB + audit |
| Autonomie marketing | 0% | **80%** (sans avoir besoin de dev) | UI + validation Zod + bouton Tester |
| Réutilisabilité (rollback config) | manuelle git revert | **1 click "Activer version N"** | Système de versions |

## Architecture cible (haut niveau)

```
                       Console admin /admin/tracking/events/mappings
                              │
                              ├─ Liste des versions (active, drafts, archived)
                              ├─ Éditeur de version (matrice pivot)
                              ├─ Diff visuel entre versions
                              ├─ Test event (validation Zod + dry-run)
                              ├─ Export GTM (download JSON)
                              └─ Reset au default (1 click)
                              │
                              ▼
                   API /api/admin/tracking/events/mappings/*
                              │
                              ▼
                   Service `resolveEventMapping(eventName, providerKind)`
                              │
                              ├─ 1. Read DB : event_mapping_versions WHERE is_active=true
                              ├─ 2. Lookup mappings_jsonb[eventName][providerKind]
                              ├─ 3. Fallback default si null/missing
                              │
                              ▼
                   Consommé par : `lib/tracking/server/dispatcher.ts`
                                   (chaque event → mapping → dispatch vendor)
                                  `lib/tracking/gtm/export.ts`
                                   (export GTM Container JSON)
```

## Effort total estimé

| Chantier | Effort | % |
|---|---|---|
| Backend (migrations, services, routes, export) | 18-22 h | 35% |
| Frontend (UI versions + matrice + diff + wizard) | 22-28 h | 45% |
| Tests (Vitest + Playwright + MSW) | 8-12 h | 15% |
| Documentation + ADR finalisation | 3-5 h | 5% |
| **TOTAL** | **~55-67 h** | **100%** |

Soit ~1.5 semaine ingé focus (1 dev full-time).

## Périmètre V1 (in-scope)

- ✅ CRUD versions (create/edit-via-clone/activate/duplicate/archive/delete)
- ✅ Matrice pivot éditable event × provider
- ✅ Diff visuel entre 2 versions
- ✅ Bouton "Tester" qui simule dispatch dry-run par provider
- ✅ Export GTM Container JSON (import manuel par admin via GTM UI)
- ✅ Reset au default (un seul click, garde audit trail)
- ✅ Audit log toutes actions admin (création, activation, etc.)
- ✅ Pagination + filtre (par provider, par status)

## Hors périmètre V1 (V2+)

- ❌ Push direct vers GTM via Tag Manager API officielle (OAuth — V2)
- ❌ Branching (plusieurs versions actives en parallèle pour A/B) — V2
- ❌ Reactive update sans rebuild (cache invalidation auto) — V1 = TTL cache 30s
- ❌ Multi-tenant (un mapping par site) — V1 single tenant

## Livrables attendus

**Code** :
- Migrations DB 0032 + 0033 (event_mapping_versions + event_mappings)
- `lib/tracking/mappings/store.ts` (CRUD + versioning)
- `lib/tracking/mappings/resolver.ts` (résolution event → vendor)
- `lib/tracking/mappings/gtm-export.ts` (export Container JSON)
- 8 routes API REST sous `/api/admin/tracking/events/mappings`
- Page `/admin/tracking/events/mappings` + 5 composants React
- `default-mapping.json` (seed initial = current event-mapping.ts)

**Tests** :
- 30+ tests Vitest (services + routes + components unit)
- 12+ scénarios Playwright (CRUD + diff + export + reset)
- MSW handlers (réutilise ceux du chantier tracking-improvement)
- 1 test "ULTIMATE export-to-GTM" : crée une version → exporte → réimporte → vérif round-trip

**Documentation** :
- Ce dossier complet (`docs/event-mappings/`)
- ADR pour les 4 décisions architecturales majeures
- Runbook de déploiement + rollback
- Microcopy française complète (`50-ui-ux-design/microcopy.csv`)

## Critères de succès (détail dans `success-criteria.md`)

- **Fonctionnels** : 12 critères F.* listés (cf. success-criteria.md)
- **Techniques** : coverage > 85% sur `lib/tracking/mappings/*`
- **Qualité** : axe-core 0 violation critical, navigation clavier complète
- **Performance** : page admin < 200ms LCP, export GTM < 500ms pour 200 mappings

## Statut

🟡 **Draft** — pas encore validé pour exécution. Sert de base au plan
d'action `90-plan/action-plan.yaml` qui peut suivre.

## Liens

- [Glossary](./glossary.md)
- [Scope](./scope.md)
- [Success criteria](./success-criteria.md)
- [Stakeholders](./stakeholders.md)
- [Action plan](../90-plan/action-plan.yaml)
