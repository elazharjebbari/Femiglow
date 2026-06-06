# F06 — Automations — fonctionnement optimal (cible)

> Chantier le plus en retard de l'audit : le moteur est riche (7 types de steps,
> branches imbriquées, contrôles de fréquence, sweep des zombies) mais l'UX de
> lecture/debug/test est quasi inexistante. F06 ne touche PAS le moteur de
> dispatch ; il rend **lisible** ce que le moteur fait, et ajoute **dry-run**,
> **replay** et **soft-delete** par-dessus l'existant.
>
> Problèmes traités : AUTO-01 (pas de vue de flux) · AUTO-02 (debug = JSON brut) ·
> AUTO-03 (pas de dry-run) · AUTO-04 (daily cap mensonger) · AUTO-05 (triggers
> fantômes) · AUTO-06 (pas de replay) · AUTO-07 (slug non verrouillé) ·
> AUTO-08 (événements non groupés) · AUTO-09 (blocages d'activation loin du
> bouton) · AUTO-10 (timeline sans timing/résultat) · AUTO-11 (sweep invisible) ·
> AUTO-12 / R-031 (DELETE brut jamais câblé) · AUTO-13 (conditions reliées) ·
> AUTO-14 (onTimeout opaque) · AUTO-15 (wizard non clavier) · AUTO-16 (pas de
> compteur de résultats runs).

Code de référence : `lib/mail/automation/{runner,frequency,orphan-sweep}.ts`,
`lib/mail/automation/step-handlers/step-path.ts`, `lib/admin/emails/automation-
{actions,mutations}.ts`, `app/admin/emails/automation/**`, `components/admin/
emails/automation/**`. Évolutions data : `02-modele-donnees.md §F06`
(`deleted_at`, `is_dry_run`, `_trace` porté par `contextJson` existant).

---

## 1. FlowView arborescente read-only (AUTO-01) — AUT-F04

### 1.1 Rôle

Un **seul** composant `FlowView` rend l'arbre de steps d'une automation en
lecture seule, indenté avec connecteurs CSS (PAS de lib de graphe). Il est
utilisé à **deux** endroits avec la même implémentation :

- **étape Revue du wizard** (`mode='review'`) : l'opérateur voit le flux complet
  qu'il s'apprête à enregistrer/activer ;
- **détail d'un run** (`mode='run'`, avec `currentPath`) : le même arbre, mais
  l'étape où le run se trouve actuellement est **surlignée** (amber), les étapes
  passées atténuées, les à-venir en pointillé.

### 1.2 Modèle d'arbre rendu

L'arbre est exactement celui consommé par le runner : un tableau
`AutomationStep[]` où un step `branch` porte deux sous-tableaux `ifTrue[]` et
`ifFalse[]` (récursion arbitraire, profondeur cap moteur = `MAX_PATH_DEPTH=12`,
soit ~4 branches imbriquées en pratique). Chaque nœud est adressé par un
`StepPath` identique à celui du runner :
`[3, 'ifFalse', 2, 'ifTrue', 1]` = step #1 de la branche `ifTrue` du step #2 de
la branche `ifFalse` du step #3 de premier niveau.

### 1.3 Algorithme de rendu (parcours)

```
renderList(steps, depth, pathPrefix):
  pour i, step de steps:
    path = [...pathPrefix, i]
    émettre une LIGNE de nœud :
      - connecteur vertical à gauche selon depth (depth × indentation)
      - puce d'icône du kind (step-defaults.STEP_KINDS)
      - libellé FR (step-defaults.stepLabel(step))
      - état visuel = stateFor(path, currentPath, runStatus)   (mode='run' seul)
    si step.kind === 'branch':
      émettre l'étiquette de condition (humanisée) du branch
      émettre une SOUS-GRILLE 2 colonnes :
        colonne « si vrai »  → renderList(step.ifTrue,  depth+1, [...path,'ifTrue'])
                               si vide → ligne « (branche vide → continue) »
        colonne « sinon »    → renderList(step.ifFalse, depth+1, [...path,'ifFalse'])
                               si vide → ligne « (branche vide → continue) »
    (sinon : nœud feuille, rien à descendre)
  si la liste est vide à depth 0 → EmptyState « Aucune étape »
```

