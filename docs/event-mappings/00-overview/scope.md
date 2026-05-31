# 00.4 — Scope

## In-scope V1

### Backend
- Nouvelle table `event_mapping_versions` (versionning JSONB)
- Nouvelle table `event_mapping_audit` (audit log structuré)
- Service `lib/tracking/mappings/store.ts` (CRUD + transitions de status)
- Service `lib/tracking/mappings/resolver.ts` (fonction `resolveEventMapping`)
- Service `lib/tracking/mappings/gtm-export.ts` (export GTM Container JSON)
- Service `lib/tracking/mappings/validator.ts` (Zod par provider)
- 8 routes API admin sous `/api/admin/tracking/events/mappings`
- Refactor `lib/tracking/server/dispatcher.ts` pour utiliser `resolveEventMapping`
- Seed automatique : si DB vide → insère version `__default__` depuis `default-mapping.json`
- Migration script `pnpm tracking:check-default-mapping` (CI safeguard)

### Frontend
- Page `/admin/tracking/events/mappings` (server component + client hydration)
- Liste des versions (active marquée, drafts, archived, deleted toggle)
- Wizard "Créer version" (3 modes : depuis default, depuis existante, depuis import)
- Éditeur de version : tableau pivot Event × Provider
- Diff visuel entre 2 versions (side-by-side ou inline switchable)
- Modal "Tester mapping" avec preview dispatch
- Bouton "Exporter GTM" (download JSON)
- Bouton "Reset au default" avec confirm
- Toast notifications + empty states + error states
- Intégration logique dans `/admin/tracking` (entrée menu + breadcrumb)

### Tests
- Vitest unit : services (store, resolver, gtm-export, validator)
- Vitest integration : routes API (8 endpoints × scenarios)
- Playwright e2e : 12 scénarios F.* + a11y
- MSW : réutilise `tracking-providers-handlers.ts` du chantier précédent
- 1 test ULTIMATE round-trip GTM

### Documentation
- Ce dossier complet
- ADRs 001-004
- Runbook deploy/rollback/smoke/incident
- Microcopy fr-MA complète

## Out-of-scope V1 (V2+ ou autre projet)

### Reporté V2
- Push direct GTM via Tag Manager API officielle (OAuth Service Account)
- Branching (plusieurs versions actives simultanément pour A/B sur les mappings)
- Multi-tenant (1 mapping par site dans un setup multi-marques)
- Webhook outbound vers Slack à chaque activation
- Heat-map d'usage par event (KPI usage des mappings réels en prod)
- Suggestions automatiques de mapping (basé sur le naming du standard vendor)

### Hors projet (autre dossier)
- sGTM container Server-Side (cf. `docs/tracking-improvement/` Option C)
- Gestion des Pixel IDs / Conv labels (déjà dans `/admin/tracking/gtm`)
- Catégorisation Google Ads par event (déjà dans `/admin/tracking/events/categorization`)
- Editor GTM Container complet (variables, triggers, tags GTM natifs)

## Contraintes

- Stack obligatoire : Next.js 14 App Router + Drizzle + Postgres + Tailwind + vitest + Playwright
- DB partagée avec le reste de l'app (pas de nouvelle DB séparée)
- Compatibilité avec le code existant `event-mapping.ts` (transition douce)
- Pas de breaking change pour le dispatcher serveur en attendant la migration
- A11y WCAG AA cible (cohérence avec le reste de l'admin)
- Langue UI = fr-MA (cohérence FemiGlow)
- Performance : p95 < 200ms côté admin (cohérence FemiGlow)

## Dépendances externes

- **Pas de dépendance Google Cloud / Vercel Cloud** (V1 reste self-hosted)
- **Pas de dépendance OAuth Google** (V1 reste local)
- **Format GTM Container Import** : documenté par Google, stable (utilisé V1 export V2 push API)
