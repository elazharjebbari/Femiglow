# Plan de développement — Phasage P0..P5

> Source : `00_overview/executive-summary.md` + `02_workstreams/*/tasks.csv`.
> Cible : ADR-0007 Option 1 (converger vers A, LangGraph moteur unique).
> Principe transverse : **vérité = comportement vérifié en MOCK ET LIVE (parité)**. Toute DoD inclut la preuve mock **et** live ; un test vert ne suffit pas.
> Règle d'or : **P0 vérité + parité précède tout** ; **le scheduler live (ACT-BE-021) est gardé par idempotence (ACT-BE-022) + sync d'état (ACT-DA-004)**.

> Les alias logiques initiaux (`ACT-ARC-MSW`, `ACT-ARC-RESOLVE-CRED`, `ACT-ARC-BRIDGE`, `ACT-DATA-SYNC-JOB`) ont été **résolus en ids canoniques** dans les `dependances` des CSV (respectivement `ACT-ARC-004`, `ACT-ARC-013`, `ACT-ARC-002`, `ACT-DA-004`) lors de la remédiation post-revue adversariale. Toutes les dépendances pointent désormais vers des `id_action` existants (vérifié).

---

## P0 — Rétablir la vérité + parité mock/live  *(NON NÉGOCIABLE — pré-condition de tout)*

Sans instrument de mesure honnête, aucune correction n'est vérifiable et un blocker peut régresser en silence. On tire aussi le quick-win OpenAI (la clé est déjà dans le process) pour une victoire visible précoce.

**Actions incluses**
- `ACT-ARC-004` — Architecture de test honnête : MSW global `onUnhandledRequest:'error'` + gate CI sur exit-code (M)
- `ACT-BE-001` — Fermer la fuite fake-timer + drain global (S)
- `ACT-DA-008` — Invariant : la vérité d'un run de tests = son exit code (S)
- `ACT-DA-001` — Cibler la table réelle `audit_events` (source = schéma Drizzle) (S)
- `ACT-DA-002` — Brancher les E2E DB sur une base au schéma Drizzle (S)
- `ACT-DS-001` — Contrat distinction image/vidéo + correctif des 2 E2E opérateur (S)
- `ACT-DS-002` — Garde anti-régression du contrat image/vidéo (S)
- `ACT-ARC-005` — Contract-tests fournisseurs fidèles + détecteur de divergence (L)
- `ACT-ARC-013` — Résolution credential unifiée `resolveProviderCredential()` (M)
- `ACT-BE-010` — Débloquer OpenAI image+texte live via la résolution unifiée (M)
- `ACT-ARC-008` — Alignement picker↔générateur : badges Live honnêtes (M)
- `ACT-BE-020` — Neutraliser le legacy `/postiz-draft` (sécurité) (S)

**Jalon M0 — Vérité & parité établies.**
**Gate G0 (dur) → P1** : `pnpm vitest run` rouge ⇔ vrai défaut (test négatif unhandled-request prouvé), exit-code = vérité ; les 2 E2E opérateur verts ; A/B/picker lisent la **même** clé via `resolveProviderCredential` ; image+texte OpenAI **live** exerçables par l'opérateur ; legacy `/postiz-draft` neutralisé. Aucun fix fonctionnel aval n'est mergé tant que G0 n'est pas franchi.

---

## P1 — Frontière du moteur unique + les 4 blockers (prouvés mock ET live)

On répare **dans A**, derrière le contrat de service, pour ne pas investir dans le moteur condamné. La publication n'est branchée live **qu'après** ses garde-fous.

