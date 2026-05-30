## Domaine Publication Postiz — État RÉEL constaté (preuves)

### Environnement vérifié (serveur PM2 'web' pid 3603360, port 8012)
- `/proc/3603360/environ`: `SOCIAL_PUBLISHING_MODE` NON défini => `env.ts:120` défaut `dry_run`. `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` NON défini. `POSTIZ_BASE_URL=https://postiz.lumiereacademy.com`, `POSTIZ_API_KEY` présent (64 chars), `CRON_SECRET` présent, `CONTENT_STUDIO_IMAGE_PROVIDER=mock`, `NEXT_PUBLIC_SITE_URL=https://staging.femiglow-maroc.com`.
- Auth probes: `/api/admin/content-studio/health` => 200 authentifié, 401 sans cookie. `.auth/admin.json` valide (cookie 457 chars).

### MODE MOCK (dry_run) — FONCTIONNE (prouvé)
- `GET /api/admin/content-studio/publish-jobs` => 11 jobs, TOUS `{provider:dry_run, status:published, publishMode:now}`. Permaliens factices, médias `https://staging.femiglow-maroc.com/_media/content-studio/mock/reel-9x16.mp4`.
- **Probe sanctionnée (1 POST mock)**: `POST /posts/cp_pwd_.../draft-on-provider` => `job.status=published, provider=dry_run, publishMode=draft, result.ok=true, permalink=https://social.example.test/instagram/draft/dry_3e07f296ee6af4980d`. => chemin brouillon dry_run COMPLET et sain.
- `GET /publishability` fonctionne (résout compte dry_run, calcule errors/warnings).
- Tests unitaires: 227+ verts dans `src/lib/social-publishing/*` et `content-studio/postiz.test.ts` (mais Postiz mocké par injection — ne touche jamais l'API réelle).

### MODE LIVE (Postiz) — CONTRAT LECTURE OK, ÉCRITURE NON EXERCÉE
- **Probe read-only réelle**: `curl -H 'authorization: <KEY>' https://postiz.lumiereacademy.com/api/public/v1/integrations` => **HTTP 200**, 4 comptes IG réels: AlFenna Beauty (cmojqqeyo...), Lumière Academy (cmojqop1q...), Chaplin Crêpes (cmojqpv29...), Ahmed El Azhar Jebbari (cmp5t11aw...). `identifier=instagram`, `provider=null` (mappé via `identifier ?? provider` => OK). => auth (clé brute, pas Bearer) et endpoint corrects.
- `GET /api/admin/social/accounts`: 6 comptes (4 postiz IG + 2 dry_run), Postiz synchronisés et `status=active`, remoteId = id Postiz live.
- AUCUN job Postiz en base (11/11 dry_run). La chaîne d'écriture live (upload multipart + POST /posts + extraction releaseURL) n'a JAMAIS été exercée => untested/broken par principe directeur. Contrat `type=draft` confirmé valide côté Postiz (skill FEATURES.md:213).

### BLOCKER: programmation inerte
- `runScheduledPublishJobs` appelé UNIQUEMENT par `/api/cron/content-studio/social-publish-scheduler` (protégé CRON_SECRET). Cette route est ABSENTE de `vercel.json` (15 crons listés, pas celui-ci), aucun crontab système, et `/api/cron/tick` (seul cron/min) ne la relaie pas. => job programmé reste `queued` à jamais. `publish-jobs?status=queued` => 0 (rien n'a été programmé/exécuté).

### Décalage test<->réalité
- E2E `content-studio-social-publishing-draft:25` ÉCHOUE mais dans le **teardown** (`PostgresError: relation "audit_event" does not exist` à L227 `cleanupSeed`), PAS dans les assertions. Le chemin produit (brouillon dry_run) est sain (re-prouvé). Résidu non nettoyé en base: `cp_pwd_1780079694294_msqqp0` (approved) toujours présent.
- vitest sort EXIT 1 sur une unhandled rejection vidéo (hors périmètre), illustrant des rapports verts masquant des process en échec.

### Désync capabilities
- `account.capabilities` persistées sont STALE: `supportsDraft` absent partout, dry_run IG limité à post+carousel (pas reel/story) — alors que le code adapter (dry-run.ts:17-25, postiz.ts:30-36) déclare reel/story/supportsDraft:true. La validation serveur recalcule (frais) => OK; l'UI lit le persisté => faux.

### Contournements / dette
- Route legacy `/postiz-draft` (Sunset 2026-08-01) appelle `createDraftInPostiz` -> API Postiz réelle SANS respecter dry_run (contournement du garde-fou). La nouvelle UI pointe vers `/draft-on-provider` (sûr).
- `cancelScheduledPost`/`reschedulePost` ne touchent pas les `social_publish_job` queued (orphelins).
- `buildSocialContent` force `metadata.dryRun=true` même en live.
- `meta_graph` listé dans SOCIAL_PROVIDER_IDS mais adapter=null (trappe invalid_state).
- `resolveDefaultAccount` en live retombe sur le 1er compte Postiz actif sans pin (risque mauvais compte client), et l'UI n'envoie aucun accountId.