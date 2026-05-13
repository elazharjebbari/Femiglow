# 00.3 — Critères de succès

> Conditions mesurables pour considérer le chantier comme « terminé ».
> Chaque critère a une référence stable (F.x, T.x, Q.x, P.x).

## F — Critères fonctionnels

- [ ] **F.1** — L'admin accède à `/admin/tracking/events/mappings` et voit la liste des versions (active marquée distinctement, drafts, archived).
- [ ] **F.2** — L'admin peut créer une **nouvelle version** depuis :
  - (a) le default (`__default__`)
  - (b) une version existante (clone)
  - (c) un fichier JSON externe (import)
- [ ] **F.3** — L'admin peut **éditer une cellule** du tableau pivot (un event × un provider) et sauvegarder.
- [ ] **F.4** — La sauvegarde d'une édition crée **automatiquement une nouvelle version** (D-001 immutable), l'ancienne reste archivée.
- [ ] **F.5** — L'admin peut **activer** une version : cela désactive l'active courante et marque la nouvelle comme `active`, transactionnellement.
- [ ] **F.6** — L'admin peut **archiver / désarchiver** une version (status switch sans perte de données).
- [ ] **F.7** — L'admin peut **soft-delete** une version archivée (status `deleted`, exclu de la liste par défaut).
- [ ] **F.8** — L'admin peut **dupliquer** une version (clone explicite, status `draft`).
- [ ] **F.9** — L'admin peut **comparer 2 versions** côté-à-côté avec diff visuel (added/removed/changed par cellule).
- [ ] **F.10** — L'admin peut **tester** un mapping : "envoie un purchase test" → affiche le résultat dispatch dry-run pour chaque provider (sans appel réseau réel).
- [ ] **F.11** — L'admin peut **exporter** une version en GTM Container JSON et la télécharger. Le fichier produit est importable dans GTM Web sans erreur.
- [ ] **F.12** — L'admin peut **revenir au default** en 1 click. L'action crée un audit log et active la version `__default__`.

## T — Critères techniques

- [ ] **T.1** — Migration `0032_event_mapping_versions.sql` crée la table `event_mapping_versions` (PK, status, mappings JSONB, audit cols, index status).
- [ ] **T.2** — Migration `0033_event_mapping_audit.sql` crée la table d'audit `event_mapping_audit` (action, actor, before/after JSONB).
- [ ] **T.3** — Fonction `resolveEventMapping(eventName, providerKind): Promise<{ mappedName, isCustom, isEnabled }>` implémentée, cache 30s in-memory.
- [ ] **T.4** — Dispatcher `lib/tracking/server/dispatcher.ts` utilise `resolveEventMapping` au lieu de l'import direct de `event-mapping.ts`.
- [ ] **T.5** — Fonction `exportToGtmContainer(versionId): GtmContainerJson` produit un format compatible GTM Container Import (testé via round-trip dans CI).
- [ ] **T.6** — Toutes les routes API admin sont protégées par session admin et auditées via `auditTrackingChange`.
- [ ] **T.7** — Validation Zod stricte : noms d'events Meta limités à `^[A-Za-z][A-Za-z0-9_ ]{0,38}$`, GA4 `^[a-z][a-z0-9_]{0,39}$`, etc. (formats vendors documentés).
- [ ] **T.8** — Test CI obligatoire : `pnpm tracking:check-default-mapping` qui détecte les divergences entre `default-mapping.json` et `event-mapping.ts`.

## Q — Critères qualité

- [ ] **Q.1** — Coverage Vitest > 85% sur `lib/tracking/mappings/*`.
- [ ] **Q.2** — Coverage Vitest > 80% sur les routes API admin.
- [ ] **Q.3** — Playwright e2e couvre les 12 critères F.* avec au moins 1 scénario par F.
- [ ] **Q.4** — Test ultime "round-trip GTM" : version → export → réimport → diff = ∅.
- [ ] **Q.5** — axe-core 0 violation critical/serious sur la page admin.
- [ ] **Q.6** — Navigation clavier complète (Tab + Shift+Tab + Enter + Esc + Arrow keys dans la matrice).

## UX — Critères ergonomie

- [ ] **UX.1** — Temps moyen pour éditer 1 mapping (édit + save + activate) < 30 sec.
- [ ] **UX.2** — Le diff visuel entre 2 versions est lisible en 1 coup d'œil (couleurs vert/rouge, max 3 colonnes : event, provider, before, after).
- [ ] **UX.3** — Microcopy fr-MA cohérente avec le reste de l'admin FemiGlow (voir `microcopy.csv`).
- [ ] **UX.4** — Empty states explicites : 0 versions, 1 version active sans archive, etc.
- [ ] **UX.5** — Confirm modale obligatoire pour : activate, delete, reset default.
- [ ] **UX.6** — Toasts feedback < 200ms après une action user.
- [ ] **UX.7** — Persistance des filtres de la matrice dans l'URL (deep-linkable).

## P — Critères performance

- [ ] **P.1** — `GET /api/admin/tracking/events/mappings` p95 < 150ms (liste).
- [ ] **P.2** — `GET /api/admin/tracking/events/mappings/[id]` p95 < 100ms (fetch détail).
- [ ] **P.3** — Page admin LCP < 200ms sur localhost (build prod).
- [ ] **P.4** — Export GTM Container JSON pour 200 mappings < 500ms côté serveur.
- [ ] **P.5** — `resolveEventMapping` p99 < 5ms (avec cache hit).

## S — Critères sécurité

- [ ] **S.1** — Toutes les routes admin requièrent une session admin valide (401 sinon).
- [ ] **S.2** — Le default `__default__` est **read-only** : tentative d'édition/delete → 403.
- [ ] **S.3** — Audit log enregistre `actor_id`, `action`, `before`, `after` pour chaque mutation.
- [ ] **S.4** — Pas de PII (email, téléphone) dans les mappings → pas d'enjeu RGPD direct sur cette table.
- [ ] **S.5** — Rate limit anti-spam sur les routes write (10 req/sec/admin).

## G — Critères globaux

- [ ] **G.1** — Le runbook `80-runbook/deployment.md` est validé manuellement en staging.
- [ ] **G.2** — Le runbook `80-runbook/rollback.md` est testé (drill).
- [ ] **G.3** — Documentation `docs/event-mappings/` complète et review approuvée.
- [ ] **G.4** — Le test ultime round-trip GTM est vert en CI.