**Actions incluses**
- `ACT-ARC-001` — Contrat `GenerationResult` complet (composition/exports/thumbnails) + contrat d'erreur honnête (M)
- `ACT-ARC-002` — Pont bidirectionnel idempotent : persistance des assets (M)
- `ACT-DA-006` — Registre de modèles routables + contrat de résolution (M)
- `ACT-ARC-009` — Stockage média unifié & déterministe : `getStorage()` + `MEDIA_DIR` absolu (M)
- `ACT-ARC-006` — File de jobs async unique (worker resumable, idempotence + locking, retry borné) (L)
- `ACT-ARC-007` — Higgsfield async submit+poll + routage par capability (L)
- `ACT-BE-011` — Génération image Higgsfield en async submit+poll (M)
- `ACT-BE-012` — Génération vidéo Higgsfield en async submit+poll (L)
- `ACT-DA-003` — Clé d'idempotence de publication indépendante de `scheduledAt` (M)
- `ACT-BE-022` — Idempotence de publication (garde-fou dur) (M)
- `ACT-DA-004` — Cohérence d'état `content_post ↔ social_publish_job` (M)
- `ACT-BE-021` — Brancher le scheduler sur `/api/cron/tick` self-hosted — **GARDÉ** (M)
- `ACT-FE-006` — Sélection explicite/obligatoire du compte Postiz (garde-fou anti-mauvais-compte, **prérequis dur** de l'activation live du scheduler) (M)

**Jalon M1 — Moteur unique câblé ; 4 blockers fermés.**
**Gate G1 (dur) → P2** : image / vidéo / texte **live** prouvés par l'opérateur via le moteur unique (run + asset servi 200) ; `buildResult` expose composition/exports/thumbnails (plus de `undefined` côté pont) ; **ACT-BE-022 + ACT-DA-003 + ACT-DA-004 livrés et verts ET compte cible déterministe via ACT-FE-006 AVANT activation live d'ACT-BE-021** ; publication programmée s'exécute sans risque de double-post, de publication d'un post annulé/reprogrammé, ni de publication sur le mauvais compte IG client.

> Note : BUG-004 (voix-off/montage inatteignables) est un blocker à **chaîne longue** — sa fermeture réelle (production audio + exposition opérateur) est atteinte au **jalon M4 (P4)**, pas en P1. Les actions liées (`ACT-BE-004/030/031`, `ACT-FE-005`, `ACT-DS-005`, `ACT-ARC-001`) sont tracées à BUG-004 dans `audit-to-action.csv`.

---

## P2 — Criticals d'honnêteté + amorce de convergence B→A

**Actions incluses**
- `ACT-BE-013` — Texte opérateur réellement LLM + role inféré (fin du fallback figé) (M)
- `ACT-BE-017` — Aligner l'enum `tone` (débloque la génération) (S)
- `ACT-ARC-003` — Façade `invokeEngine` : frontière B→A unique, inactive par défaut (L)
- `ACT-UX-001` — Picker honnête : badge Live ⟺ générabilité réelle (M)
- `ACT-UX-002` — Catalogue vidéo aligné sur l'exécution (M)
- `ACT-UX-003` — Supprimer la pré-sélection d'un modèle non-fonctionnel (M)
- `ACT-UX-004` — Persister et honorer le modèle choisi (trace fidèle) (S)
- `ACT-FE-002` — Helper unique de lecture/écriture du mode de génération (S)
- `ACT-FE-001` — Propager `cs_generation_mode` à la génération texte ; provider reçu, jamais deviné (M)

**Jalon M2 — Honnêteté du parcours create ; façade B→A amorcée (texte).**
**Gate G2 → P3** : aucun badge « Live » sur un modèle non générable ; texte = vrai LLM ; modèle choisi = modèle tracé ; `invokeEngine` existe (inactive par défaut) et le texte transite par A en mock.

---

## P3 — Robustesse publication & génération

**Actions incluses**
- `ACT-BE-016` — Re-génération idée `generated` : erreur 409 propre (S)
- `ACT-BE-014` — Variation de draft : régénérer réellement le texte (S)
- `ACT-BE-015` — Fallbacks audibles : pousser dans `state.errors` (M)
- `ACT-BE-023` — `dry_run` honnête + capabilities recalculées (M)
- `ACT-FE-008` — Erreurs typées `HttpError` → messages UI lisibles (M)
- `ACT-UX-005` — Source unique mock/live : toggle = badge = défaut (S)
- `ACT-UX-006` — Fin du toggle fantôme texte + scope cookie cohérent (S)
- `ACT-UX-007` — Message d'échec actionnable (S)
- `ACT-DS-003` — Contraste WCAG AA des tokens + lint a11y (M)
- `ACT-DA-005` — Tracer le modèle intentionnel vs exécuté (S)

**Jalon M3 — Pipeline robuste, erreurs honnêtes, compte cible explicite.**
**Gate G3 → P4** : retry borné prouvé ; dry_run reflète l'adapter ; compte Postiz jamais deviné ; échecs remontés et lisibles.

---

## P4 — Compose réel + montage atteignable (la promesse riche de A)

L'isolation du stockage précède toute mise en worker.

**Actions incluses**
- `ACT-BE-002` — `MEDIA_DIR` absolu + isolation stockage tests + purge des 977 stubs (M)
- `ACT-DA-007` — Isolation stockage média (tmpdir/DB test) + cycle de vie caches (M)
- `ACT-BE-030` — Providers voix-off/musique réels, gatés explicitement (M)
- `ACT-BE-031` — Compose réel : mux + incrustation sous-titres + normalisation (L)
- `ACT-BE-034` — Robustesse uploads média : erreurs propres + limites pixels (M)
- `ACT-FE-004` — Brancher MediaStudio sur le moteur A via `invokeEngine` (L)
- `ACT-FE-005` — Exposer voix-off/musique/sous-titres/montage à l'opérateur (L)
- `ACT-FE-003` — Remontée métadonnées média (durée/dimensions) (M)
- `ACT-FE-009` — Réconciliation état optimiste StudioContext vs serveur (M)
- `ACT-DS-004` — Aperçu fidèle au rendu réseau + état d'erreur visuel (M)
- `ACT-DS-005` — Slots UI pour livrables avancés de A (M)
- `ACT-UX-008` — Aperçu pleine résolution (S)

**Jalon M4 — Voix-off / montage / export atteignables par l'opérateur, prouvés (`ffprobe`).**
**Gate G4 → P5** : compose/transcode réels (assertion `ffprobe` mux audio+sous-titres) ; assets composés persistés et servis ; aucune row/fichier de test hors tmpdir.

---

## P5 — Convergence structurelle finale + dette / minors / info

**Actions incluses**
- `ACT-ARC-012` — Gate de bascule par smoke opérateur (mock+live), bloquant CI (M)
- `ACT-ARC-010` — Bascule incrémentale par flag + retrait de la duplication B (M)
- `ACT-ARC-011` — Taxonomies unifiées + registre honnête (M)
- `ACT-BE-003` — Config moteur & caches de clés invalidables (M)
- `ACT-BE-004` — Re-vérifier pipeline mock sous PM2 + pinning `ffmpeg-static` (M)
- `ACT-BE-024` — Contrôle d'accès admin sur les médias générés `/_media` (anti-fuite assets clients) (M)
- `ACT-BE-032` — transcode-export : respecter codec/maxFileSizeMb (M)
- `ACT-BE-033` — Garde `kind=video` sur formats non-vidéo (S)
- `ACT-BE-035` — Centraliser le pricing image dans le registry (S)
- `ACT-FE-007` — Recadrage avec rotation correct (M)
- `ACT-DS-006` — Primitives atomiques de tokens (L)

**Jalon M5 — Convergence vers A finalisée (flag basculé), duplication B retirée, dette résorbée.**
**Gate G5 (sortie programme)** : smoke opérateur mock+live vert et bloquant en CI ; B délègue toutes capacités à A (réversible par flag) ; minors/info clos.

---

## Chemin critique

`ACT-ARC-004 → ACT-ARC-013 → ACT-BE-010 [P0]`
→ `ACT-ARC-001 → ACT-ARC-002 ; ACT-ARC-009 → ACT-ARC-006 → ACT-ARC-007 → ACT-BE-011 → ACT-BE-012 ; ACT-BE-022 + ACT-DA-004 → ACT-BE-021 [P1]`
→ `ACT-BE-013 → ACT-ARC-003 [P2]`
→ `ACT-BE-015 ; ACT-BE-023 [P3]`
→ `ACT-BE-002/ACT-DA-007 → ACT-BE-031 ; ACT-FE-004 → ACT-FE-005 [P4]`
→ `ACT-ARC-012 → ACT-ARC-010 [P5]`.
