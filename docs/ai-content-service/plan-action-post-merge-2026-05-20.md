# Plan d'action — Suite Content Studio post-merge

Date : 2026-05-20
Branche : `master` (après merge `f834fbb` + fixes `78501ff`)
État de départ : `cfc53f0` (auto-bind visuel + gate primary_asset) intégré.
Plans parents : `plan-action-suite-publication-directe-2026-05-20.md`

## Contexte

Le merge d'`origin/master` (185 commits remote) a stabilisé la base avec le reste de l'organisation (pack `/kit`, tracking CAPI/Pixel, m5 phases). Les 8 migrations DB sont appliquées, build clean, 250/250 tests verts sur les zones impactées.

Le présent plan développe les **6 recommandations** identifiées dans l'état du module Content Studio :

1. Validation E2E UI du nouveau flux auto-bind
2. Chiffrement des credentials providers (avant per-account auth)
3. Push origin master
4. Consolidation pipelines (legacy `content_postiz_delivery` vs nouveau `social_publish_job`)
5. Observabilité (snapshots performance, alerting échecs)
6. Long terme (CDN media, learning loop, brand-rules amélioration)

## Principes de séquençage

- **Reversibles d'abord** : push + validations UI avant chiffrement DB.
- **Risque résolu, pas urgence inventée** : la table `social_credential` existe mais n'est utilisée par aucun adapter aujourd'hui. Postiz s'authentifie via `env.POSTIZ_API_KEY` (un secret partagé). Le chiffrement DB devient bloquant **quand** on ajoutera per-account OAuth (Meta Graph, ou Postiz refresh tokens). Pas urgence S1, mais à faire avant S2.2 (Meta Graph) si on l'active.
- **Une seule pipeline** : `social_publish_job` est la cible. Le legacy `content_postiz_delivery` reste pour compat mais doit être dépréciable sans souci.
- **Observabilité avant scale** : on ne scale pas ce qu'on ne mesure pas.

---

## SPRINT 1 — Validation & propagation (1 jour)

### S1.1 — Validation E2E UI manuelle ⏱️ 1h

**Objectif** : prouver que l'auto-bind + le gate fonctionnent en conditions réelles UI (l'erreur initiale est venue d'un cas réel — la validation UI doit fermer la boucle).

#### Préconditions

- Service `femiglow-staging.service` actif sur port 8012.
- Accès admin : `admin@femiglow.local` / mot de passe staging.
- `CONTENT_STUDIO_ENABLED=true` dans `.env`.

#### Scénario à exécuter

1. Login `https://staging.femiglow-maroc.com/admin/login`.
2. Aller `/admin/content-studio`.
3. **Cas nominal — auto-bind** :
   - Créer une idée (pillar rituel, IG post).
   - Générer les drafts.
   - Sur le draft sélectionné, prompt visuel + « Générer le visuel ».
   - **Sans cliquer « Sauvegarder + relire »**, cliquer directement « Approuver ».
   - **Résultat attendu** : approbation OK, redirection vers le post.
4. **Cas gate — refus sans visuel** :
   - Créer une idée, générer drafts, NE PAS générer de visuel.
   - Cliquer « Approuver ».
   - **Résultat attendu** : message « Un visuel doit être associé avant approbation. Générez un visuel ou choisissez un media, puis cliquez « Sauvegarder + relire ». »
5. **Cas publication dry_run** :
   - Sur le post du cas 3, sélectionner compte « Instagram dry-run », « Publier maintenant ».
   - **Résultat attendu** : `social_publish_job.status='published'`, événement enregistré, pas d'effet externe.
6. **Cas messages d'erreur affinés** : forcer chaque variante (binding absent, media supprimé, pas prêt, sans URL) en supprimant le media en DB entre génération et publication.

#### Done si

- Les 4 cas passent, chaque message d'erreur affiche le bon texte contextualisé.
- Aucun friction sur le flow nominal (auto-bind = 0 clic intermédiaire).

