# Plan d'action — Synthèse direction

> FemiGlow Content Studio v2 / AI Engine · pipeline génération + publication
> Baseline figée : `docs/audit-generation-publication-2026-05-29/` (2026-05-29)
> Cible d'architecture décidée : **ADR-0007 Option 1 — converger vers A (LangGraph moteur unique)**
> Univers couvert : **102 points = 68 BUG + 34 MISS** (BUG-044 réfuté → no-action). Routage : `plan/01_coverage/_routing.json`.
> Statut de ce document : **plan de conception** (aucune modification de code applicatif).

---

## 1. Vision cible (convergence vers A)

Aujourd'hui, deux pipelines de génération coexistent et sont mal raccordés :

- **A — AI-Engine LangGraph** (`src/lib/ai-engine/*`, 16 nœuds) : moteur riche et complet — script → images/vidéo → voix-off → musique → sous-titres → compose → transcode/export, avec HITL, modération, scoring qualité.
- **B — Content-Studio create-flow** (`src/lib/content-studio/*`) : ce que l'opérateur utilise réellement sur `/create` — une image OU une vidéo + texte, puis publication. Pauvre en capacités.

Le pont est **unidirectionnel A→B** ; **B n'invoque jamais A**. Conséquence : voix-off, musique, sous-titres, montage et export sont **inatteignables** par l'opérateur (BUG-004, blocker), et l'UI promet des capacités que le moteur emprunté ne produit pas.

**La cible (ADR-0007 Option 1) :** le **graphe LangGraph (A) devient le moteur unique**. Le create-flow (B) devient une **UI au-dessus de A** ; l'opérateur accède réellement à voix-off / montage / export. Le pont devient **bidirectionnel** (B invoque A à la demande, A se matérialise en draft B), idempotent et compatible avec l'asynchronicité des providers. On retire les **fausses affordances** (badges « Live » mensongers) et la **duplication** (deux générateurs texte/image concurrents).

> Ce plan **ne re-débat pas** le choix d'architecture (acté par le commanditaire). Il conçoit le **COMMENT** : le séquençage, les étapes de migration B→A, les garde-fous et les risques. Le détail d'architecture cible est dans `target-architecture.md` / `.puml`.

---

## 2. Verdict de l'audit (rappel)

> **Le pipeline « générer → publier » n'est PAS fonctionnel de bout en bout pour un opérateur, et le signal de test le masque.** Seul le mode mock produit un résultat ; la génération **live est cassée des deux côtés** (image/vidéo) et la **publication programmée ne s'exécute jamais**. La cause racine est **systémique** : l'outillage de test certifie un état fictif.

Preuve fondatrice : `vitest` affiche **1695 tests « passed », 0 échec**… mais le **process sort en `exit 1`** (rejet de promesse masqué par des fake-timers). Un voyant vert au-dessus d'un process en échec. En parallèle, sur le seul parcours opérateur, 2 E2E sont rouges et le sélecteur propose 14 modèles « Live » dont **aucun n'est générable**.

**Les 3 causes racines systémiques :**
1. **L'outillage de test ne reflète pas le réel** (mocks au mauvais niveau ; gate CI sur la ligne de résumé, pas sur l'exit code) → *un test vert n'est pas une preuve.*
2. **Deux pipelines dupliqués et mal raccordés** (A riche / B pauvre, pont unidirectionnel).
3. **Résolution de credentials dispersée** sur ≥ 3 chemins divergents (picker ≠ générateur ≠ graphe).

