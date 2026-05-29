# Rapport de couverture adversarial — plan d'action vs audit (baseline 2026-05-29)

> Vérification indépendante et sceptique. La couverture **mécanique** (102/102 findings → ≥1 action, `uncovered: []`) est confirmée et n'est pas le sujet. Ce rapport cherche la couverture **superficielle, fausse ou dangereuse**, les ruptures de chaîne sur les blockers, l'état du garde-fou scheduler, les scénarios de parité manquants et les incohérences structurelles.

Sources confrontées : `audit-to-action.csv`, `_actions_index.json`, `02_workstreams/*/tasks.csv`, `05_dev-plan/{estimations.csv,phasing.md,milestones.csv,dependencies.puml}`, `06_acceptance/acceptance-criteria.csv` ; baseline `_consolidated.json` (68 BUG + 34 MISS + 1 réfuté ; sev BUG : 4 blocker / 8 critical / 35 major / 18 minor / 3 info), `bug-register.csv`, `mock-live-parity.csv`, findings BUG-001..004.

## Synthèse

- **Solidité globale : bonne.** Les 67 actions ont des DoD qui citent explicitement mock ET live ; la grande majorité ont une vérif concrète (probe HTTP/SQL/ffprobe, contract-test, exit-code, comptage anti-doublon). La discipline « parcours opérateur asserte un effet backend, pas un rendu » est portée (ACT-ARC-004/012).
- **Mais** : 1 blocker à **couverture superficielle** (BUG-004), 1 risque **garde-fou** secondaire (compte de publication), des **dépendances vers des id_action inexistants** (alias symboliques), des **collisions de numérotation ADR**, une **action orpheline du planning** (ACT-BE-024), et **2 scénarios de parité non reflétés** en acceptation.

### Nombre de problèmes par gravité

| Gravité | Nombre |
|---|---|
| Élevé (blocker/incident client) | 3 |
| Moyen | 5 |
| Faible (hygiène/traçabilité) | 4 |

### Les 5 problèmes les plus graves

