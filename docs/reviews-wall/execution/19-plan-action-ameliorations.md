# 19 — Plan d'action : implémentation des améliorations admin

Ce document opérationnalise les douze propositions de `18-ameliorations-admin-controle.md` en un **plan d'exécution séquencé**, jalonné, mesurable. Il joue pour l'admin v2 le rôle que `00-runbook.md` jouait pour la v1.

Chaque phase précise : ses tâches, les fichiers à toucher, les schémas / migrations associés, les tests à écrire, la commande de validation, et la définition de fini (DoD). Aucune phase n'est marquée close sans cocher toutes ses cases.

## Vue d'ensemble — 4 vagues, 18 phases atomiques

```
Vague 1 — Quick wins  (5,5 j)              Vague 2 — Investissements moyens (12,5 j)
  P1.1  Endpoint neighbors prev/next         P2.1  Recherche full-text (ILIKE)
  P1.2  Hook useKeyboardShortcuts            P2.2  Mode batch view sweep
  P1.3  Filtres avancés URL-persisted        P2.3  Insights étendus (temporel + funnel + ML)
  P1.4  Optimistic UI mutations              P2.4  Détection doublons (pg_trgm)

Vague 3 — Capacités structurelles (16 j)   Vague Perf — Transverses (4,2 j)
  P3.1  Webhooks sortants admin               P4.1  Pagination cursor admin
  P3.2  Templates e-mails customizables       P4.2  Index Postgres composites
  P3.3  Notifications + digest + SLA          P4.3  Cache navigateur SWR
  P3.4  Audit log signé HMAC chaîné           P4.4  Prefetch on hover
                                              P4.5  SSE stream queue admin
                                              P4.6  Refresh agrégat asynchrone
```

**Charge totale** : ~ 37,7 j. **Calendrier cible** : 7 à 8 semaines temps-plein, ou 14 semaines mi-temps.

## Phase 0 — Prérequis et stratégie de branches

### Tâches

- [ ] Créer un worktree dédié : `git worktree add ../template-femiglow-admin-v2 -b feat/admin-v2`
- [ ] Symlinker `node_modules` depuis le worktree principal (pattern déjà éprouvé : `ln -s ../template-femiglow/apps/web/node_modules apps/web/node_modules`).
- [ ] Vérifier que `pnpm typecheck` et `pnpm test` passent sur la base actuelle.
- [ ] Créer `apps/web/src/lib/admin/feature-flags.ts` exportant `ADMIN_V2_FLAGS` (objet `{ keyboardShortcuts, urlFilters, optimisticUi, batchSweep, fullTextSearch, … }`). Toutes les phases derrière flag pour rollback facile.
- [ ] Ajouter les variables d'env aux templates : `ADMIN_V2_*` à `true` en dev / preview, sélectif en prod.

### Validation

```bash
pnpm install && pnpm typecheck && pnpm test
```

Tous verts → prérequis OK. Sinon corriger avant de démarrer.

---

## Vague 1 — Quick wins (5,5 j)

Objectif : doubler la vélocité de modération, sans changer le modèle de données.

### Phase 1.1 — Endpoint « voisins » pour navigation prev/next

**Charge : 1 j.**

#### Tâches

- [ ] Ajouter `getRitualNeighbors(id, status, filters)` dans `apps/web/src/lib/db/queries/rituals-admin.ts` : retourne `{ previousId, nextId, position, total }` avec `LEAD` / `LAG` Drizzle SQL.
- [ ] Endpoint `GET /api/admin/rituals/[id]/neighbors?status=PENDING&[filters]` retournant `{ previous, next, position, total }`.
- [ ] Composant `<RitualNeighborsBar />` dans `apps/web/src/components/admin/rituals/RitualNeighborsBar.tsx`, intégré à `app/admin/rituals/[id]/page.tsx`.
- [ ] Auto-skip : si action change le status, naviguer vers `next` du même status d'origine.
- [ ] Préserver les filtres URL via `next/navigation` `useSearchParams`.

#### Fichiers concernés

- `apps/web/src/lib/db/queries/rituals-admin.ts` (+ tests)
- `apps/web/src/app/api/admin/rituals/[id]/neighbors/route.ts` (nouveau)
- `apps/web/src/components/admin/rituals/RitualNeighborsBar.tsx` (nouveau)
- `apps/web/src/app/admin/rituals/[id]/page.tsx` (intégration)