#### Si échec

- Si le binding n'apparaît pas : vérifier `content_asset_binding` en DB pour le draft. Si vide, `generateVisualForDraft` n'a pas atteint la nouvelle ligne `upsertPrimaryAsset` — investiguer pourquoi (worker error ? exception silencieuse ?).
- Si approbation accepte sans visuel : vérifier que le binary déployé est bien post-`cfc53f0` (regarder `.next/build-manifest.json` mtime).

### S1.2 — Push origin master ⏱️ 5 min

#### Préconditions

- `git status` propre.
- Tests verts (déjà validé).
- Build OK (déjà validé).

#### Exécution

```bash
cd /var/www/femiglow-staging
git push origin master
```

Commits qui partent : `cfc53f0`, `f834fbb` (merge), `78501ff` (fix kit).

#### Done si

- `git status` indique `Your branch is up to date with 'origin/master'.`
- CI remote (si configurée) green.

### S1.3 — Snapshot mémoire — décision Phase 2

Décider, après S1.1, si on enchaîne sur **S2 (consolidation pipelines)** ou si on intercale **S3.2 (alerting)** comme dette critique observée pendant la validation.

---

## SPRINT 2 — Consolidation pipelines (3-4 jours)

Objectif : `social_publish_job` devient la seule façon de publier vers Postiz/Meta. Le legacy `content_postiz_delivery` est dépréciable proprement.

### S2.1 — Postiz adapter complet ⏱️ 1.5 jour — **[done] 2026-05-21 (commit 3ec0ec9)**

**Risque résolu** : adapter Postiz incomplet (Phase B était scaffold). Sans cette complétion, on ne peut pas dévier le trafic du legacy.

**Réalisation** :
- `PostizPostInput.type` (`draft|now|schedule`) configurable.
- Adapter choisit `now` sans `scheduledAt`, `schedule` si futur.
- `scheduledAt` passée ou invalide → `invalid_request` upfront.
- HTTP 409 → `duplicate_external_post` (non retryable) dans `errorFromHttpStatus`.
- 9 tests adapter ajoutés (mode now/schedule + 409 + past/NaN) + 2 tests payload-builder. 46/46 verts sur les fichiers touchés ; 237/237 sur la zone Studio.

#### Spec

Fichier : `apps/web/src/lib/social-publishing/adapters/postiz.ts`

Compléter :
- `publishNow(request)` : `POST /posts/draft` puis `POST /posts/{id}/publish` (mapping selon API Postiz observée), gestion de l'attachment via `request.content.media[0].url`.
- `schedule(request, when)` : `POST /posts/draft` avec `scheduledFor`.
- `uploadMedia(request)` : déjà implémenté via `uploadPostizMediaFromUrl` côté legacy — extraire en helper réutilisable `lib/content-studio/postiz.ts`.
- Mapping erreurs : compléter les codes pour `409` (conflit idempotency), `422` (validation), `503` (provider unavailable).

#### Tests MSW

Fichier : `apps/web/src/lib/social-publishing/adapters/postiz.test.ts`

Ajouter :
- Succès `publishNow` → renvoie `result.providerPostId`.
- 401 `token_expired` → `result.ok=false`, code `token_expired`, retryable=false.
- 429 `provider_rate_limited` → retryable=true.
- 503 `provider_unavailable` → retryable=true.
- 422 `invalid_request` (image trop grande) → retryable=false, message contextuel.
- `schedule` avec date passée → `invalid_request`.

#### Done si

- Couverture comportementale ≥ legacy `createDraftInPostiz` (vérifier en miroir).
- Tests adapter passent 100%.
- Aucune dépendance restante sur `createDraftInPostiz` depuis `social-publishing`.

### S2.2 — Meta Graph adapter (DÉCISION REQUISE) ⏱️ 2-3 jours OU SKIP

**Question à trancher en S2.0** : as-tu besoin d'un chemin direct vers Meta sans Postiz ?

