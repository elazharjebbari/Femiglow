# Analyse de l'historique de développement — AI Content Studio

**Source** : Session Codex `019e2833-9bed-73e3-83e5-ffe3432e656c`
**Dates** : 14 mai 2026 (20h38) → 15 mai 2026 (19h37)
**Durée totale** : ~23 heures (session continue avec pauses)
**Fichier brut** : `docs/ai-content-studio/annexes/codex-session-history.md` (15 131 lignes, 733 Ko)

---

## Chronologie détaillée

### Phase 0 — Audit & Cadrage (14/05, 20h38 – 21h12)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 1 | **Audit du repo** | Codex analyse le dépôt staging : architecture Next 14 App Router, Drizzle/Postgres, admin étendu, email/Listmonk, chat, tracking, CMS composants, media, reset, legal, analytics. Produit un audit dans `docs/audit/audit-application-staging-2026-05-14.md`. |
| 2 | **Brainstorming & spécification** | Lecture de `docs/ai-content-service/concept.md`, recherche web sur les patterns de content studio, DAM, social publishing, génération IA de contenu de marque. Produit le dossier complet `docs/ai-content-studio/` avec 38 fichiers structurés (brainstorming, architecture, data model, API contracts, UX, brand safety, intégration Postiz, automatisation, tests, plan d'action, runbook). **Décision stabilisée** : un Content Studio intégré à l'admin FemiGlow, avec génération IA assistée, validation humaine obligatoire, et bridge Postiz. |

### Phase M1 — Data + Services socle (14/05, 21h24 – 21h35)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 3 | **Exécution du plan** | L'utilisateur demande d'exécuter le runbook. Codex identifie que le dossier est une spécification, pas du code existant, et propose un plan d'exécution structuré. |
| 4 | **Schema + Migration** | Création de `schema-content-studio.ts` avec tables dédiées (idea, draft, post, postiz_delivery, media_link), migration `0050_ai_content_studio.sql`. Correction du journal de migrations (conflit avec migrations 0047b/0049b/0049c). |
| 5 | **Env + Types** | Ajout de `CONTENT_STUDIO_ENABLED`, `POSTIZ_BASE_URL`, `CONTENT_STUDIO_OPENAI_API_KEY` dans `.env` et `env.ts`. Types métier dans `types.ts`. |
| 6 | **State Machine + Brand Rules** | Moteur d'état (idea → draft → review → approved → scheduled), règles de marque déterministes (termes bloqués, claims médicaux, hashtags max, etc.). |
| 7 | **Generation Service + Postiz Bridge** | Service de génération avec fallback déterministe si pas de clé IA. Bridge Postiz avec mode draft uniquement. |
| 8 | **Repository** | Couche accès données avec requêtes typées. |
| 9 | **Validation** | TypeScript OK, migration validée et appliquée sur DB staging. |

### Phase M2 — API Admin (14/05, 21h29 – 21h35)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 10 | **Endpoints API** | Création des routes `/api/admin/content-studio/` : idées, drafts, review, approve, posts, sync Postiz, création de draft Postiz. Intégration avec le RBAC admin existant. |

### Phase M3 — UI Prototype (14/05, 21h31 – 22h11)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 11 | **Page admin** | Création de `/admin/content-studio` avec : capture d'idée, génération de drafts, liste de brouillons, review/approval, création de draft Postiz. Ajout dans `AdminShell.tsx`. |
| 12 | **Build & Redémarrage** | Build Next, correction des permissions `.next/cache`, redémarrage du service systemd. Accès admin fourni : `admin@femiglow-maroc.com / FemiGlow2026!`. |
| 13 | **Section d'aide repliable** | Ajout d'une section discrète en haut de page expliquant le workflow en 3 étapes (cadrer, générer, publier) et le fait que la génération image n'est pas encore incluse. |
| 14 | **Sélecteur média + Preview** | Endpoint `/api/admin/content-studio/media`, asset picker, preview type Instagram/Facebook avec image + caption + hashtags, association média au draft. Correction du bridge Postiz pour envoyer une URL publique même quand `originalUrl` est vide. |
| 15 | **Smoke Postiz** | Test end-to-end : idée → brouillons → média → approbation → draft Postiz. Réussi avec statut `sent`. |

### Phase M4 — Intégration Postiz (14/05 22h09 – 15/05 08h14)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 16 | **Validation robuste Postiz** | L'utilisateur constate que les médias n'apparaissent pas dans `/media` sur Postiz. Diagnostic : passer une URL image dans `posts:create` ne crée pas d'entrée dans la médiathèque Postiz. Il faut utiliser `POST /api/public/v1/upload` pour uploader le média, récupérer un ID Postiz + URL Cloudinary, puis créer le draft avec cet ID. |
| 17 | **Bug URL relative** | Le helper de génération de nom de fichier recevait parfois une URL relative → `Invalid URL`. Corrigé pour accepter les chemins relatifs. |
| 18 | **Smoke robuste** | Après correction, le flux complet fonctionne : upload Postiz retourne un vrai ID média + URL Cloudinary accessible. |

### Phase M3+ — UX Complète (15/05, 08h20 – 10h04)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 19 | **Codes visuels** | L'utilisateur remarque que tout a le même style. Ajout de couleurs sémantiques : rose (cadrage/idées), bleu (production), ambre (médias), indigo (preview), violet (Postiz/publication), vert (validation). |
| 20 | **Panneau Postiz** | Affichage de la dernière livraison Postiz par post : statut visuel (sent/failed/auth_failed), ID livraison, ID média Postiz, URL Cloudinary cliquable, bouton "Réessayer Postiz" en cas d'échec. |
| 21 | **Calendrier éditorial** | Section "Pipeline éditorial" en haut de l'interface avec posts approuvés, posts datés, livraisons Postiz, cartes de suivi. Champ "Date cible" dans le panneau Postiz. La date est envoyée dans le payload Postiz (`date`) et persistée sur le post (`scheduledAt`). |
| 22 | **Compartiments média** | L'utilisateur demande que le média soit séparé en deux compartiments : "Importés" (médiathèque FemiGlow existante) et "Générés IA" (futurs médias IA). Les deux sources sont navigables via des onglets et les médias des deux peuvent être sélectionnés. |
| 23 | **Bug picker média** | Le compartiment IA semblait non vide alors que le backend renvoyait 0 média IA → correction du comportement client. La recherche filtre maintenant automatiquement après saisie avec debounce. |

### Génération d'images IA (15/05, 11h04 – 13h50)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 24 | **Service de génération d'images** | Nouveau service `image-generation.ts` avec provider mock et OpenAI. Endpoint `/api/admin/content-studio/generate-visual`. Modèle par défaut `gpt-image-2`, fallback mock. |
| 25 | **UI "Générer un visuel"** | Bouton dans le Content Studio avec : prompt éditable (direction artistique FemiGlow pré-remplie), choix du format (4:5, 1:1, paysage), choix qualité (brouillon, standard, haute). Stockage dans le media system FemiGlow, optimisation via le pipeline existant, marquage `overrides.contentStudio = true`. |
| 26 | **Clé API OpenAI** | `CONTENT_STUDIO_OPENAI_API_KEY` ajoutée à `.env` (copie de `OPENAI_API_KEY` existante). Le service systemd charge bien le fichier. |
| 27 | **Bug FK actorId** | Le smoke utilisait `actorId='system-test'` qui n'est pas un admin réel → contrainte FK. Corrigé pour accepter `actorId: null`. |
| 28 | **Race condition média** | Le média IA était créé mais pas encore optimisé quand le service le relisait. Rendu plus robuste. |
| 29 | **Config mock par défaut** | `CONTENT_STUDIO_IMAGE_PROVIDER=mock`, `CONTENT_STUDIO_IMAGE_MODEL=gpt-image-1-mini`. Tests en mode mock consomment 0 solde OpenAI. Basculement vers `openai` pour les vrais tests. |

### Phase M5 — Tests + Runbook (15/05, 13h54 – 14h17)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 30 | **Smoke script** | `pnpm --filter @femiglow/web smoke:content-studio` avec garde-fou anti-consommation (refuse OpenAI si provider != mock). |
| 31 | **Tests unitaires** | 11 tests ajoutés : brand rules, postiz bridge, state machine, image mock provider. |
| 32 | **Correction worker media_jobs** | Le worker `media_jobs` ne traitait pas correctement les médias créés via SQL brut. |
| 33 | **Runbook mis à jour** | `docs/ai-content-studio/130-runbook/prototype-runbook.md` mis à jour avec la config staging. |

### Automatisations v0 (15/05, 14h49 – 16h31)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 34 | **Cron endpoints** | Ajout de 4 endpoints protégés par `CRON_SECRET` : `POST /api/cron/content-studio/postiz-sync`, `retry-deliveries`, `import-status`, `import-performance`. |
| 35 | **Retry conservateur** | Ne retente que le dernier échec d'un couple `postId + integrationId`, ignore les erreurs d'auth en boucle. Mode `dryRun` pour vérifier sans effet de bord. |
| 36 | **Import statut/performance** | Snapshots internes depuis l'API Postiz (`GET /posts`, `GET /analytics/post/{postId}`, `GET /analytics/{integration}`). Donnent de la visibilité sans modifier le workflow métier. |
| 37 | **Vérification** | Dry-run retry OK (1 ancien échec ignoré), sync Postiz OK (4 intégrations actives). |

### Panneau Santé Postiz (15/05, 16h32 – 19h37)

| # | Étape | Ce qui s'est passé |
|---|-------|--------------------|
| 38 | **Panneau admin** | Route serveur authentifiée `/api/admin/content-studio/automation` (sans exposer `CRON_SECRET`). Panneau avec : compteurs, dernières livraisons, dry-run retry/import, snapshots statut/performance. |
| 39 | **Correction 401/403** | La route d'automatisation ne renvoyait pas une réponse propre sans session. En cours de correction pour un `401/403` explicite. |

**C'est ici que la session Codex s'est arrêtée.**

---

## État actuel du projet

### Ce qui est implémenté et fonctionnel

| Composant | Statut | Fichiers clés |
|-----------|--------|---------------|
| Schema DB + Migration | ✅ OK | `schema-content-studio.ts`, `0050_ai_content_studio.sql` |
| State Machine | ✅ OK | `content-studio/state-machine.ts` |
| Brand Rules Engine | ✅ OK | `content-studio/brand-rules.ts` |
| Generation Service (texte) | ✅ OK | `content-studio/generation.ts` |
| Generation Service (images) | ✅ OK | `content-studio/image-generation.ts` (mock + OpenAI) |
| Repository | ✅ OK | `content-studio/repos.ts` |
| Service Layer | ✅ OK | `content-studio/service.ts` |
| Postiz Bridge | ✅ OK | `content-studio/postiz.ts` (upload + draft) |
| API Admin | ✅ OK | `/api/admin/content-studio/*` |
| Cron Endpoints | ✅ OK | `/api/cron/content-studio/*` |
| UI Admin | ✅ OK | `/admin/content-studio` avec wizard, picker média, preview, calendrier |
| Panneau Santé Postiz | ⚠️ En cours | Route authentifiée OK, correction 401/403 en suspens |
| Smoke Tests | ✅ OK | `smoke:content-studio` |
| Tests unitaires | ✅ OK | 11 tests (brand rules, postiz, state machine, image mock) |
| Config staging | ✅ OK | `CONTENT_STUDIO_IMAGE_PROVIDER=mock`, `CONTENT_STUDIO_IMAGE_MODEL=gpt-image-1-mini` |

### Ce qui reste à faire

| Item | Priorité | Notes |
|------|----------|-------|
| Correction 401/403 route automation | Haute | Dernière chose en cours quand la session s'est arrêtée |
| Tests E2E fake Postiz | Moyenne | M5 prévoit un test Playwright ou route mock |
| Tests contrats Postiz complets | Moyenne | Upload média, payload avec date, erreur auth, retry, échec upload |
| Runbook ops final | Moyenne | Mettre à jour avec la config définitive |
| Exploitation des snapshots Postiz | Basse | Afficher les analytics dans l'interface |
| Feature flag | Basse | Le plan prévoit que le prototype puisse être désactivé par feature flag — à vérifier |
| Validation humaine obligatoire | Basse | Déjà en place via le workflow state machine |

---

## Problèmes rencontrés et résolus

| Problème | Solution |
|----------|----------|
| Journal de migrations non séquentiel (0047b/0049b/0049c) | Correction du `_journal.json` pour préserver toutes les migrations existantes |
| Médias non visibles dans `/media` Postiz | Passage de `posts:create` avec URL → upload via `POST /api/public/v1/upload` avant création du draft |
| `Invalid URL` dans le helper de nom de fichier | Acceptation des chemins relatifs en plus des URLs absolues |
| FK constraint sur `actorId='system-test'` | Accepter `actorId: null` dans les tests système |
| Race condition sur l'optimisation média IA | Rendu plus robuste avec attente de la disponibilité |
| Permissions `.next/cache` après build | Correction des droits pour l'utilisateur `nodeapp` |
| Variable `CONTENT_STUDIO_OPENAI_API_KEY` non chargée | Ajout explicite dans `.env` + vérification que systemd charge le fichier |
| Service systemd qui ne reste pas supervisé | Correction de l'unité systemd pour lancer le binaire Next via le shell de `nodeapp` |
| Compartiment IA semblant non vide | Bug client : conservation de l'ancienne liste lors du changement d'onglet → corrigé |
| Recherche média non réactive | Ajout de debounce + filtrage automatique sans clic sur bouton |