#### Tests à écrire

- [ ] `rituals-admin.test.ts` : 3 rituels PENDING en BDD, `getRitualNeighbors(id_2)` retourne `{ previousId: id_1, nextId: id_3, position: 2, total: 3 }`.
- [ ] Edge cases : premier élément (`previousId: null`), dernier (`nextId: null`), seul (`previousId/next: null`, `total: 1`).
- [ ] Filtres : neighbors respecte `source` / `flags` / `dateRange` du contexte appelant.

#### DoD

- ✓ Sur `/admin/rituals/[id]`, barre `← précédent · 3 sur 12 PENDING · suivant →` visible et fonctionnelle.
- ✓ Filtres URL préservés en navigant.
- ✓ Action approve/reject auto-advance vers next.
- ✓ Tests verts.

---

### Phase 1.2 — Hook `useKeyboardShortcuts` + cheatsheet

**Charge : 1,5 j.**

#### Tâches

- [ ] Créer `apps/web/src/lib/admin/use-keyboard-shortcuts.ts` : hook React, écoute global `keydown`, registry de shortcuts conditionnels par `status` du rituel courant.
- [ ] Registry par défaut : `J/K` (nav), `A` (approve), `R` (reject avec note), `H` (hide), `F` (toggle featured), `?` (cheatsheet), `Esc` (close modal).
- [ ] Composant `<ShortcutsCheatsheet />` modale invocable via `?`, listant les raccourcis actifs.
- [ ] Toast `aria-live="polite"` pour confirmer chaque action clavier.
- [ ] Désactivation automatique si focus sur `<input>`, `<textarea>`, `[contenteditable]`.
- [ ] Tracking événement `admin.shortcut.used` (action + key) pour mesurer adoption.

#### Fichiers concernés

- `apps/web/src/lib/admin/use-keyboard-shortcuts.ts` (nouveau)
- `apps/web/src/components/admin/rituals/ShortcutsCheatsheet.tsx` (nouveau)
- `apps/web/src/components/admin/rituals/RitualActionsClient.tsx` (intégration)
- `apps/web/src/app/admin/rituals/[id]/page.tsx` (intégration)

#### Tests à écrire

- [ ] `use-keyboard-shortcuts.test.ts` (jsdom) : J avance, A déclenche approve, désactivé si textarea focus, `?` ouvre cheatsheet.
- [ ] Test conditionnel : sur status `APPROVED`, `A` est désactivé, `F` actif.
- [ ] E2E Playwright : `rituals-admin.spec.ts` ajouter test `keyboard J/K/A` sur queue → vue détail.

#### DoD

- ✓ Cheatsheet `?` listant tous les raccourcis actifs avec status courant.
- ✓ Tous les raccourcis fonctionnent et déclenchent leur action.
- ✓ Toast d'annonce visible (et `aria-live` pour SR).
- ✓ Tests Vitest + Playwright verts.

---

### Phase 1.3 — Filtres avancés URL-persisted sur les tables admin

**Charge : 2 j.**

#### Tâches

- [ ] Étendre `listAdminRituals(opts)` dans `rituals-admin.ts` : accepter `flags?: AutoFlag[]`, `source?: RitualSource[]`, `dateFrom?: Date`, `dateTo?: Date`, `authorQuery?: string`, `verified?: boolean | null`.
- [ ] Sérialisation/déserialisation URL via lib `apps/web/src/lib/admin/admin-filters.ts` (`parseAdminFilters(params)`, `serializeAdminFilters(filters)`).
- [ ] Composant `<RitualsAdminFilters />` : multi-select flags (chips), multi-select source, date range picker, input auteur, toggle vérifié.
- [ ] Intégrer à `/admin/rituals/{queue,published,archived}/page.tsx` au-dessus de la table.
- [ ] Indicateur visuel des filtres actifs avec bouton « Réinitialiser ».

#### Schéma / migration

- [ ] Migration `0024_ritual_admin_indexes.sql` ajoute index composites :
  ```sql
  CREATE INDEX IF NOT EXISTS idx_rt_status_source_created
    ON ritual_testimonials (status, source, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_rt_autoflags_gin
    ON ritual_testimonials USING gin (auto_flags);
  ```
  (Anticipe P4.2 — bénéfice immédiat.)