| Pour | Contre |
|---|---|
| Pas de dépendance Postiz down | Maintenance second adapter |
| Latence inférieure | OAuth Meta Business à gérer |
| Quotas dédiés | Token rotation à automatiser |

**Recommandation par défaut** : SKIP en S2. Postiz couvre IG+FB. Y revenir si :
- Postiz devient une dette stratégique
- Volume publication > 100/j (rate limit Postiz à valider)
- Besoin de features Meta non exposées par Postiz (Reels, Stories avec stickers, etc.)

Si on l'active : prérequis S2.2.0 = **S1.2bis chiffrement credentials** (per-account access tokens en DB).

### S2.3 — Dépréciation du pipeline legacy ⏱️ 1.5 jour

**Risque résolu** : un draft peut être publié 2 fois (legacy + new). Source de doublons silencieux.

#### Phase a — Feature flag UI (0.3j) — **[done] 2026-05-21 (commit 3ec0ec9)**

- Ajouter `CONTENT_STUDIO_LEGACY_POSTIZ_DISABLED` à `env.ts` (default `false` en staging).
- Dans `DraftEditor.tsx` et views post : si `true`, cacher bouton « Envoyer à Postiz » (legacy) ; afficher uniquement « Publier maintenant » (nouveau pipeline).
- Tester en staging avec flag `true`.

**Réalisation** : flag câblé `env.ts` → `page.tsx` → `ContentStudioClient` → `DraftEditor` ; `DeliveryPanel` masqué quand `true`. `SocialPublishingPanel` reste visible. Pour activer en staging : `echo 'CONTENT_STUDIO_LEGACY_POSTIZ_DISABLED=true' >> apps/web/.env && systemctl restart femiglow-staging.service`.

#### Phase b — Re-route interne (0.5j) — **[deferred] 2026-05-21**

- `createDraftInPostiz` (service.ts) devient un thin wrapper qui appelle `publishContentPostNow` du nouveau pipeline.
- Garde la signature pour compat (API publique inchangée).
- Tests : équivalence sortie legacy vs new sur 3 scénarios standard.

**Décision** : reporté. Conflit de modèle de données entre legacy (`integrationId`+`content_postiz_delivery`) et nouveau (`accountId`+`social_publish_job`) — un thin wrapper aboutit soit à un dual-write (anti-objectif de S2.3), soit à une migration `integrationId→accountId` plus large que 0.5j. Comme legacy et nouveau partagent déjà les helpers HTTP Postiz (`uploadPostizMediaFromUrl`, `createPostizDraft`, `buildPostizDraftPayload`), il n'y a pas de code-path parallèle à fusionner. La consolidation se fera **en phase d** par suppression directe une fois la télémétrie phase c à zéro.

#### Phase c — Deprecation marker (0.2j) — **[done] 2026-05-21**

- Headers HTTP `Deprecation: true` + `Sunset: 2026-08-01` sur les routes legacy.
- Doc README/changelog.
- Audit log spécifique `social.legacy_route_used` pour mesurer trafic résiduel.

**Réalisation** : `POST /api/admin/content-studio/posts/[id]/postiz-draft` émet désormais (succès comme erreur) :
- `Deprecation: true`
- `Sunset: Wed, 01 Aug 2026 00:00:00 GMT`
- `Link: </api/admin/content-studio/posts/[id]/publish-now>; rel="successor-version"`

Et un audit event `social.legacy_route_used` par appel (action, actorId, resourceType=content_post, resourceId=postId, meta.route='postiz-draft'). 3 tests vitest verts (headers succès, headers erreur, audit event).

#### Phase d — Suppression (0.5j) — différée 2 semaines

- Si telemetry `social.legacy_route_used` à 0 pendant 7j consécutifs → suppression code.
- Migration `0064_drop_content_postiz_delivery_or_archive` selon décision (archive ou DROP).

#### Phase e — Mode draft natif dans le nouveau pipeline ⏱️ 1.5 jour — **[done] 2026-05-22**

