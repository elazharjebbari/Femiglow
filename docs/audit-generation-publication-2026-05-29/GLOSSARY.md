# Glossaire

Terminologie du projet FemiGlow Content Studio v2 / AI Engine, telle qu'employée dans cette baseline d'audit.

| Terme | Définition |
|---|---|
| **Content Studio v2** | Interface admin de création/planification/publication de contenu social. Pages sous `/admin/content-studio-v2/*`. |
| **AI Engine** | Sous-système de génération basé sur **LangGraph** (pipeline A). Pages `/admin/content-studio-v2/ai-engine/*`. |
| **Create flow** | Le parcours opérateur de création directe sur `/admin/content-studio-v2/create` (pipeline B). C'est l'écran principal de l'opérateur. |
| **Pipeline A** | Graphe LangGraph à 16 nœuds (`src/lib/ai-engine/nodes/*`) : multimédia complet (script→images/vidéo→voix-off→musique→sous-titres→compose→export). |
| **Pipeline B** | Chaîne « create » (`src/lib/content-studio/*`) : génération image/vidéo/texte + publication. Ne passe **pas** par le graphe LangGraph. |
| **Bridge** | `src/lib/ai-engine/bridge/content-studio-bridge.ts` — pont supposé relier A et B. |
| **Mode MOCK** | Génération simulée : image = SVG décoratif (sharp), vidéo = MP4 pré-rendu statique, texte = templates déterministes. Aucun appel réseau externe. |
| **Mode LIVE** | Génération réelle via providers externes (OpenAI `gpt-image-*`, Higgsfield `hf-*`). Piloté par cookie `cs_generation_mode=live`. |
| **`cs_generation_mode`** | Cookie (mock\|live) posé par `GenerationModeToggle`, lu serveur dans la route `generate-visual`. Persistance 30 j, `SameSite=Lax`. |
| **`SOCIAL_PUBLISHING_MODE`** | Variable d'env `dry_run` (défaut) \| `live`. Sélectionne l'adapter de publication. |
| **dry_run (publication)** | Publication **simulée** : `DryRunSocialPublishingAdapter` renvoie un succès synthétique + permalien factice (`social.example.test/...`). **Rien n'est posté.** |
| **Adapter** | Implémentation interchangeable de la publication : `dry-run` (simulé) ou `postiz` (réel). Pattern dans `src/lib/social-publishing/adapters/`. |
| **Postiz** | Plateforme self-hosted de planification sociale (`POSTIZ_BASE_URL`). API publique `/api/public/v1/{integrations,posts,upload}`. Relaie vers Instagram/Facebook. |
| **Higgsfield** | Service externe de génération image/vidéo IA. API réelle : `platform.higgsfield.ai`, auth `Authorization: Key KEY_ID:KEY_SECRET`, modèle **async submit + poll**. |
| **HITL / reviewGate** | *Human-in-the-loop* — nœud `human-review` du graphe : pause pour validation humaine avant publication. |
| **RAG / knowledge** | Récupération augmentée : collections de connaissances vectorisées (pgvector, `text-embedding-3-small`) injectées par `enrich-knowledge`. |
| **STEPPS** | Cadre de viralité (Social currency, Triggers, Emotion, Public, Practical value, Stories) présent dans le brief stratégique seedé. |
| **HttpError / invalid_state** | Erreur typée (`src/lib/errors/http-error.ts`) ; `invalid_state` → HTTP 409. Utilisée pour signaler un mode/credential incohérent. |
| **generation_run** | Enregistrement d'audit d'une génération (provider, modèle, coût estimé, usage). |
| **social_publish_job / attempt / publication / event** | Entités DB du cycle de publication : job (intention) → attempt (essai) → publication (résultat) → event (journal). |
| **storageState** | Fichier `.auth/admin.json` (Playwright) contenant la session admin authentifiée, réutilisé pour les probes read-only de l'audit. |
| **MSW** | *Mock Service Worker* (`msw` 2.14.2) — interception réseau pour tests. Installé ; usage réel à vérifier (cf. infra de test). |
| **Parité mock/live** | Garantie cible : les **mêmes** scénarios opérateur passent à l'identique en mock et en live, avec un harnais détectant toute divergence. |
| **DoD** | *Definition of Done* — critère de fin **mesurable** : « vérifié en mock + live par tel chemin opérateur », jamais « fait ». |
| **Baseline figée** | Cet instantané d'audit daté/versionné (`manifest.yaml`). N'est pas réécrit ; les évolutions passent par `CHANGELOG.md` et de nouveaux ADR. |