#### Fichiers concernés

- `apps/web/drizzle/migrations/0024_ritual_admin_indexes.sql` (nouveau)
- `apps/web/src/lib/db/queries/rituals-admin.ts` (étendre)
- `apps/web/src/lib/admin/admin-filters.ts` (nouveau)
- `apps/web/src/components/admin/rituals/RitualsAdminFilters.tsx` (nouveau)
- `apps/web/src/app/admin/rituals/{queue,published,archived}/page.tsx` (intégration)

#### Tests à écrire

- [ ] `admin-filters.test.ts` : roundtrip serialize/parse, gestion vide, listes multi-valeur, dates ISO.
- [ ] `rituals-admin.test.ts` : `listAdminRituals({ flags: ['face_detected'] })` filtre correctement, `source: ['import_csv']` aussi.
- [ ] E2E : pose un filtre, recharge page → filtre restauré depuis URL.

#### DoD

- ✓ URL `?flags=face_detected&source=email_j45&from=2026-04-01` filtre la queue.
- ✓ Bookmark de cette URL fonctionne après reload.
- ✓ Compteur de filtres actifs visible.
- ✓ Migration appliquée, queries < 100 ms à 5 000 rituels (mesurer).

---

### Phase 1.4 — Optimistic UI sur les mutations admin

**Charge : 1 j.**

#### Tâches

- [ ] Créer `apps/web/src/lib/admin/use-optimistic-mutation.ts` : helper `useOptimisticMutation({ mutate, optimisticUpdate, rollback, onError, onSuccess })`.
- [ ] Refactor `RitualActionsClient.tsx` pour utiliser le helper sur approve/reject/hide/restore/feature.
- [ ] Refactor `BulkActionBar.tsx` idem : ligne grisée immédiatement, restauration si erreur.
- [ ] Toast d'erreur explicite avec retry sur rollback.
- [ ] Empêcher double-submit pendant requête en vol.

#### Fichiers concernés

- `apps/web/src/lib/admin/use-optimistic-mutation.ts` (nouveau)
- `apps/web/src/components/admin/rituals/RitualActionsClient.tsx`
- `apps/web/src/components/admin/rituals/BulkActionBar.tsx`

#### Tests à écrire

- [ ] `use-optimistic-mutation.test.ts` : update appliqué immédiatement, rollback sur error, success non-rollback.
- [ ] E2E : approve → ligne grisée < 200 ms (mesurer via `expect.poll`).

#### DoD

- ✓ Mock latence 800 ms → UI réactive immédiate.
- ✓ Erreur simulée → rollback visible avec toast retry.
- ✓ Pas de double-submit possible.

---

### Validation de la Vague 1

```bash
pnpm --filter @femiglow/web typecheck
pnpm --filter @femiglow/web test
pnpm --filter @femiglow/web e2e --grep "Admin — Rituels"
```

**Critères de sortie de Vague 1**

- Délai médian de modération mesuré (instrument via `tracking_events_log` event `admin.moderation.completed`) sur cohorte de 20 actions : -40 % minimum vs baseline.
- Aucune régression sur les tests existants.
- Souheila peut valider en démo : « j'enchaîne 10 rituels au clavier sans toucher la souris ».

---

## Vague 2 — Investissements moyens (12,5 j)

Objectif : tenir à l'échelle 500+ rituels et piloter par données.

### Phase 2.1 — Recherche full-text body + auteur

**Charge : 1,5 j.**

#### Tâches

- [ ] Étendre `listAdminRituals({ search: string })` : `WHERE body ILIKE %q% OR body_original ILIKE %q% OR author_first_name ILIKE %q% OR author_city ILIKE %q%`.
- [ ] Composant `<RitualsAdminSearch />` : input avec debounce 300 ms, sérialisé `?q=`.
- [ ] Highlight des matches dans la colonne « Aperçu » via `<mark>`.
- [ ] Si volume > 5 000 rituels mesuré : migration `tsvector` GENERATED + GIN. Sinon laisser ILIKE.

#### Fichiers concernés

- `apps/web/src/lib/db/queries/rituals-admin.ts`
- `apps/web/src/components/admin/rituals/RitualsAdminSearch.tsx` (nouveau)
- `apps/web/src/components/admin/rituals/RitualsAdminTable.tsx` (highlight)