**Les 4 blockers :** BUG-001 (image live cassée — split d'env OpenAI + Higgsfield), BUG-002 (vidéo live cassée — Higgsfield async non implémenté), BUG-003 (publication programmée jamais exécutée — scheduler non câblé + staging self-hosted), BUG-004 (voix-off / montage inatteignables — bifurcation A/B).

---

## 3. Arbitrage entre les 3 angles d'esquisse

Trois esquisses indépendantes ont été produites et pondérées :

| Angle | Force | Faiblesse | Ce qu'on en retient |
|---|---|---|---|
| **Architecture-first** | Pose la frontière A/B *avant* de réparer les providers → chaque correctif provider est fait **une seule fois, dans A** ; mutualise l'infra de jobs async (polling Higgsfield + scheduler). | Retarde les blockers visibles derrière un refactor non démo-able ; risque concentré sur la refonte de `GenerationResult`/`buildResult` ; sérialise le chemin critique. | **Le COMMENT de la convergence** (contrat moteur unique, pont bidirectionnel, infra de jobs partagée), et la règle « ne pas réparer dans le moteur condamné ». |
| **Risque-first** | Ordonne par **décroissance du risque résiduel** : la vérité d'abord (sans elle on répare à l'aveugle), puis neutraliser le seul risque **irréversible** (doubles publications IG clients) *avant* d'activer le scheduler. | Gratification tardive ; ferme BUG-003 plus lentement (inertie assumée comme protection). | **Le P0 non négociable** (vérité + parité) et le **garde-fou dur** : garde-fous anti-doublon AVANT activation live du scheduler. |
| **Valeur-first** | Maximise le **time-to-first-operator-value** : exploite le quick-win T-005 (la clé OpenAI est déjà dans le process) pour livrer image+texte live tôt et financer la confiance. | La capacité différenciante (voix-off/montage) et la convergence arrivent en dernier. | **Le quick-win T-005 livré tôt** comme victoire visible dès P0, et la migration B→A **incrémentale** (capacité par capacité, jamais big-bang). |

**Pondération retenue.** La cible architecture étant **fixée (converger vers A)**, l'angle *architecture-first* gouverne la **forme** (où l'on répare : dans A, derrière une frontière unique). Mais il est **subordonné** au *risque-first* sur l'**ordre** : la vérité est P0 absolu, et le garde-fou anti-incident est un **gate dur**, non un conseil. Le *valeur-first* fournit la **respiration** : le quick-win OpenAI (T-005) est tiré dans P0 pour livrer une victoire prouvable tôt, et la convergence se fait **incrémentalement** (réversible, derrière le harnais de parité) plutôt qu'en big-bang. En une phrase : **architecture-first pour le COMMENT, risque-first pour l'ORDRE, valeur-first pour le RYTHME.**

---

## 4. Séquencement macro retenu (lots P0..P5)

> Principe directeur transverse : **vérité = comportement réel vérifié en MOCK ET LIVE (parité)**. Toute Definition of Done inclut la preuve mock **et** live. Un « test au vert » est insuffisant. (Cf. `guiding-principles.md`.)