1. **[ÉLEVÉ] BUG-004 (blocker) — couverture superficielle.** Mappé à `ACT-ARC-001` (DTO) + `ACT-DS-005` (slots UI) uniquement : ces deux actions traitent l'**exposition** de l'audio à l'opérateur, pas sa **production**. Or l'état vérifié dit que le blocage proximal est « voix-off-1/4 » : en MOCK l'audio voiceover/music **n'est pas réellement produit** (asset vide). La production réelle est dans `ACT-BE-004` (re-vérif pipeline PM2 + épingler ffmpeg-static) et `ACT-BE-030` (gating TTS réel) — **P4/P5 et NON reliés à BUG-004**. Après ACT-ARC-001 (P1) le blocker paraîtra résolu alors qu'aucun son ne sortira.
2. **[ÉLEVÉ] Garde-fou scheduler — dépendance exprimée vers un id_action inexistant.** `ACT-BE-021.dependances = "ACT-BE-022;ACT-DATA-SYNC-JOB"` : `ACT-DATA-SYNC-JOB` **n'existe pas** comme id_action (la vraie cible est `ACT-DA-004`). L'intention est correcte (le `dependencies.puml` câble `BE022 --> BE021` et `DA004 --> BE021`) mais tout outillage consommant `tasks.csv`/`_actions_index.json` voit une dépendance pendante non résolue. Risque : ordonnancement automatique qui ignore le gate de sync d'état.
3. **[ÉLEVÉ] Garde-fou publication secondaire absent du gate scheduler.** Le scheduler (ACT-BE-021, P1) est gardé par idempotence + sync d'état, mais **PAS** par `ACT-FE-006` (sélection explicite du compte Postiz, BUG-039, **P3**). Si le scheduler passe live avant ACT-FE-006, un job programmé peut publier sur le **mauvais compte IG client** via `resolveDefaultAccount` (« premier compte actif »). Le gate dur ne couvre que le double-post, pas le mauvais-compte.
4. **[MOYEN] ACT-BE-024 orpheline du planning.** Présente dans tasks.csv / index / acceptance / estimations, mais **absente de `phasing.md` ET `milestones.csv`** (66 actions phasées vs 67). C'est l'unique couverture de **MISS-010** (assets `/_media` générés — sous-titres, composés, exports — servis **sans authentification**, contenu client non publié). Action sans phase = jamais planifiée.
5. **[MOYEN] BUG-022 (idempotence applicative) déconnectée de l'index unique DB.** `ACT-BE-022` (dédup applicatif, GARDE-FOU DUR) a `dependances` **vide** et n'est pas relié à `ACT-DA-003` (clé d'idempotence stable + **index unique partiel** `WHERE status IN (queued,publishing)`). Dans le puml, DA-003 n'a aucune arête vers BE-022 ni BE-021. Le scheduler peut donc être activé sur la seule dédup applicative, sans le backstop structurel en base.

### Statut du garde-fou scheduler

**PARTIELLEMENT SATISFAIT, à corriger avant toute activation live.**
- ✅ Intention correcte : DoD de ACT-BE-021 dit « ACTIVATION LIVE GARDÉE par ACT-BE-022 + sync d'état (BUG-038) » ; `acceptance-criteria.csv` met ACT-BE-021 `statut_live = bloque_gate` ; le `dependencies.puml` câble `BE022 --> BE021` et `DA004 --> BE021` (nœuds en rouge).
- ⚠️ Faille 1 : dépendance machine vers id inexistant `ACT-DATA-SYNC-JOB` (cf. #2).
- ⚠️ Faille 2 : l'index unique DB (`ACT-DA-003`) n'est pas dans la chaîne de gate (cf. #5).
- ⚠️ Faille 3 : le mauvais-compte (`ACT-FE-006`/BUG-039) n'est pas un prérequis du gate (cf. #3).

---

## Points à risque / traités superficiellement

| Gravité | id_action / zone | Problème | Finding lié | Recommandation |
|---|---|---|---|---|
| Élevé | ACT-ARC-001 + ACT-DS-005 (BUG-004) | Couvrent l'exposition (DTO+UI) mais pas la production audio mock (asset vide, voix-off-1/4) ; les actions de production (ACT-BE-004, ACT-BE-030) sont P4/P5 et non reliées au blocker | BUG-004 (blocker), BUG-012/013, MISS-011 | Rattacher BUG-004 à ACT-BE-004 + ACT-BE-030 ; remonter ces deux actions en priorité du chemin blocker, OU acter que BUG-004 reste blocker tant qu'aucun audio réel n'est produit en mock |
| Élevé | ACT-BE-021 (dép.) | `dependances` cite `ACT-DATA-SYNC-JOB` (id inexistant ; cible réelle = ACT-DA-004) | BUG-003 (blocker), BUG-038 | Remplacer l'alias par `ACT-DA-004` dans tasks.csv et `_actions_index.json` |
| Élevé | ACT-FE-006 hors gate | Sélection compte Postiz (P3) non prérequise à l'activation scheduler (P1) → risque mauvais compte client en live | BUG-039 (major) | Ajouter ACT-FE-006 comme garde dur de l'activation live de ACT-BE-021 (ou interdire publish-now/schedule live sans accountId explicite) |
| Moyen | ACT-BE-024 | Absente de phasing.md et milestones.csv (jamais planifiée) ; unique couverture de l'accès anonyme à `/_media` | MISS-010 (major) | Ajouter ACT-BE-024 à une phase + un milestone |
| Moyen | ACT-BE-022 ↔ ACT-DA-003 | Idempotence applicative (BE-022) déconnectée de l'index unique partiel (DA-003) ; gate possible sans backstop DB | MISS-006, MISS-028, BUG-003 | Faire dépendre ACT-BE-022 (ou ACT-BE-021) de ACT-DA-003 ; câbler DA-003 → BE-021 dans le puml |
| Moyen | ACT-BE-002 / ACT-ARC-009 (dép.) | Dépendances symboliques `ACT-ARC-RESOLVE-CRED` (×8), `ACT-ARC-MSW` (×3), `ACT-ARC-BRIDGE` (×3) jamais résolues dans les CSV (seul le puml a une légende) | transverse | Remplacer les alias par les vrais id (RESOLVE-CRED=ARC-013, MSW=ARC-004, BRIDGE=ARC-002/003) |
| Moyen | ACT-BE-021 / scheduler | Le `t_ref` T-103b et le gate reposent sur ACT-ARC-006 (file de jobs), mais ACT-BE-021 ne déclare pas ARC-006 en dépendance (deux infrastructures scheduler possibles : tick fan-out vs file mutualisée) | BUG-003, BUG-037 | Clarifier laquelle des deux est la cible et lier explicitement |
| Faible | ACT-BE-035 (parité) | Mappé au scénario parité « Traçabilité du modèle choisi » qui est en réalité le sujet de ACT-DA-005 (intended_model) ; ACT-BE-035 ne traite que le pricing | BUG-056 vs BUG-057 | Vérifier que le lien parité de ACT-BE-035 pointe bien vers le pricing, pas la traçabilité |
| Faible | ACT-DS-003/006 (BUG-007/021) | BUG-007 (critical, badges Live mensongers) et BUG-021 (major) ont leur cœur traité par ACT-UX-001/005 et ACT-ARC-008 ; ACT-DS-003/006 (WCAG, primitives) sont du cosmétique annexe — OK mais ne pas confondre avec le correctif de fond | BUG-007, BUG-021 | RAS (cœur couvert ailleurs) ; ne pas considérer DS-003/006 comme suffisants seuls |
| Faible | MISS-004/MISS-024/MISS-032 → ACT-BE-002 (P5) | MISS rattachés à une action MEDIA_DIR/purge de stubs de priorité très basse, alors qu'ils touchent au stockage déterministe ; pas un traitement « propre » dédié | MISS-004/024/032 | Acceptable, mais surveiller que la baisse de priorité ne fasse pas glisser ces MISS hors scope |
| Faible | ADR | Collisions de numérotation (voir section dédiée) | — | Renuméroter |

---

## Chaîne des blockers (vérif)

| Blocker | Cause → Correctif → Vérif mock+live | Verdict |
|---|---|---|
| **BUG-001** (image live) | Cause: clé OpenAI non lue + Higgsfield mono-partie + endpoints sync faux. Correctif: `ACT-ARC-013` (resolveProviderCredential, dép ARC-004) → `ACT-BE-010` (OpenAI, dép ARC-013+BE-001) + `ACT-BE-011` (HF async, dép ARC-013+ARC-004). Vérif: DoD mock (asset déterministe) + live (asset 200, generation_run provider=openai cost>0). | **Cohérente** (alias de dép à corriger : RESOLVE-CRED/MSW) |
| **BUG-002** (vidéo live) | Cause: credential HF incomplet + endpoints sync. Correctif: `ACT-BE-012` (HF vidéo async submit+poll, sort le polling du handler, dép BE-011+ARC-004). Vérif: contract-test rouge si endpoint sync + probe live `bloque_credential`. | **Cohérente** ; live honnêtement marqué `bloque_credential` |
| **BUG-003** (scheduler) | Cause: runScheduledPublishJobs branché à aucun cron. Correctif: `ACT-BE-021` (brancher sur tick) **gardé par** `ACT-BE-022` (idempotence) + sync d'état. Vérif: mock T+2min queued→published + heartbeat ; live `bloque_gate`. | **Cohérente mais 3 failles** : dép vers id inexistant (ACT-DATA-SYNC-JOB), DA-003 hors chaîne, ACT-FE-006 hors gate (cf. ci-dessus) |
| **BUG-004** (audio/compose inatteignable) | Cause **double**: (a) DTO amputé, (b) audio mock non produit. Correctif mappé: `ACT-ARC-001` + `ACT-DS-005` → ne couvre que (a). (b) repose sur `ACT-BE-004`/`ACT-BE-030` **non reliés**. | **RUPTURE** : la moitié « production audio » du blocker n'est pas dans sa chaîne de couverture |

---

## Parité mock/live (scénarios manquants)

34 scénarios dans `mock-live-parity.csv` ; cross-référencés avec la colonne `scenario_parite_lie` de `acceptance-criteria.csv` (par recouvrement de tokens, accents normalisés). **32/34 reflétés. 2 manquants :**

| Scénario parité non reflété | Domaine | Conséquence |
|---|---|---|
| **Lister/synchroniser les comptes Postiz (read)** | publication-postiz | C'est le **seul** morceau live Postiz prouvé (GET /integrations 200, 4 comptes IG réels). Aucun critère d'acceptation n'asserte la non-régression du contrat de lecture. À ajouter (ACT-BE-023 ou ACT-FE-006 sont les hôtes naturels). |
| **Découpe vidéo opérateur (upload-and-trim)** | montage-composition | ACT-BE-034 ne cite que « Recadrage » (upload-and-crop) ; le trim (qui marche réellement aujourd'hui) n'a aucun critère explicite → risque de régression non détectée. Ajouter upload-and-trim au DoD de ACT-BE-034. |

> Note : l'autre scénario « Génération de texte via l'AI-Engine LangGraph » (copywriting) est couvert indirectement par ACT-BE-013/ACT-ARC-003 mais sans critère dédié distinguant le chemin AI-Engine (live-fonctionnel) du chemin opérateur (fallback) — à surveiller.

---

## Incohérences à corriger

1. **Dépendances vers id_action inexistants** (machine-illisibles ; seul `dependencies.puml` a une légende) :
   - `ACT-ARC-RESOLVE-CRED` (×8) → `ACT-ARC-013`
   - `ACT-ARC-MSW` (×3) → `ACT-ARC-004`
   - `ACT-ARC-BRIDGE` (×3) → `ACT-ARC-002/003`
   - `ACT-DATA-SYNC-JOB` (×2, dont le gate scheduler) → `ACT-DA-004`
   → Normaliser dans `tasks.csv` et `_actions_index.json`.
2. **Collisions de numérotation ADR** entre workstreams (sujets différents) :
   - `adr-0008` ×3 : architecture (façade invokeEngine) / backend (gating providers média) / data (clé idempotence)
   - `adr-0009` ×3 : architecture (file jobs) / backend (idempotence indép. scheduledAt) / data (cohérence état)
   - `adr-0010` ×3 : architecture (contrat GenerationResult) / backend (MEDIA_DIR absolu) / data (vérité schéma test)
   - `adr-0011` ×2 : architecture (bascule flag) / data (registre modèles)
   - `adr-0012` ×2 : frontend (affichage honnête) / ui-ux (picker honnête)
   → Adopter un espace de numérotation global unique (ou préfixer par workstream) ; les `tasks.csv` référencent « ADR-0008 », « ADR-0011 » de façon ambiguë.
3. **Divergence dev-plan : 66 vs 67 actions.** `phasing.md` (66 distinctes) et `milestones.csv` (66) **omettent `ACT-BE-024`** (présent partout ailleurs). Action de sécurité (MISS-010, accès anonyme `/_media`) non planifiée. → Ajouter ACT-BE-024 à une phase + un milestone.
4. **ACT-BE-021 ↔ ACT-ARC-006** : deux conceptions du scheduler coexistent (tick fan-out vs file de jobs mutualisée ACT-ARC-006). ACT-BE-021 ne déclare pas ARC-006 en dépendance. → Trancher et lier.
5. **ACT-BE-022 sans dépendance vers ACT-DA-003** : la logique d'idempotence (BE) ne dépend pas de la migration d'index unique (DA) censée l'enforcer structurellement.

---

*Rapport adversarial — ne corrige rien, signale uniquement. Aucune action de couverture binaire remise en cause ; les écarts portent sur la profondeur, l'ordonnancement, les garde-fous et la cohérence des références.*