Plan complet : `docs/ai-content-service/plan-s2.3-phase-e-draft-mode.md`.

**Livré (commits e6c6c9d → 3337076 + plan-s2.3-phase-e-draft-mode.md)** :
- Contrat `SocialPublishMode = 'now' | 'schedule' | 'draft'` + `publishMode?` sur `SocialPublishContent` + `supportsDraft: boolean` sur `SocialPublishingCapability`. Backward-compat conservée via inférence sur `scheduledAt`.
- Adapters Postiz & DryRun honorent `publishMode` : Postiz envoie `type='draft'` au client API, DryRun marque `metadata.simulatedDraft: true` + permalink `/draft/`.
- Service `sendContentPostToDraft` dans `admin-service.ts` ; clé d'idempotence `${postId}:${accountId}:draft` (séparée de `now`/`schedule`). `executeJob` ne flippe plus `content_post.status` quand `publishMode==='draft'`.
- Route `POST /api/admin/content-studio/posts/[id]/draft-on-provider` (provider-agnostique).
- UI `SocialPublishingPanel` : radio group "Mode d'envoi" (now/schedule/draft), bouton primaire conditionnel, note amber informative en mode draft, a11y aria-label.
- Dashboard : `computeJobSuccessRate` exclut les drafts, nouveau widget "Brouillons Postiz en attente" (count + oldestAgeHours).
- Audit `social.draft_created` émis en succès, `sendSocialAlert` skippé en échec draft, `social.publish.failed` log inclut `publish_mode`.
- Tests : +6 adapters, +1 admin-service (via route), +5 route (happy, idempotence, cross-mode, 401, 404, audit), +3 UI (radio interaction, note informative, draft submit), +3 dashboard (success-rate exclude, drafts-count, ignore non-terminal), +2 MSW integration (wire format `type=draft`, 422 → invalid_request), +1 E2E Playwright (TS compile OK, run bloqué par flake pre-existant de global.setup.ts admin login).
- Build vert ; service `active` ; smoke live : `POST /draft-on-provider` → 401, `/admin/content-studio/dashboard` → 307.

**Effet sur phase d** : la suppression du legacy ne fait plus perdre de capacité produit (le mode "envoyer comme brouillon" est désormais dans le nouveau pipeline). Phase d débloquée dès T+7j de télémétrie `social.legacy_route_used = 0`.

#### Done si

- Feature flag toggle stable.
- Telemetry route legacy à 0 sur 7j en staging.
- Code legacy supprimé (Phase d).

---

## SPRINT 3 — Observabilité & opérations (2-3 jours)

### S3.1 — Ingestion performance snapshots ⏱️ 1 jour — **[done] 2026-05-22**

**Livré** :
- Contrat `SocialPublishingAdapter` étendu avec `getInsights({account, providerPostId})` + types `SocialPostInsights` / `SocialInsightsResult`.
- `DryRunSocialPublishingAdapter.getInsights` retourne des métriques synthétiques **déterministes** (SHA-256 du `providerPostId`).
- `PostizSocialPublishingAdapter.getInsights` wrap `getPostizPostAnalytics`, parser défensif (`parsePostizAnalytics`) qui tolère array/objet, plusieurs alias (`impressions/views`, `reach/unique impressions`, `shares/retweets/reposts`, etc.) et reconstruit `engagementRate` localement.
- Worker `apps/web/src/lib/content-studio/insights-worker.ts` : fenêtre glissante `[now-72h, now-24h]`, idempotence via clé `${provider}:${remoteId}:${UTCday}` sur `content_performance_snapshot.source`.
- Route cron `GET /api/cron/content-studio/insights-ingestion` (Bearer `CRON_SECRET`, tick recommandé toutes les 6h).
- Dashboard : widget "Top performers" branché sur `computeTopPerformers(snapshots, {limit:5})`, tri engagement décroissant, dédoublonnage par postId (snapshot le plus récent gagne).
- Tests : 5 nouveaux dans `insights-worker.test.ts` (idempotence back-to-back, fenêtre, failure non bloquante, adapter sans `getInsights`), 3 dans `dashboard.test.ts` (top performers tri/dédoublonnage/skip), 3 dans `adapters/postiz.test.ts` (parse array & object wrappé, propagation 404). Total 258/258 vitest.
- Smoke live : `GET /api/cron/content-studio/insights-ingestion` → 200 `{scanned:0,ingested:0}` (aucun job publié dans la fenêtre sur staging), 401 sans Bearer.

