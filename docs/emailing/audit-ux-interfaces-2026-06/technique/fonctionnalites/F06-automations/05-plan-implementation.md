# F06 — Automations — plan d'implémentation

> Découpage en 3 vagues **lecture → actions → wizard**. Doctrine TDD : pour
> chaque vague, **les tests d'abord** (rouge), puis le code (vert). Migrations
> additives uniquement (`02-modele-donnees.md §F06`), livrées AVANT le code
> lecteur. Pas de blue-green : build + restart (~2 s), pas d'E2E contre la prod.
>
> **Risque-pivot du chantier** : un dry-run qui enverrait du réel en mode
> `simulate` = **incident d'envoi**. Sa garantie est testée AVANT toute ligne de
> code dry-run (cf. P4.2, gate bloquante).

---

## Pré-vague — migrations data (M0)

Livrées et appliquées sur `femiglow_test` + `femiglow_emailqa` AVANT tout code :

```sql
ALTER TABLE email_automation     ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;
ALTER TABLE email_automation_run ADD COLUMN IF NOT EXISTS is_dry_run  boolean NOT NULL DEFAULT false;
-- _trace : porté par contextJson (JSONB existant), AUCUNE migration.
CREATE INDEX CONCURRENTLY IF NOT EXISTS email_automation_deleted_idx
  ON email_automation (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS email_automation_run_dry_idx
  ON email_automation_run (automation_id, triggered_at) WHERE NOT is_dry_run;
```

**Tests M0** : `schema-drift` (introspection DB vs schema.ts) vert sur les deux
bases ; smoke `SELECT deleted_at, is_dry_run` ; les colonnes inertes ne changent
RIEN au comportement existant (suite emails globale toujours verte).

---

## Vague P4.1 — LECTURE (FlowView + timeline instrumentée)

Apporte la visibilité sans rien modifier au comportement du moteur ni aux
actions. C'est la vague la plus sûre, on la pose en premier.

**Tests d'abord** :
- unitaires parcours d'arbre FlowView (`F06-U-001..007`) : linéaire, 1 branche,
  imbriqué 3 niveaux, branche vide, ordre par rang ;
- schéma `TraceEntry` (`F06-U-010..015`) y compris le **cap de taille 500** ;
- composant FlowView + timeline (`F06-C-001..028`) ;
- intégration : **le runner écrit `_trace`** sur un run réel, deferred/skipped/
  sweep tracés (`F06-I-010..014`).

