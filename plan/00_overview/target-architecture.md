# Architecture cible — convergence vers A (LangGraph moteur unique)

> FemiGlow Content Studio v2 / AI Engine · cible **ADR-0007 Option 1**
> Statut : conception (aucun code applicatif modifié). Diagramme associé : `target-architecture.puml`.
> ADR existants référencés : `docs/audit-generation-publication-2026-05-29/decisions/adr-0001..0007`. Nouveaux ADR proposés en §7 (à créer en Phase B).

---

## 1. Principe cible

Le **graphe LangGraph (A)** devient le **moteur de génération unique**. Le create-flow opérateur (B) cesse d'être un second moteur : il devient une **couche UI + façade d'orchestration au-dessus de A**. L'opérateur accède réellement à la chaîne complète — script → images/vidéo → voix-off → musique → sous-titres → compose → transcode/export — via les mêmes nœuds que A.

État actuel (cassé) vs cible :

| | Aujourd'hui | Cible |
|---|---|---|
| Moteurs de génération | **Deux** (A riche, B pauvre), dupliqués | **Un** (A) ; B = UI/façade |
| Pont A/B | **Unidirectionnel** A→B ; B n'invoque jamais A | **Bidirectionnel** : B invoque A (`invokeEngine`), A se matérialise en draft B |
| Voix-off / montage / export | **Inatteignables** par l'opérateur (BUG-004) | Atteignables via A |
| Résolution de clé | **≥ 3 chemins divergents** (picker ≠ générateur ≠ graphe) | **1** source : `resolveProviderCredential()` |
| Providers async (Higgsfield) | **Sync faux** → échec permanent | **Async submit+poll** dans un worker de jobs |
| Polling / scheduler | Polling dans le handler ; scheduler non câblé | **File de jobs unique** (worker resumable) |
| Badges « Live » | Mensongers (14 modèles non générables) | **Honnêtes** (clé + provider joignable, même source que le moteur) |
| Signal de test | Ment (1695 verts / exit 1) | **Harnais de parité** mock/live, gate sur exit code |

---

## 2. Composants de l'architecture cible

### 2.1 Moteur unique A (graphe LangGraph)
- Les 16 nœuds existants (`src/lib/ai-engine/nodes/*`) restent le cœur. Inchangé conceptuellement, mais **exposé** comme service unique.
- **Contrat de sortie complet** : `GenerationResult` propage **toutes** les capacités produites par le graphe — `script`, `caption`, `variants`, `images`, `video`, `voiceover`, `music`, `subtitles`, **`composition`, `exports`, `thumbnails`**. Aujourd'hui `buildResultFromState` perd `composition/exports/thumbnails` **avant** le pont (MISS-005, BUG-034) : c'est la **racine structurelle** de BUG-004 et le **prérequis absolu** de toute convergence (T-104). Sans cela, un pont — même bidirectionnel — lit `undefined`.
- **Contrat d'erreur honnête** : les nœuds média poussent leurs échecs/dégradations dans `state.errors` ; le quality-gate ne peut plus certifier `completed` sur média absent (MISS-011, T-304). Indispensable *avant* de brancher du live (sinon le live échoue en silence comme le mock).

### 2.2 Façade d'invocation `invokeEngine(brief) → GenerationResult`
- **Frontière de service unique** que la couche B (create-flow) appelle. C'est le **pivot** de la convergence.
- **Pont bidirectionnel** : B→A à l'invocation (l'opérateur déclenche une génération riche) ; A→B à la matérialisation (le résultat devient un draft B persisté, avec tous ses assets approuvables). Idempotent, **async-aware** (un brief peut produire des jobs longs).
- Le pont **persiste les assets composés** (compose/exports/thumbnails) dans la bibliothèque (T-401/T-402) — aujourd'hui le bridge crée des drafts **sans média approuvable** (ADR-0007 §contexte).

### 2.3 File de jobs async unique (worker resumable)
- **Une seule** infrastructure de jobs, mutualisée entre :
  - le **polling provider** (Higgsfield async submit+poll — le poll peut durer plusieurs minutes et **ne doit pas vivre dans la requête HTTP opérateur**, ADR-0006 §⚠) ;
  - le **scheduler de publication** (`runScheduledPublishJobs`, BUG-003).
- Propriétés : reprise (`resumable`), **idempotence + locking** (ticks chevauchants), backoff borné, timeout global, retry borné des jobs `failed` retryables (T-302), heartbeat `social_publish_event` (ADR-0005 §3).
- **Déclencheur self-hosted** : câblé sur `/api/cron/tick` (systemd timer existant, déclenché chaque minute) avec `CRON_SECRET` — **pas** `vercel.json` (sans effet en self-hosted, ADR-0005). Contrôle CI : toute route `/api/cron/*` a un déclencheur sur la cible effective.
- **Stockage déterministe** : `MEDIA_DIR` **absolu injecté**, indépendant de `process.cwd()` — car le worker/cron peut tourner avec un autre cwd que `apps/web`, sinon les assets sont écrits/servis ailleurs et la file produit des médias introuvables (MISS-024/032, T-411). **Doit précéder** la mise en worker du polling/scheduler.