**Objectif** : remplir `content_performance_snapshot` automatiquement depuis Postiz/Meta après publication.

#### Spec

- Nouveau worker `apps/web/src/lib/content-studio/insights-worker.ts` :
  - Récupère les posts dont `publishedAt` est entre H-72h et H-24h sans snapshot récent.
  - Pour chaque, appelle l'adapter `getInsights({providerPostId})` (à ajouter au contract `SocialPublishingAdapter`).
  - Persiste dans `content_performance_snapshot` : impressions, likes, reach, saves, comments, shares.
- Nouvelle route cron `apps/web/src/app/api/cron/content-studio/insights-ingestion/route.ts` :
  - Bearer `CRON_SECRET`.
  - Appelle le worker, retourne `{ processed, errors }`.
  - Tick recommandé : toutes les 6h (`0 */6 * * *` côté cron externe).

#### Adapter contracts

Ajouter au type `SocialPublishingAdapter` :
```ts
getInsights?(input: { providerPostId: string; account: SocialAccount }): Promise<SocialPostInsights>;
```

Implementation :
- `dry_run` : retourne données synthétiques stables (pour tests).
- `postiz` : `GET /posts/{id}/insights` (vérifier endpoint exact Postiz).
- `meta_graph` : skip (si non implémenté).

#### Tests

- Worker : MSW pour Postiz, 1 post snapshot OK + 1 post avec erreur réseau (retry).
- Route cron : auth Bearer, dispatch worker, gestion d'erreur.
- Idempotence : 2 runs back-to-back ne dédoublent pas les snapshots (clé `postId + capturedAt < 1h`).

#### Done si

- Un post publié hier a un snapshot dans `content_performance_snapshot` aujourd'hui.
- Tests 100%.

### S3.2 — Alerting publication failures ⏱️ 0.5 jour — **[done] 2026-05-21 (commit 8917845)**

**Risque résolu** : un échec de publication passe inaperçu jusqu'à ce que quelqu'un regarde le calendrier.

#### Spec

- Hook côté worker (`runScheduledPublishJobs`) : si `result.ok=false`, émettre :
  - Log structuré niveau `error` avec `event=social.publish.failed`.
  - Optionnel : webhook (réutilise `CHAT_ALERTS_WEBHOOK_URL` ou nouveau `SOCIAL_ALERTS_WEBHOOK_URL`).
- Digest hebdo (nouveau cron `/api/cron/content-studio/weekly-failure-digest`) :
  - Compte des échecs des 7 derniers jours groupés par provider/platform.
  - Envoi mail à `CHAT_DIGEST_RECIPIENT` (réutiliser canal) ou nouveau `SOCIAL_DIGEST_RECIPIENT`.

#### Done si

- Un échec test produit un événement Sentry/log identifiable.
- Mail digest hebdo lisible et actionnable.

### S3.3 — Dashboard admin Content Studio ⏱️ 1 jour — **[done] 2026-05-21 (commit 6b6366d)**

**Objectif** : `/admin/content-studio/dashboard` — un coup d'œil pour santé du module.

#### Widgets

- **Posts publiés cette semaine** (count + barre 7j)
- **Taux de succès** (publishedJobs / totalJobs) avec couleur seuils
- **Coût IA cumulé** (somme `content_generation_run.cost_cents` mois en cours)
- **Last publish per account** (table comptes × dernier succès × dernier échec)
- **Top performers** (si S3.1 fait : 5 meilleurs posts par impressions semaine dernière)