### P0 — Rétablir la vérité + parité mock/live  *(NON NÉGOCIABLE — pré-condition de tout le reste)*
Sans instrument de mesure honnête, aucune correction n'est vérifiable, et « réparer » un blocker peut régresser en silence.
- **Gate honnête & socle de mesure** : T-001 (CI échoue sur l'exit code), T-002 (fuite fake-timer + drain global), T-003 (verdir les 2 E2E opérateur). → BUG-010/027/032/023/029/042/055/064.
- **Harnais de parité réseau** : T-006 (MSW global `onUnhandledRequest:'error'` + contract-tests fidèles OpenAI / Higgsfield async / Postiz), T-010 (smoke opérateur assertant l'effet backend, mock ET live). → BUG-011/018/037/041/045/046/047 ; MISS-008/009.
- **Convergence credential (1er acte) + quick-win** : T-005 (`resolveProviderCredential()` unique consommé par A, B, picker) — **débloque OpenAI image+texte live gratuitement, la clé est déjà dans le process**. → BUG-001(part OpenAI)/005/006/007 ; MISS-003/007/013.
- **Sécurité avant tout déclenchement live** : T-020 (`/postiz-draft` legacy), T-021 (`/_media` auth). → BUG-040 ; MISS-010.

> **Sortie P0 :** un test rouge prouve un vrai défaut, un test vert prouve un vrai comportement ; A, B et le picker lisent la **même** clé ; OpenAI live exerçable. *Victoire visible précoce : image+texte live (T-005).*

### P1 — Frontière du moteur unique + les 4 blockers (prouvés mock ET live)
On répare **dans A**, derrière le contrat de service, pour ne pas investir dans le moteur condamné.
- **Contrat moteur (prérequis structurel)** : T-104 — remonter `composition/exports/thumbnails` dans `buildResult` (sans cela tout pont lit `undefined`) ; pont bidirectionnel idempotent. → BUG-004/033/034 ; MISS-005.
- **Providers derrière la frontière** : T-101 (image OpenAI live, conséquence de T-005), T-102 + T-103 (Higgsfield **async submit+poll** conforme, polling sorti du handler HTTP). → BUG-001/002/008/009/025/028 ; MISS-009/019/022.
- **Publication — garde-fou puis branchement** : T-204 (idempotence indépendante de `scheduledAt`, dédup), T-301 (sync `content_post ↔ social_publish_job`) **AVANT** T-103b (brancher le scheduler sur `/api/cron/tick` self-hosted, *pas* `vercel.json`). → BUG-003/038 ; MISS-006/028.

> **Sortie P1 :** image / vidéo / texte live prouvés par l'opérateur via le moteur unique ; publication programmée s'exécute **sans risque de double-post**.

### P2 — Criticals d'honnêteté + amorce de convergence B→A
- T-201 (texte réellement LLM, fin du fallback figé), T-202 (picker honnête : badge « Live » ⇔ même résolution que le moteur), T-203 (enum `tone` aligné, débloque la génération). → BUG-005/006/007/014/016/019/020/024/043 ; MISS-001/002/012/015/016/018.
- Amorce : B délègue à A pour le **texte** (premier pas concret de convergence — BUG-015/026).

### P3 — Robustesse publication & génération
- T-302 (retry borné), T-303 (compte Postiz explicite — jamais deviner), T-304 (fallbacks audibles, push `state.errors`), T-305 (variation réelle), T-308 (dry_run honnête), T-309 (re-génération propre). → BUG-017/022/039/045/049/050/051/065 ; MISS-011/020/021/029.

### P4 — Compose réel + montage atteignable (la promesse riche de A)
- T-306 + T-411 (isolation stockage, `MEDIA_DIR` absolu, purge des 977 stubs) **avant** la mise en worker. T-307 + T-403 (ffmpeg/sharp réels, mux audio + sous-titres, assertion `ffprobe`). T-401/402 (persistance complète des assets composés). → BUG-031/035/036 ; MISS-004/024/025/026/027/032.

### P5 — Convergence structurelle finale + dette / minors / info
- T-901 (B délègue à A pour toutes les capacités — bascule par flag, réversible), T-902 (regroupe les minors/info non porteurs de vérité/sécurité). T-410 (invalidation caches), T-412 (taxonomies), T-413 (toggle de mode), T-414 (`formatError`), T-415 (garde `kind=video`). → reste des majors/minors/info ; MISS-030/031/033/034.

**Chemin critique condensé :**
`T-001/002/003 → T-005 → (T-006/T-010) [P0]` → `T-104 → T-101 / T-102+T-103 ; T-204+T-301 → T-103b [P1]` → `T-201/202/203 [P2]` → `T-302/303/304/305/308 [P3]` → `T-306/411 → T-307/403 [P4]` → `T-901 [P5]`.

---

## 5. Les 3 arbitrages clés (à retenir)

1. **Vérité avant features (risque-first).** P0 (gate honnête + parité MSW + credential unifié) précède **tout** correctif fonctionnel. On accepte de ne « réparer » aucune feature visible au jour 1 — sauf le quick-win OpenAI (T-005) tiré en P0 — en échange de la **vérifiabilité** de tout l'aval.
2. **Réparer dans A, une seule fois (architecture-first).** On pose le contrat du moteur unique (T-104) **avant** les correctifs providers (image/vidéo/texte) pour ne pas les payer deux fois dans le moteur B condamné. La convergence B→A est **incrémentale et réversible** (flag), pas un big-bang (valeur-first).
3. **Garde-fou anti-incident, non négociable.** Les anti-doublons (T-204 idempotence + T-301 sync d'état) sont un **gate dur** avant l'activation live du scheduler (T-103b). Brancher BUG-003 sans eux transformerait un blocker inerte en **doubles publications / publication d'un post annulé** sur de vrais comptes Instagram clients — le seul risque **irréversible** du projet.

---

## 6. Documents de référence

- Cible détaillée : `plan/00_overview/target-architecture.md` + `target-architecture.puml`
- Principes : `plan/00_overview/guiding-principles.md`
- Routage 102 points : `plan/01_coverage/_routing.json`
- Baseline audit : `docs/audit-generation-publication-2026-05-29/01_audit/`, `.../06_action-plan/action-plan.md` (T-001→T-902), `.../decisions/adr-0001..0007`