#### Tests à écrire

- [ ] `rituals-admin.test.ts` : `search: "miracle"` retourne rituels contenant le mot.
- [ ] Sanitization : caractères `%` / `_` SQL-injection-safe.
- [ ] E2E : taper `Amal` → table filtrée à 3 lignes, surligne `Amal`.

#### DoD

- ✓ Champ recherche fonctionnel sur les 3 tables admin.
- ✓ Highlight visible dans l'aperçu.
- ✓ Tests verts.

---

### Phase 2.2 — Mode batch view (sweep plein écran)

**Charge : 3 j.**

#### Tâches

- [ ] Nouvelle page `/admin/rituals/queue/sweep/page.tsx` (et variantes published/archived).
- [ ] Composant `<RitualSweepView />` : un rituel plein écran, animations Framer Motion fade+slide entre rituels.
- [ ] Compteur `3 sur 12`, boutons `Skip`, `Quitter` (retour à la liste avec filtres préservés).
- [ ] Intégrer les raccourcis clavier de P1.2 (A/R/H/S/←/→).
- [ ] Mode focus : masquer sidebar admin pendant sweep.
- [ ] CTA visible sur la queue : « Mode rafale (S) ».

#### Fichiers concernés

- `apps/web/src/app/admin/rituals/queue/sweep/page.tsx` (nouveau)
- `apps/web/src/components/admin/rituals/RitualSweepView.tsx` (nouveau)
- `apps/web/src/components/admin/rituals/RitualsAdminTable.tsx` (CTA)

#### Tests à écrire

- [ ] E2E : ouvrir sweep, traiter 3 rituels au clavier, auto-quit quand vide.
- [ ] Vitest : transitions, auto-advance après action, gestion fin de liste.

#### DoD

- ✓ Mode sweep fonctionnel.
- ✓ Performance fluide (60 fps animations).
- ✓ Sortie propre (retour à la queue avec filtres intacts).

---

### Phase 2.3 — Insights étendus

**Charge : 4 j.**

#### Tâches

- [ ] Endpoint `GET /api/admin/rituals/insights/extended` agrégeant :
  - Soumissions/publications/rejets par jour sur 90 j.
  - Funnel `kit.viewed → module.opened → drawer.opened → wizard.opened → submitted → published` (depuis `tracking_events_log`).
  - Heatmap horaire des soumissions.
  - Top auteurs (initiées avec ≥ 2 rituels).
  - Monitoring vision ML : taux `REJECTED_FACE`, taux d'override, latence p50/p95.
  - Volume imports par mois + taux d'approbation par batch.
- [ ] Refonte `/admin/rituals/insights/page.tsx` : 5 sections, ajouter composants charts (recharts ou SVG natif).
- [ ] Comparaison période/période avec delta `+12 %`.

#### Fichiers concernés

- `apps/web/src/lib/db/queries/rituals-insights.ts` (nouveau)
- `apps/web/src/app/api/admin/rituals/insights/extended/route.ts` (nouveau)
- `apps/web/src/app/admin/rituals/insights/page.tsx` (refonte)
- `apps/web/src/components/admin/rituals/insights/*` (nouveaux : `<TimeSeriesChart />`, `<FunnelChart />`, `<Heatmap />`, `<MlMonitor />`)

#### Tests à écrire

- [ ] `rituals-insights.test.ts` : agrégats temporels, funnel basé sur fixtures `tracking_events_log`.
- [ ] E2E : page insights affiche les 7 sections sans erreur, KPI > 0 sur fixtures.

#### DoD