**Code** :
1. `lib/mail/automation/trace.ts` : schéma + helper `appendTrace(ctx, entry)` avec
   **cap 500** (tronque les plus anciennes, garde un compteur d'élision) — protège
   `contextJson` du gonflement.
2. Instrumenter le **runner** : poser une entrée à chaque
   `advance/defer/skipSend/wait/wait_for_event/catch` ; le sweep tague
   `meta.sweep=true`. **Aucune modification de la logique de dispatch** — on
   ajoute des écritures de trace à côté des updates existants.
3. `FlowView.tsx` (read-only) + `RunTimeline.tsx` (avec **fallback legacy** si
   `_trace` vide) ; brancher FlowView dans le détail de run et l'étape Revue.

**Risques MAJEURS** :
- **`_trace` gonfle `contextJson`** → cap 500 + élision, testé `F06-U-014`,
  `F06-I-014` ; revue du poids JSONB sur un run long.
- **régression sur les runs anciens** (sans `_trace`) → fallback legacy testé
  `F06-C-021` ; bandeau « run antérieur ».
- **instrumentation qui change un timing/état du runner** → la suite existante du
  runner (`lib/mail/automation/__tests__`) DOIT rester verte ; règle : la trace
  est purement additive (jamais lue par la logique de progression).

**Rollback** : rollback de CODE (FlowView/timeline/trace writer). Les entrées
`_trace` déjà écrites sont inertes (jamais lues par le moteur). Aucune migration
descendante.

---

## Vague P4.2 — ACTIONS (dry-run + replay + soft-delete)

Vague à risque : elle envoie (potentiellement) des emails et touche aux données.

**Tests d'abord — GATE DRY-RUN EN PREMIER** :
- `F06-I-001` **mode `simulate` n'écrit AUCUN `email_outbox`** — écrit et rouge
  AVANT d'écrire le runner dry. **Bloquant** : tant que ce test n'existe pas, le
  code dry-run n'est pas autorisé en revue.
- `F06-I-002` **is_dry_run exclu de `checkDailyCap`** (test décisif) ;
  `F06-U-020/021` (frequency) ;
- `F06-I-003/004` redirect outbox vers contact de test seul + `is_dry_run=true` ;
- grilles réseau dry-run / replay / soft-delete (`F06-C-041..050`,
  `F06-C-061..065`, `F06-C-073..078`) ;
- intégration replay (`F06-I-030..032`) et soft-delete (`F06-I-020..025`).

**Code** :
1. `lib/mail/automation/dry-run.ts` : exécute le parcours en mode `simulate`
   (intercepte `send`/`webhook`/`tag`/`update_lead` → trace `simulated:true`,
   **aucun effet de bord**) ou `redirect` (send réel vers le contact de test).
   Crée le run avec `is_dry_run=true`.
2. **Avant** le code dry, modifier `checkDailyCap` + `checkCooldown` +
   KPI/nav-counters pour ajouter `WHERE NOT is_dry_run` (sinon un dry consomme le
   cap des vrais runs). Cf. liste `02-spec-technique.yaml §5`.
3. Route `POST …/dry-run` + `DryRunDialog.tsx`.
4. `resetAndReplayRun` (archive `_trace`, reset à `#1`, refus si non terminal).
5. `softDeleteAutomation` (refus si run actif, pose `deleted_at`) ; **retirer**
   l'ancien `deleteAutomation` (DELETE brut) — R-031.

**Risques MAJEURS** :
- **dry-run qui enverrait du réel en `simulate`** = incident → garantie testée
  AVANT le code (`F06-I-001`), gate de revue bloquante ; en intégration on
  compte les lignes outbox avant/après.
- **exclusion `is_dry_run` oubliée dans UNE requête de comptage** → checklist
  exhaustive (`§5`), un test par requête (`F06-U-020/021`, `F06-I-002/033`) ;
  grep des `count(*)` sur `email_automation_run` en revue.
- **soft-delete oublie une requête de liste** → `deleted_at IS NULL` à ajouter
  partout (liste, sélecteur runs, wizard 404), testé `F06-I-024`.
- **replay non terminal** crée une incohérence → refus atomique testé
  `F06-I-031`.

**Rollback** : rollback de CODE. `is_dry_run`/`deleted_at` restent inertes si le
code lecteur est retiré (les WHERE redeviennent inutiles mais corrects). Aucun
run dry en base ne pollue les KPI tant que le filtre est présent — si on
rollback le filtre, on accepte temporairement de recompter les dry (rare, runs de
test) plutôt qu'un DROP. **Ne jamais** rollback en supprimant la colonne.

---

## Vague P4.3 — WIZARD (micro-correctifs de configuration)

Vague la plus légère, purement UI/libellés ; aucune migration.

**Tests d'abord** :
- libellé daily cap corrigé (`F06-C-030`) ;
- badge non-op liste + sélecteur (`F06-C-031/032/037`) ;
- optgroup catégories (`F06-C-033`) ;
- blocages près du bouton (`F06-C-034`) ;
- phrase onTimeout dynamique (`F06-U-022/023`, `F06-C-035`) ;
- slug verrouillé (`F06-C-036`) ;
- compteur résultats runs + non-régression filtres (`F06-C-080..084`).

**Code** :
1. `FrequencySettings` : libellé « Plafond global … pour cette automation ».
2. `AutomationWizard` : `<optgroup>` par catégorie ; bloc « blocages » au-dessus
   du bouton Activer ; phrase onTimeout dynamique ; cadenas slug confirmé.
3. Liste automations : badge `[Non opérationnel]` (schedule/webhook).
4. Page runs : compteur de résultats près de « Filtrer ».

**Risques MAJEURS** :
- **régression des filtres runs existants** (le compteur partage la requête de
  comptage) → `F06-C-082` non-régression + grille existante des filtres.
- **libellé corrigé mais oublié à un endroit** (revue + récap) → vérifier les
  deux occurrences.

**Rollback** : rollback de CODE pur (libellés/markup). Aucun impact data.

---

## Gates de sortie (rappel chiffré)

- G1 batterie F06 100 % verte ; G2 suite emails globale verte ;
- G6 axe 0 serious/critical (FlowView, timeline, dialog dry-run) ;
- G7 grille réseau 6/6 pour dry-run, replay, soft-delete ;
- G8 E2E `SM-F06-01..05` verts ; G9 contrats dry-run + soft-delete présents ;
- **Gate spécifique F06** : `F06-I-001` (zéro outbox en simulate) et `F06-I-002`
  (cap non consommé par un dry) verts — **bloquant** avant activation du dry-run
  en prod.

---

## Ordre de livraison recommandé

M0 (migrations + index CONCURRENTLY séparés) → P4.1 (lecture, sûr) → P4.2
(actions, gate dry-run d'abord) → P4.3 (wizard). Chaque vague : build + restart,
batterie verte, puis E2E de la vague.