### 2.4 Résolution de credentials unifiée
- **Une seule source** `resolveProviderCredential(provider)` (ADR-0004, T-005), consommée par A, B **et** le picker. Aujourd'hui le split d'env (`OPENAI_API_KEY` présent mais lu via `CONTENT_STUDIO_OPENAI_API_KEY` vide) casse l'image live (BUG-001) ; la clé valide est **déjà dans le process** → déblocage bon marché et immédiat.
- Caches (`resolvedKeyCache`, `modelCache`, `getEngineConfig`) **invalidables** sur changement d'env (T-410, MISS-030/033), pour ne pas masquer un correctif.
- Higgsfield exige un credential complet `KEY_ID:KEY_SECRET` ; gating clair sinon, validation au boot quand un modèle `hf-*` est exposé (ADR-0006).

### 2.5 Picker de modèles honnête
- Le badge « Live » s'affiche **uniquement** si le moteur résout réellement une clé **ET** le provider est joignable — c'est-à-dire si le picker interroge **la même source que le moteur** (T-202). Liste blanche de capacités par rôle (exclure `whisper-1`/`sora`/`davinci`/`omni-moderation` de `role=chat`).
- Ne marquer `source:"live"` que les modèles réellement renvoyés par l'API (sinon `static`/`fallback`) ; corriger la discovery Higgsfield sur le bon host/auth (ADR-0006 §2, BUG-024/MISS-019).