- ✓ Tous les graphs rendus avec données réelles.
- ✓ Monitoring vision ML visible (taux d'override surfaçé en rouge si > 30 %).
- ✓ Comparaison période/période affichée.

---

### Phase 2.4 — Détection de doublons (pg_trgm)

**Charge : 4 j.**

#### Tâches

- [ ] Migration `0025_ritual_duplicates.sql` :
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_rt_body_trgm
    ON ritual_testimonials USING gin (body gin_trgm_ops);
  ```
- [ ] Module `apps/web/src/lib/rituals/duplicate-detection.ts` :
  - `findSimilar(body: string, threshold = 0.6)` : utilise `similarity()` Postgres.
  - `tagDuplicateStrict(testimonialId)` : ajoute auto-flag `duplicate_strict` (hash SHA256 sur body normalisé).
  - `tagDuplicateLoose(testimonialId)` : ajoute `duplicate_loose` si similarity > 0,8.
- [ ] À la soumission ET à la modération : appel asynchrone du détecteur.
- [ ] UI vue détail : section « Similarités » avec lien vers original, boutons « Marquer doublon » / « Ignorer ».

#### Fichiers concernés

- `apps/web/drizzle/migrations/0025_ritual_duplicates.sql` (nouveau)
- `apps/web/src/lib/rituals/duplicate-detection.ts` (nouveau)
- `apps/web/src/lib/rituals/submit-service.ts` (intégration)
- `apps/web/src/components/admin/rituals/RitualSimilarities.tsx` (nouveau)

#### Tests à écrire

- [ ] `duplicate-detection.test.ts` : seed 2 rituels quasi-identiques, `findSimilar` retourne score > 0,8.
- [ ] Faux positifs : 2 rituels distincts longs (200 mots) ne déclenchent pas `duplicate_loose`.
- [ ] E2E : vue détail affiche similarité avec lien.

#### DoD

- ✓ Migration appliquée, extension `pg_trgm` chargée.
- ✓ Détection automatique à la soumission.
- ✓ UI surfaçage fonctionnelle.

---

### Validation de la Vague 2

```bash
pnpm --filter @femiglow/web typecheck
pnpm --filter @femiglow/web test
pnpm --filter @femiglow/web e2e
```

**Critères de sortie**

- 500 rituels en BDD test : page queue < 500 ms TTFB.
- Page insights chargée en < 1 s.
- Détection doublons stricte : 0 faux négatif sur 50 fixtures (2 paires de copies parfaites + 48 distincts).

---

## Vague 3 — Capacités structurelles (16 j)

Objectif : industrialisation (intégrations, conformité, notifications).

### Phase 3.1 — Webhooks sortants

**Charge : 3 j.**

#### Tâches

- [ ] Réutiliser tables existantes `webhook_endpoints` et `webhook_deliveries` (préalable : vérifier qu'elles existent ; sinon créer migration).
- [ ] Service `apps/web/src/lib/rituals/webhook-dispatcher.ts` : `dispatch(event: RitualWebhookEvent, payload)`, signature HMAC SHA-256 dans header `X-FemiGlow-Signature`, persistance `webhook_deliveries`, retry exponentiel (1 min, 5 min, 30 min, 6 h).
- [ ] Hooks dans `approveRitual`, `rejectRitual`, `setFeatured`, `commit import batch`.
- [ ] Page `/admin/settings/webhooks/page.tsx` : CRUD endpoints, test send, vue deliveries.

#### Fichiers concernés

- `apps/web/drizzle/migrations/0026_webhook_deliveries_admin.sql` (si tables absentes)
- `apps/web/src/lib/rituals/webhook-dispatcher.ts` (nouveau)
- `apps/web/src/lib/db/queries/rituals-admin.ts` (hooks)
- `apps/web/src/app/admin/settings/webhooks/page.tsx` (nouveau)
- `apps/web/src/app/api/admin/webhooks/{[id],test,deliveries}/route.ts` (nouveaux)

#### Tests à écrire

- [ ] `webhook-dispatcher.test.ts` : signature, retry, payload format.
- [ ] E2E : créer endpoint → approve rituel → delivery enregistrée.

#### DoD

- ✓ Webhook envoyé pour chaque event admin clé.
- ✓ Signature HMAC vérifiable côté récepteur.
- ✓ Retry visible dans UI deliveries.

---

### Phase 3.2 — Templates e-mails personnalisables

**Charge : 3 j.**

#### Tâches

- [ ] Migration `0027_ritual_email_templates.sql` (ou utiliser `app_config` existant) pour stocker `subject`, `body_md`, `version`, `updated_at`, `updated_by`.
- [ ] Page `/admin/rituals/email-templates/page.tsx` : éditeur split-pane (CodeMirror Markdown + preview server-rendered).
- [ ] API `GET/PUT /api/admin/rituals/email-templates/[key]` (j45, approved, rejected-face, rejected-other, photo-rejected).
- [ ] `POST /api/admin/rituals/email-templates/[key]/test-send` : envoie à une adresse de test avec variables d'exemple.
- [ ] Versioning via `app_config_snapshots` (already exists), UI liste versions + restauration.
- [ ] Adapter `renderEmailTemplate()` pour lire BDD au lieu de constantes fichier (fallback constantes si absent).

#### Fichiers concernés

- `apps/web/drizzle/migrations/0027_ritual_email_templates.sql` (nouveau, si nécessaire)
- `apps/web/src/lib/rituals/email-templates.ts` (refactor : lecture BDD)
- `apps/web/src/app/admin/rituals/email-templates/page.tsx` (nouveau)
- `apps/web/src/app/api/admin/rituals/email-templates/[key]/{route,test-send/route}.ts` (nouveaux)

#### Tests à écrire

- [ ] `email-templates.test.ts` : lecture BDD, fallback constantes si BDD vide, variables substituées.
- [ ] E2E : éditer template, preview live, test-send → 200.

#### DoD

- ✓ 5 templates éditables, previewables, testables, versionables.
- ✓ Restauration d'une version précédente fonctionne.

---

### Phase 3.3 — Notifications + digest + SLA

**Charge : 5 j.**

#### Tâches

- [ ] **Web Push** :
  - Génération clés VAPID (script `apps/web/scripts/generate-vapid.ts`).
  - Migration `0028_admin_push_subscriptions.sql` (table `admin_push_subscriptions`).
  - Endpoint `POST /api/admin/notifications/subscribe`.
  - Service worker `apps/web/public/sw-admin.js` (registration côté admin).
  - Hook `useAdminPushSubscription()`.
  - Trigger push à la création de rituel `PENDING`.
- [ ] **Digest e-mail quotidien** :
  - CRON `/api/cron/admin-digest` (déclenché 9 h locale).
  - Template `admin-digest` avec compteurs PENDING + priorisés.
- [ ] **Alerte SLA** :
  - CRON `/api/cron/admin-sla-check` (toutes les heures).
  - Si rituel PENDING > 36 h : email Souheila. Si > 48 h : email + push.
- [ ] **Alerte anomalie** :
  - Compte glissant 1 h dans `tracking_events_log` ; si > 10 submits, alerte.
- [ ] **Page préférences** `/admin/settings/notifications/page.tsx` : toggles par canal.

#### Fichiers concernés

- `apps/web/drizzle/migrations/0028_admin_push_subscriptions.sql` (nouveau)
- `apps/web/src/lib/admin/notifications/{push,digest,sla}.ts` (nouveaux)
- `apps/web/src/app/api/cron/admin-{digest,sla-check}/route.ts` (nouveaux)
- `apps/web/src/app/admin/settings/notifications/page.tsx` (nouveau)
- `apps/web/scripts/generate-vapid.ts` (nouveau)

#### Tests à écrire

- [ ] `sla-check.test.ts` : fixtures 50/40/30 h → seules les > 36 alertent.
- [ ] `digest.test.ts` : compose correctement le compteur + lien.
- [ ] E2E : subscribe push, simulate event, check delivery.

#### DoD

- ✓ Push reçu en temps réel (test local avec ngrok ou Vercel preview).
- ✓ Digest envoyé à 9 h en preview.
- ✓ Alerte SLA fonctionnelle.

---

### Phase 3.4 — Audit log signé cryptographiquement

**Charge : 5 j.**

#### Tâches

- [ ] Migration `0029_ritual_audit_signature.sql` :
  ```sql
  ALTER TABLE ritual_audit_log
    ADD COLUMN previous_hash text,
    ADD COLUMN signature text;
  CREATE INDEX idx_ral_hash_chain ON ritual_audit_log (id, previous_hash);
  ```
- [ ] Service `apps/web/src/lib/rituals/audit-signing.ts` :
  - `signEntry(entry, previousHash)` retourne `signature = HMAC_SHA256(secret, previousHash || canonical(entry))`.
  - `verifyChain(entries[])` retourne `{ valid, brokenAt? }`.
- [ ] Hook dans `insertAuditEvent()` : récupérer dernière entry, signer la nouvelle.
- [ ] CLI `apps/web/scripts/verify-audit-chain.ts` : `pnpm verify-audit` retourne 0 si OK, 1 si brisée.
- [ ] UI `/admin/rituals/audit-integrity/page.tsx` : bouton « Vérifier la chaîne », résultat affiché.
- [ ] Secret `RITUAL_AUDIT_SECRET` ajouté à `.env.local.template`.

#### Fichiers concernés

- `apps/web/drizzle/migrations/0029_ritual_audit_signature.sql` (nouveau)
- `apps/web/src/lib/rituals/audit-signing.ts` (nouveau)
- `apps/web/src/lib/db/queries/rituals.ts` (intégration `insertAuditEvent`)
- `apps/web/scripts/verify-audit-chain.ts` (nouveau)
- `apps/web/src/app/admin/rituals/audit-integrity/page.tsx` (nouveau)

#### Tests à écrire

- [ ] `audit-signing.test.ts` : signature reproductible, vérif chaîne valide, détection tampering (modifier 1 entry → broken).
- [ ] Migration backfill : recalcule signatures pour entries existantes (script idempotent).

#### DoD

- ✓ Toutes nouvelles entries signées.
- ✓ `pnpm verify-audit` retourne 0.
- ✓ Modification manuelle BDD → vérif échoue sur l'entry modifiée.

---

### Validation de la Vague 3

```bash
pnpm --filter @femiglow/web typecheck
pnpm --filter @femiglow/web test
pnpm --filter @femiglow/web e2e
pnpm --filter @femiglow/web verify-audit
```

**Critères de sortie**

- Webhook + signature vérifié par un consumer Node externe.
- Templates e-mails éditables + testables en preview.
- Digest reçu à l'horaire configuré.
- Chaîne d'audit complète, vérifiable.

---

## Vague Perf — Optimisations transverses (4,2 j)

Peuvent être interleavées dès la Vague 1 (P4.2 est déjà incluse en P1.3). Le reste s'enchaîne après les Vagues 1 et 2.

### Phase 4.1 — Pagination cursor admin

**Charge : 0,5 j.** À déclencher quand volume > 500 rituels.

- [ ] Adapter `listAdminRituals(opts)` : remplacer `offset/limit` par `cursor (createdAt, id)` (pattern déjà éprouvé dans queries publiques).
- [ ] Liens « page suivante » utilisent `?cursor=...`.
- [ ] Tests : pagination stable même si rituels ajoutés entre 2 requêtes.

### Phase 4.2 — Index Postgres composites

Déjà couvert par P1.3 (migration `0024_ritual_admin_indexes.sql`). Ajouter en complément :
- [ ] `CREATE INDEX idx_ral_actor_created ON ritual_audit_log (actor_id, created_at DESC);`

### Phase 4.3 — Cache navigateur SWR

**Charge : 1 j.**

- [ ] Installer `swr` (déjà ?) — vérifier.
- [ ] Wrapper `useAdminQuery(key, fetcher)` avec `staleTime: 30s`, `revalidateOnFocus: true`.
- [ ] Invalidation explicite après chaque mutation admin (post-approve, etc.).

### Phase 4.4 — Prefetch on hover

**Charge : 0,2 j.**

- [ ] Sur `<Link>` des boutons « Voir détail » dans tables admin, ajouter `prefetch={true}` (default Next.js) + handler `onMouseEnter` qui fait fetch `/api/admin/rituals/[id]` pour warm cache.

### Phase 4.5 — SSE stream queue admin

**Charge : 2 j.**

- [ ] Endpoint `GET /api/admin/rituals/queue/stream` (Server-Sent Events).
- [ ] Hook `useQueueStream(status)` côté admin queue : ajoute lignes en haut, animation entrée Framer Motion.
- [ ] Heartbeat 30 s pour maintenir connexion.
- [ ] Désactivable via feature flag (overhead serveur).

### Phase 4.6 — Refresh agrégat asynchrone

**Charge : 0,3 j.**

- [ ] Retirer `refreshRitualAggregate()` du chemin chaud `/admin/rituals/insights/page.tsx`.
- [ ] Vérifier que le CRON 5 min `/api/cron/rituals-refresh-aggregate` tourne en preview/prod.
- [ ] Afficher « Dernière mise à jour il y a X min » + bouton « Rafraîchir maintenant » manuel.

---

## Tests & validation globale

### Suite de tests cible après chaque vague

- **Vitest** : couverture > 80 % sur les nouveaux modules.
- **Playwright** : E2E admin enrichi avec un test par phase clé (raccourcis, sweep, filtres URL, webhook delivery, audit verify).
- **TypeCheck** : 0 erreur.
- **Perf** : page queue < 500 ms TTFB à 5 000 rituels (mesure via `lighthouse-ci` sur preview).

### Métriques opérationnelles à instrumenter

| Métrique | Source | Cible |
| --- | --- | --- |
| Délai médian par modération | `tracking_events_log` event `admin.moderation.completed` | -50 % vs baseline post-Vague 1 |
| % actions via clavier | `admin.shortcut.used` | > 60 % post-Vague 1 |
| Délai première lecture rituel PENDING | `tracking_events_log` | < 2 h post-Vague 3 |
| Taux d'override vision ML | calcul depuis audit log | surface si > 30 % |
| Doublons publiés | `auto_flags @> '{duplicate_strict}'` | 0 post-Vague 2 |
| Latence p95 page queue | observability tier | < 800 ms à 1 000 rituels |

---

## Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
| --- | --- | --- | --- |
| Conflit avec admin existant lors du merge | M | M | Worktree dédié + feature flags par phase pour rollback ciblé |
| Migration `pg_trgm` indisponible en preview | F | H | Vérifier préalablement `pg_available_extensions` ; sinon fallback ILIKE-only sans similarité |
| Web Push bloqué par navigateurs (Safari) | M | M | Push browser-only feature, digest e-mail = fallback universel |
| Audit log signing casse l'écriture en cas de bug | F | H | Mode dual-write 1 semaine : signature en sus, fallback ignoré côté lecture |
| Surcharge serveur SSE | M | M | Connexion par tab limitée, désactivable via flag |
| Mauvaise calibration filtres pg_trgm | M | M | Threshold configurable par admin, A/B testable |

---

## Ordre de déploiement recommandé

### Sprint 1 (1 semaine, 5,5 j) — Vague 1 complète

`Phase 0 → P1.1 → P1.2 → P1.3 → P1.4` → merge → mesurer KPI 1 semaine.

### Sprint 2 (2 semaines, 12,5 j) — Vague 2

`P2.1 → P2.2 → P2.3 → P2.4` → merge → mesurer.

### Sprint 3 (3 semaines, 16 j) — Vague 3

`P3.1 → P3.2 → P3.3 → P3.4` (parallélisables 3.1 / 3.2 entre 2 devs).

### Sprint perf (interleavé) — Vague 4

P4.2 dans le sprint 1 (déjà inclus). P4.1, P4.3, P4.4, P4.6 dans sprint 2. P4.5 dans sprint 3 si signal pic.

---

## Définition de fini globale

- [ ] Les 18 phases ont leur DoD coché.
- [ ] `pnpm typecheck` + `pnpm test` + `pnpm e2e` verts sur la branche.
- [ ] Métriques opérationnelles montrent les gains cibles sur 2 semaines de mesure.
- [ ] Souheila a validé la prise en main des 3 nouveaux outils clés : raccourcis, sweep, filtres URL.
- [ ] Documentation `docs/reviews-wall/execution/18-ameliorations-admin-controle.md` mise à jour avec les retours d'expérience.
- [ ] PR de release notes regroupant les 12 améliorations + 6 perf, publiée.

---

## Annexes — Pointeurs vers le code existant

| Concept | Fichier de référence |
| --- | --- |
| Pattern dual-driver Drizzle / memory store | `apps/web/src/lib/db/client.ts` |
| Pattern audit double bulk | `apps/web/src/lib/db/queries/rituals-admin.ts` (`applyBulkAction`) |
| Pattern API admin | `apps/web/src/app/api/admin/rituals/[id]/route.ts` |
| Pattern test memory store | `apps/web/src/lib/db/queries/rituals-admin.test.ts` |
| Pattern Framer Motion | `apps/web/src/components/sections/rituals/RitualsWallDrawer.tsx` |
| Pattern feature flag | `apps/web/src/lib/feature-flags.ts` (si existe ; sinon créer) |
| Pattern HMAC signing | `apps/web/src/lib/rituals/email-tokens.ts` (déjà utilise HMAC SHA-256) |

Tous les ajouts respectent : voix maison (Cormorant, pas d'icônes Material), dual-driver Drizzle/memory, audit immutable, tests Vitest + Playwright, feature flag pour rollback.