Règles fermes :

- **Indentation** : chaque niveau de branche augmente l'indentation d'un cran
  fixe ; un connecteur vertical relie un nœud à son parent et un connecteur en
  L relie l'entête de branche à chacune de ses deux colonnes.
- **Numérotation** : niveau racine = `#1, #2, #3…` ; sous-branche = `#3a, #3b…`
  (lettre = position dans la sous-liste), conformément aux wireframes cibles.
  La numérotation est **dérivée du path**, jamais stockée.
- **Branche vide** : une colonne `ifTrue`/`ifFalse` sans step rend explicitement
  un nœud terminal « (branche vide → continue après la condition) » — JAMAIS une
  colonne blanche muette (le moteur, lui, fait `nextPath` ; l'UI le dit).
- **Profondeur arbitraire** : aucune limite codée en dur côté rendu autre que le
  cap moteur ; un arbre de 3 niveaux de branches imbriquées rend correctement
  (indentation cumulée, connecteurs corrects à chaque niveau).
- **Fin de flux** : après le dernier nœud du niveau racine, une pastille `(fin)`.
- **Read-only V1** : aucun bouton d'édition par nœud dans FlowView lui-même
  (l'édition reste l'étape 2 « Étapes » du wizard / `StepList`). V2 éditable =
  hors périmètre.

### 1.4 Étape courante surlignée (mode='run')

`stateFor(path, currentPath, runStatus)` renvoie l'un de :

| état       | condition                                                            | rendu |
|------------|---------------------------------------------------------------------|-------|
| `current`  | `path === currentPath` ET run non terminal                          | bordure + fond amber, libellé « En cours » |
| `error`    | `path === currentPath` ET `runStatus === 'errored'`                  | bordure + fond rose, libellé « ERREUR » |
| `done`     | `path` strictement AVANT `currentPath` (ordre de parcours), OU run terminal completed/cancelled | fond atténué, « Fait » |
| `upcoming` | `path` strictement APRÈS `currentPath`                              | pointillé, « À venir » |

Comparaison d'ordre : on linéarise l'arbre par parcours préfixe (le même que
`nextPath`) et on compare les **rangs** ; on NE compare PAS les segments
naïvement (sinon une étape de l'autre branche serait mal classée). Pour un run
en erreur, l'étape courante (là où il a calé) est rendue **rouge** et porte la
raison d'erreur en infobulle/inline.

`currentPath` provient du run : `contextJson._path` si présent et valide
(`isValidPath`), sinon repli legacy `[run.currentStep]` (rétro-compat avec les
runs créés avant l'instrumentation par path).

---

## 2. Timeline de run instrumentée via `_trace` (AUTO-02/10/11) — AUT-F08

### 2.1 Forme de `_trace`

Le runner écrit, à chaque étape **exécutée**, une entrée dans
`contextJson._trace` (JSONB existant — AUCUNE migration, cf. `02-modele-donnees.md`).
Schéma validé Zod côté runner ET côté lecture :

```
TraceEntry = {
  stepIdx:    StepPath        // ex. [3,'ifTrue',0] — path complet du step exécuté
  kind:       StepKind        // wait|send|branch|tag|update_lead|webhook|wait_for_event
  startedAt:  string (ISO)
  finishedAt: string (ISO) | null   // null = étape encore en cours (wait/wait_for_event posés)
  outcome:    'ok' | 'deferred' | 'skipped' | 'error'
  detail?:    string          // raison humaine : « quiet hours Africa/Casablanca », « template introuvable »…
  meta?:      object          // { template, outboxId, deferredUntil, capCount, cooldownWindow, eventName, sweep:true }
}
```

`_trace` est un **tableau append-only** : le runner pousse une entrée à chaque
passage de step (y compris quand il diffère/saute), il ne réécrit jamais les
entrées passées. Mapping avec la mécanique runner existante :

| chemin runner                              | entrée `_trace` produite |
|--------------------------------------------|--------------------------|
| `advance()` après send réussi              | `outcome:'ok'`, `meta.outboxId`, `meta.template` |
| `defer(until, 'quiet_hours…')`             | `outcome:'deferred'`, `detail` humanisé, `meta.deferredUntil` |
| `skipSend('daily_cap_reached…')`           | `outcome:'skipped'`, `detail`, `meta.capCount` |
| `skipSend('cooldown_active…')`             | `outcome:'skipped'`, `detail`, `meta.cooldownWindow` |
| `wait` / `wait_for_event` posés            | `outcome:'ok'`, `finishedAt:null` (en cours) |
| catch per-run → `status='errored'`         | `outcome:'error'`, `detail` = `erroredReason` |
| `sweepOrphanRuns` ré-arme/erreure          | entrée taguée `meta.sweep=true`, `detail` = motif sweep |

### 2.2 Rendu timeline

Pour chaque entrée, une ligne ordonnée affichant :

- pastille de résultat : ✓ (`ok`) · ⏸ (`deferred`) · ⤼ (`skipped`) · ✗ (`error`) ;
- numéro de step dérivé du `stepIdx` (`#3a` etc.) + libellé FR + icône du kind ;
- **horodatage** `startedAt → finishedAt` et **durée** calculée
  (`finishedAt - startedAt`) ; si `finishedAt:null` → « en cours… » ;
- **raison inline** humanisée (`detail`) directement sur la ligne : « différé
  22:40 → 08:00 (quiet hours Africa/Casablanca) », « sauté (step #3) — plafond
  quotidien atteint 50/50 », « ERREUR : template welcome-j0 introuvable » ;
- les entrées `meta.sweep=true` portent un **tag « sweep »** explicite : « run
  ré-armé par le balayage le 06/06 03:10 (process interrompu) » (AUTO-11 — le
  sweep n'est plus invisible).

### 2.3 Rétro-compatibilité (run sans `_trace`)

Un run créé AVANT l'instrumentation n'a pas de `_trace` (ou un tableau vide). La
timeline détecte ce cas et **retombe sur la timeline legacy** (l'actuelle :
liste des steps de l'automation + état dérivé de `_path`/`currentStep` +
encarts `_deferredReason`/`_skippedReason`/`_cancelledReason`). AUCUNE régression
sur les runs anciens ; le bandeau « run antérieur à l'instrumentation » est
affiché pour expliquer l'absence de timing.

---

## 3. Dry-run (AUTO-03) — AUT-F09

### 3.1 Contrat

`POST /api/admin/emails/automation/[id]/dry-run`
Entrée : `{ testContact: string(email), mode: 'simulate' | 'redirect' }`.
Sortie : `{ runId: string, trace: TraceEntry[] }` (le run est exécuté
**synchroniquement** jusqu'à son premier point d'attente — wait/wait_for_event —
ou jusqu'à complétion, puis la trace est renvoyée et le dialog ouvre la timeline
de ce run).

### 3.2 Deux modes

- **`simulate`** (par défaut, recommandé) : **AUCUN envoi réel**. Les steps
  `send` produisent une entrée `_trace` `outcome:'ok'` avec
  `meta.simulated=true` et le template/payload qui AURAIT été envoyé, mais
  `sendTransactional` n'est **jamais** appelé → **zéro ligne `email_outbox`**.
  Idem `webhook` (aucun appel sortant), `tag`/`update_lead` (aucune écriture
  lead) : tout est tracé, rien n'est effectué.
- **`redirect`** : envoi réel mais **redirigé** vers le `testContact` (la boîte
  de l'opérateur). Une ligne outbox EST créée vers le contact de test
  uniquement ; le destinataire métier réel n'est jamais touché.

### 3.3 Garanties (invariants de sécurité — testés AVANT le code, cf. §5)

1. **Mode `simulate` n'écrit AUCUN `email_outbox` réel** — invariant n°1, test
   décisif : compter les lignes outbox avant/après = identique.
2. **Le run dry est marqué `is_dry_run = true`** et, à ce titre :
   - **exclu de TOUS les KPI** (compteurs runs, taux d'erreur, dashboards) ;
   - **exclu du daily cap** : `checkDailyCap` compte `WHERE NOT is_dry_run`, donc
     un dry-run NE consomme PAS le plafond et NE déclenche PAS de skip pour les
     vrais runs (invariant n°2, test décisif §5) ;
   - **exclu du cooldown** : un dry-run ne pose pas de jalon cooldown pour le
     destinataire réel.
3. **Marquage visuel** : le run dry porte un badge « test » partout (liste des
   runs, détail, timeline) — impossible de le confondre avec un run de
   production.
4. **Double-clic sur « Lancer le test » = 1 seule requête** (bouton désactivé +
   `aria-busy` pendant l'exécution synchrone).

---

## 4. Replay « réinitialiser et rejouer » (AUTO-06) — AUT-F10

Distinct du **retry** existant (`retryAutomationRun`, qui reprend au step
courant sans rien remettre à zéro). Le **replay** :

- **Préconditions** : run en statut terminal `completed` | `errored` |
  `cancelled` (on ne replaye PAS un run `running`/`waiting_for_event` en vol) ;
  l'automation parente doit toujours exister.
- **Effet** : crée/repositionne le run au **tout début** :
  `currentStep=0`, `contextJson._path=[0]`, statut `running`, `nextActionAt=now`,
  `outboxIds=[]`, raisons effacées (`erroredReason`/`_deferredReason`/
  `_skippedReason`/`_cancelledReason`).
- **`_trace` archivée, PAS effacée** : la trace du run précédent est déplacée
  dans `contextJson._traceArchive` (append) avant de repartir avec un `_trace`
  vierge — l'opérateur garde la mémoire de l'échec d'origine tout en observant le
  nouveau déroulé.
- Confirmation par `ConfirmDialog` (socle F01) : « Réinitialiser et rejouer ce
  run depuis le début ? Le déroulé précédent est archivé. »
- Action serveur typée `resetAndReplayRun` (cf. spec §2 fichier 02) ; refus
  explicite si run non terminal (`ok:false`, message).

---

## 5. Soft-delete des automations (AUTO-12 / R-031) — AUT-F12

`deleteAutomation` actuel fait un **DELETE brut** jamais câblé à l'UI — il
crasherait sur la FK `RESTRICT` `email_automation_run → email_automation` dès
qu'un run existe (R-031). On le remplace par `softDeleteAutomation` :

- **Critère de refus** : refuse (`ok:false`, erreur typée `has_active_runs`) s'il
  existe `≥1` run en statut **actif** (`running` | `waiting_for_event`). Le
  message **liste** le nombre et un lien vers ces runs : « Suppression refusée :
  3 run(s) actif(s) (2 en cours, 1 en attente d'événement). Annulez-les ou
  attendez leur fin. [Voir les runs →] ».
- **Effet succès** : pose `deleted_at = now()` (aucun DELETE physique → aucune
  violation FK ; les runs historiques restent consultables). Audit-log émis.
- **Effet sur les listes** : toutes les requêtes de liste/détail d'automations
  filtrent `deleted_at IS NULL` → l'automation supprimée **disparaît** de la
  liste, du sélecteur de filtre des runs, du wizard. Ses runs passés restent
  visibles dans `/runs` (history).
- **Bouton** : `ConfirmDialog` variante danger, libellé verbe « Supprimer ».
- L'ancien `deleteAutomation` (DELETE brut) est **retiré** (plus aucune
  référence) — point de non-régression.

---

## 6. Micro-correctifs wizard / liste / runs

| Réf | Correctif | Détail |
|-----|-----------|--------|
| AUTO-04 | **Libellé daily cap corrigé** | « Plafond d'envois par jour (par destinataire) » → **« Plafond global d'envois / jour pour cette automation »**. Le moteur (`checkDailyCap`) compte bien par automation, pas par destinataire. Sous-texte : « tous destinataires confondus ». |
| AUTO-05 | **Badge « Non opérationnel »** | triggers `schedule`/`webhook` : pastille amber `[Non opérationnel]` en **liste** ET dans le **sélecteur** du wizard ; activation bloquée (déjà câblé wizard via `isOperationalTrigger`, à étendre à la liste). |
| AUTO-07 | **Slug verrouillé** | cadenas sur le champ slug en édition (déjà `disabled={Boolean(state.id)}` — à confirmer + icône cadenas). |
| AUTO-08 | **Événements groupés** | `<optgroup>` par `category` (`lifecycle`/`commerce`/`email`/`engagement`/`form`) dans le select d'événement (catalogue `AUTOMATION_EVENT_CATALOG`). |
| AUTO-09 | **Blocages près du bouton** | à l'étape Revue, la liste des raisons de blocage d'activation (trigger non-op, send sans template, eventName manquant) est affichée **juste au-dessus** du bouton « Activer », pas dispersée. |
| AUTO-13 | **Conditions reliées** | la mention « conditions de déclenchement » relie visuellement au trigger (déjà partiellement câblé). |
| AUTO-14 | **Phrase dynamique onTimeout** | step `wait_for_event` : phrase explicite du devenir au timeout — `onTimeout='continue'` → « Au bout de {durée}, le run **continue** à l'étape suivante. » ; `onTimeout='abort'` (ou absent → défaut moteur) → « Au bout de {durée}, le run est **abandonné**. ». Calculée depuis `onTimeout` + `timeoutMs`. |
| AUTO-16 | **Compteur de résultats runs** | près du bouton « Filtrer » : « N run(s) — filtres appliqués : statut=…, automation=… » (le `total` existe déjà côté serveur, à exposer). |

---

## 7. Ce qui doit être vérifié (oracles binaires, vue opérateur)

- FlowView linéaire (aucun branch) → N nœuds indentés au niveau 0, pastille
  `(fin)` après le dernier.
- FlowView avec 1 branch → 2 colonnes « si vrai » / « sinon », chaque sous-step
  numéroté `#Na/#Nb`, connecteur en L visible.
- FlowView branches imbriquées 3 niveaux → indentation cumulée correcte, aucun
  nœud manquant, aucun nœud dupliqué.
- FlowView branche vide → nœud « (branche vide → continue) » présent, pas de
  colonne blanche.
- Détail run mode='run' → l'étape `currentPath` est la SEULE en amber ; un run
  errored → l'étape courante est en ROUGE avec la raison.
- Timeline avec `_trace` complet → chaque ligne montre horodatage + durée +
  résultat ; deferred quiet-hours rendu inline ; skipped porte le n° de step ;
  entrée sweep porte le tag « sweep ».
- Timeline sans `_trace` → bascule legacy + bandeau « run antérieur ».
- Dry-run `simulate` → après exécution, `email_outbox` inchangé (0 ligne créée) ;
  le run apparaît avec badge « test ».
- Dry-run `simulate` → `checkDailyCap` d'un VRAI run suivant n'est PAS impacté
  (le compteur du jour n'a pas bougé).
- Replay → run repart à `#1`, `_trace` précédent retrouvable dans l'archive,
  refus si run en cours.
- Soft-delete avec run actif → refus + message listant les runs ; sans run actif
  → l'automation quitte la liste ET le sélecteur de filtre des runs.
- Libellé daily cap = « global … pour cette automation » (jamais « par
  destinataire »).
- Compteur de résultats runs visible et exact après filtrage.