### 2.6 Harnais de parité mock/live (pièce maîtresse de vérification)
- **MSW au niveau réseau** intercepte les vrais endpoints (OpenAI, Higgsfield async, Postiz) avec des handlers **fidèles aux contrats**, `onUnhandledRequest:'error'` (ADR-0003, T-006).
- **Détecteur de divergence** schéma zod partagé mock↔live ; golden contracts rafraîchis ; tout endpoint synchrone faux fait **rouge** le contract-test (verrou anti-régression de l'async Higgsfield).
- **Smoke opérateur** (T-010) en CI, **mock ET live**, assertant l'effet backend — exécuté *avant* toute bascule de frontière pour protéger le seul parcours qui marche.

### 2.7 Publication (sous garde-fou)
- Adapters `dry-run` et `postiz` exposant **le même contrat** (permaliens/statuts) (T-308).
- Idempotence indépendante de `scheduledAt` + dédup (T-204) ; sync `content_post ↔ social_publish_job` sur cancel/reschedule (T-301) ; compte explicite en live (T-303).

---

## 3. Le COMMENT de la convergence (justification)

**Pourquoi poser la frontière (T-104) AVANT de réparer les providers (T-101/102/103) ?**
Réparer BUG-001/002 dans `content-studio/*` (B) reviendrait à investir dans le **moteur condamné**, puis à re-migrer. En posant d'abord le **contrat de service unique** (`GenerationResult` complet + `invokeEngine`), chaque réparation provider est faite **une seule fois, dans A**, et profite à B par délégation. C'est l'arbitrage *architecture-first* : dette et reprises minimales.

**Pourquoi mutualiser l'infra de jobs ?**
Le polling Higgsfield (BUG-008) et le scheduler de publication (BUG-003) ont **les mêmes besoins** : worker resumable, idempotence, locking, retry, observabilité. Une seule file évite deux mécaniques concurrentes et un double coût de maintenance. C'est pourquoi le séquencement traite l'async provider et le scheduler dans la même phase, sur le même socle.

**Pourquoi incrémental et réversible (pas big-bang) ?**
La refonte de `buildResult` + pont bidirectionnel est le **point de défaillance unique** de la cible. Une bascule frontale du create-flow sur A risquerait de régresser le **seul parcours qui marche aujourd'hui** (le mock B). On migre donc **capacité par capacité**, derrière un **feature-flag**, chaque migration gardée par le smoke opérateur — rollback trivial. C'est l'arbitrage *valeur-first* injecté dans le COMMENT.

---

## 4. Étapes de migration B → A

1. **Contrat complet (T-104, P1).** Étendre `GenerationResult` + `buildResultFromState` pour propager `composition/exports/thumbnails` ; corriger le bridge pour persister les assets et ne **jamais** créer de draft sans média approuvable. *Premier pas atomique, structurel — débloque BUG-004.*
2. **Façade `invokeEngine` (P1).** Introduire la frontière d'invocation B→A derrière un feature-flag ; B continue d'appeler son chemin actuel jusqu'à bascule.
3. **Providers derrière la frontière (P1).** Image OpenAI live (T-101, conséquence de T-005) ; Higgsfield async submit+poll dans le worker (T-102/T-103).
4. **Texte (P2).** B délègue la génération de texte aux nœuds A (`generate-script/caption/variants`) — fin du fallback figé (T-201) et de la duplication texte (BUG-015/026).
5. **Variation (P3).** `variation` régénère réellement via `generate-variants` de A (T-305, BUG-017).
6. **Montage/voix-off (P4).** Compose/transcode réels atteignables par l'opérateur (T-307/T-403) une fois les assets remontés (T-104) et persistés.
7. **Bascule structurelle finale (P5).** B délègue à A pour **toutes** les capacités (T-901) ; retrait du chemin B legacy une fois la parité prouvée mock+live. HITL/modération de A rendus **optionnels** côté create-flow pour ne pas imposer le poids complet de A à un usage rapide.

---

## 5. Ce qu'on retire (dette & fausses affordances)

- **Le second moteur de génération** (générateurs texte/image de B) → délégation à A (BUG-015/026, T-901).
- **Les badges « Live » mensongers** et les modèles non routables/hors-rôle dans le picker (BUG-006/007/009/016/019/024, MISS-002/015/018).
- **Les endpoints Higgsfield synchrones faux** (BUG-008/025, MISS-009/022) → async.
- **Le polling dans le handler HTTP** → worker de jobs (ADR-0006).
- **Les contournements de garde-fou** : route legacy `/postiz-draft` (BUG-040, T-020), médias servis sans auth `/_media` (MISS-010, T-021).
- **Les faux succès silencieux** : `completed` sans média, `<video src=''>`, image 404, `dryRun` codé en dur (BUG-045/065, MISS-011/020/021, T-304/T-308).
- **Le couplage `process.cwd()`** du stockage (MISS-024/032, T-411) et les **caches non invalidables** (MISS-030/033, T-410).
- **Les 977 stubs jpg** de prod et la pollution du stockage par les tests (BUG-031, MISS-004, T-306).

---

## 6. ADR existants applicables

| ADR | Sujet | Rôle dans la cible |
|---|---|---|
| ADR-0002 | Vérité = comportement réel | DoD : effet backend prouvé |
| ADR-0003 | Harnais de parité mock/live (MSW réseau) | §2.6 — instrument de vérification |
| ADR-0004 | Résolution de clés OpenAI unifiée | §2.4 — `resolveProviderCredential()` |
| ADR-0005 | Déclencheur cron self-hosted | §2.3 — file de jobs / scheduler |
| ADR-0006 | Higgsfield async submit+poll | §2.3 — polling dans le worker |
| ADR-0007 (Option 1) | Frontière A/B → convergence vers A | §1 — décision cible |

## 7. Nouveaux ADR proposés (à créer en Phase B)

- **ADR-0008 — Façade `invokeEngine` & pont bidirectionnel idempotent.** Contrat de la frontière B→A, sémantique async, idempotence de matérialisation, feature-flag de bascule.
- **ADR-0009 — File de jobs async unique (worker resumable).** Mutualisation polling provider + scheduler ; idempotence/locking ; déclencheur self-hosted ; observabilité. (Consolide ADR-0005 + ADR-0006 côté exécution.)
- **ADR-0010 — Contrat `GenerationResult` complet & contrat d'erreur du graphe.** Propagation `composition/exports/thumbnails` ; `state.errors` obligatoire pour les nœuds média ; interdiction de `completed` sur média absent.
- **ADR-0011 — Stratégie de bascule incrémentale & retrait du chemin B legacy.** Critères de parité mock+live par capacité avant retrait ; plan de rollback.

---

## 8. Risques structurels & mitigations (rappel synthétique)

| Risque | Mitigation |
|---|---|
| Refonte `buildResult`/pont = point de défaillance unique | Pas atomique d'abord (T-104), flag, smoke opérateur en garde-fou |
| Doubles publications IG clients | T-204+T-301 = **gate dur** avant activation live de T-103b (P3) |
| MSW infidèle = fausse parité | Détecteur de divergence zod, `onUnhandledRequest:'error'`, contract-test rouge sur sync faux |
| Polling dans le handler = timeout runtime | Poll dans worker resumable, borné (ADR-0006) |
| Credential Higgsfield incomplet (hors contrôle) | DoD découplée : contrat async en mock ≠ vérif live (déclenchée à la fourniture) |
| `process.cwd()` du stockage casse en worker | T-411 (`MEDIA_DIR` absolu) **avant** mise en worker |
| Caches masquent les correctifs | T-410 invalidation ; restart documenté sinon |
| Régression du seul flux qui marche (mock B) | Convergence par flag, capacité par capacité, smoke opérateur bloquant |