#### Spec

- Nouvelle page `apps/web/src/app/admin/content-studio/dashboard/page.tsx`.
- Réutilise `components/admin/MetricCard` + nouveaux `SocialAccountHealthCard`.
- Service `lib/content-studio/dashboard.ts` qui agrège (1 query par widget, mise en cache 5 min).

#### Done si

- Dashboard charge < 1.5s.
- Tous les widgets affichent des données réelles ou « pas de données » lisible.

---

## SPRINT 4 — Long terme (à planifier au cas par cas)

### S4.1 — CDN Cloudflare R2 pour media

**Quand déclencher** :
- Volume staging > 1 Go OU prod activée OU latence load `/_media/...` > 500ms p95.

**Effort** : 2-3 jours.

**Étapes** :
- Provisioner bucket R2 + token API.
- Implémenter `MediaStorageDriver` R2 (cf. interface `lib/media/storage.ts`).
- Migration progressive : nouveaux media → R2, anciens restent local jusqu'à un script de migration batch.
- Health check R2 + fallback local si R2 down.

### S4.2 — Learning loop

**Quand déclencher** : après 100+ posts avec snapshots performance (S3.1 prérequis).

**Effort** : 1 semaine.

**Étapes** :
- Analyser corrélation prompt features ↔ performance.
- Boucle de feedback dans la génération texte : injecter "top performers récents" dans le prompt.
- A/B test : posts générés avec/sans feedback.

### S4.3 — Brand-rules amélioration

**Effort** : 2-3 jours.

**Étapes** :
- Scoring hashtags (pertinence, langue, trending).
- Quality score alt-text (longueur, descriptif, accessibilité).
- Détection langue (FR vs AR vs mélange).
- Règles métier extensibles via admin UI (actuellement hardcodées).

### S4.4 — Multi-tenant (si applicable)

Hors-périmètre actuel. À documenter si besoin émerge.

---

## Vue d'ensemble

| Sprint | Durée | Objectif | Done critère majeur |
|---|---|---|---|
| **S1** | 1 j | Validation + push | UI E2E OK, remote synchronisé |
| **S2** | 3-4 j | Pipeline unique | Telemetry legacy à 0 sur 7j |
| **S3** | 2-3 j | Observabilité | Dashboard ≤ 1.5s, snapshots actifs, alerting OK |
| **S4** | variable | Scale & quality | Selon trigger |

**Effort total séquentiel S1+S2+S3** : ~7-9 jours dev pour atteindre un module prêt production.

---

## Préconditions opérationnelles partagées

- Working tree propre avant chaque sprint.
- Tests verts (`npx vitest run` sur zones touchées).
- Typecheck OK (`npx tsc --noEmit`).
- Build OK (`npx next build`).
- Service restart OK (`systemctl restart femiglow-staging.service`).
- Smokes OK (`pnpm smoke:content-studio` + endpoints 401/200).

## Postconditions partagées

- Commit avec message conventionnel + co-author Claude.
- Mise à jour de ce document (mark sprint comme `[done]` avec date + commit).
- Update du runbook spécifique sprint (créé si besoin dans `docs/ai-content-service/runbook-sprint-X-YYYY-MM-DD.md`).

---

## Décisions en attente

- [ ] **S2.2** : implémenter Meta Graph adapter ou skip ? (recommandation : skip)
- [ ] **S2.3 Phase d** : DROP ou archive `content_postiz_delivery` après suppression code ?
- [x] **S3.2** : nouveau `SOCIAL_ALERTS_WEBHOOK_URL` **avec fallback** sur `CHAT_ALERTS_WEBHOOK_URL` (idem `SOCIAL_DIGEST_RECIPIENT` → `CHAT_DIGEST_RECIPIENT`).
- [ ] **S4.1** : trigger précis CDN — seuil volume ou seuil latence ?
