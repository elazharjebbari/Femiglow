# Module 05 — Automations (wizard · runner · runs)

> Surface : `/admin/emails/automation/**` (liste, wizard new/edit, détail de run)
> Backend : `src/lib/mail/automation/**`, cron `/api/cron/email-automation`
> Inventaire : **F-050 → F-058**
> IDs de matrice : **AUT-\***

---

## 1. Doctrine du module

Ce module est le cas d'école de la **promesse UI non tenue**. L'admin compose dans le
wizard un déclencheur (`triggerType` event/schedule/subscription/webhook), des
conditions (`triggerConditions`), des étapes (7 types V2), et des garde-fous de
fréquence (quiet hours / cooldown / daily cap). **Tout est persisté en base et
re-affiché fidèlement** — donnant à l'opérateur la certitude que ça fonctionne.

L'audit 2026-06-03 a montré que **rien de tout cela n'est lu par le runtime** sauf
les `steps`. Chaque réglage exposé doit donc avoir un **test de câblage bout-en-bout**
qui prouve un effet observable serveur. Tout réglage sans test de câblage est réputé
**non câblé** (principe directeur n°2 du dossier).

Règle d'or de la matrice : **un réglage = au moins un test qui démontre qu'il produit
un effet réel**, ET (couche composant) **un test qui démontre qu'un échec réseau ne
produit pas un faux succès**.

---

## 2. Fichiers sources concernés

### Backend / moteur
| Fichier | Rôle |
|---|---|
| `src/lib/mail/automation/runner.ts` | `tickAutomation()` — claim CTE `FOR UPDATE SKIP LOCKED`, `processRun`, dispatch par `kind`, `advance()` |
| `src/lib/mail/automation/triggers.ts` | `triggerAutomation(slug, ctx, {dedupeKey})` — enqueue d'un run (le SEUL point d'entrée câblé) |
| `src/lib/mail/automation/frequency.ts` | `checkCooldown`, `checkDailyCap`, `applyQuietHours` — **100 % code mort** (jamais importé par le runner ni les triggers) |
| `src/lib/mail/automation/resume.ts` | `resumeRunsForEvent`, `sweepWaitForEventTimeouts` — reprise des `wait_for_event` |
| `src/lib/mail/automation/condition-evaluator.ts` | `evaluateConditionAgainstUser(cond, email)` — branch ; **lead absent → false** |
| `src/lib/mail/automation/step-types-v2.ts` | Schémas Zod des 7 steps + `AUTOMATION_EVENT_CATALOG` + `isValidEventName` |
| `src/lib/mail/automation/step-handlers/step-path.ts` | `getStepAtPath`, `nextPath`, `descendToExecutable`, `isValidPath` — adressage de l'arbre |
| `src/lib/mail/automation/step-handlers/tag.ts` | `handleTagStep` (add/remove lead_tag) |
| `src/lib/mail/automation/step-handlers/update-lead.ts` | `handleUpdateLeadStep` (status/source) |
| `src/lib/mail/automation/step-handlers/webhook.ts` | `handleWebhookStep` (POST/PUT, anti-SSRF, **sans timeout**) |
| `src/lib/admin/emails/automation-mutations.ts` | `createAutomation`, `updateAutomation`, `deleteAutomation` (server actions wizard) |
| `src/lib/user-events/insert.ts` | `insertUserEvent` → `resumeRunsForEventSafe` (hook resume, fire-and-forget) |
| `src/app/api/cron/email-automation/route.ts` | cron : `sweepWaitForEventTimeouts()` puis `tickAutomation()`, `maxDuration=60` |
| `src/lib/db/schema-emails.ts` | tables `email_automation` (l.313), `email_automation_run` (l.342), enums (l.110-123) |

### UI
| Fichier | Rôle |
|---|---|
| `src/app/admin/emails/automation/page.tsx` | Liste + toggle actif (F-050) |
| `src/components/admin/emails/automation/AutomationWizard.tsx` | Wizard 4 étapes (identité/étapes/fréquence/revue) |
| `src/components/admin/emails/automation/StepList.tsx` / `StepEditor.tsx` | Édition des steps (imbrication branch) |
| `src/components/admin/emails/automation/FrequencySettings.tsx` | Quiet hours / cooldown / daily cap |
| `src/components/admin/emails/automation/step-defaults.ts` | Valeurs par défaut + `stepLabel` |
| `src/app/admin/emails/automation/runs/[id]/page.tsx` | Timeline d'un run (F-055) |

---

## 3. Fonctionnement OPTIMAL (état cible)

### 3.1 Liste & toggle actif (F-050)
- **Cible** : le toggle `active` est la source de vérité honnête. Quand `active=false`,
  (a) aucun nouveau run n'est créé par les triggers (`triggerAutomation` retourne
  `disabled` — déjà OK), ET (b) tout run déjà `running` est **annulé** au prochain
  tick (`processRun` met `cancelled` — déjà OK). Quand `active=true`, l'arrivée d'un
  événement câblé crée un run.
- **Oracle de câblage** : toggle off → un trigger n'insère pas de ligne `run` ;
  toggle on → un trigger insère exactement une ligne.

### 3.2 Déclencheurs (F-051) — LE défaut central
- **Cible** : un **dispatcher de triggers** lit `triggerType` + `triggerConfig` +
  `triggerConditions` et crée les runs :
  - `event` : un `user_event` dont `eventName === triggerConfig.eventName` ET dont le
    lead satisfait `triggerConditions` ⇒ `triggerAutomation(slug, …)`. Un autre event
    ne crée rien.
  - `schedule` : un cron évalue `triggerConfig.cron`/`at` et enrôle l'audience cible.
  - `subscription` : `newsletter.subscribed` enrôle l'inscrit.
  - `webhook` : un endpoint signé crée un run depuis un payload externe.
- **Écart audit** : **moteur jamais câblé**. `triggerType/Config/Conditions` sont
  persistés (`automation-mutations.ts`) mais **aucun code ne les lit** ; seul
  `cart-abandoned-1h` est appelé en dur (cf. F-058). Les tests AUT doivent ÉCHOUER en
  rouge tant que le dispatcher n'existe pas (test de non-régression `regression:F-051`).

### 3.3 Conditions de déclenchement (`triggerConditions`)
- **Cible** : compilées via `rules-compiler` et évaluées contre le lead à
  l'enrôlement. Lead inconnu + condition non vide ⇒ pas de run.
- **Écart** : non lues (idem 3.2). De plus `evaluateConditionAgainstUser` renvoie
  `false` si le lead est absent (cf. 3.6) — un test doit documenter ce comportement.

### 3.4 Fréquence (F-052) — quiet hours / cooldown / daily cap
- **Cible** :
  - **quiet hours** : un `send` programmé hors fenêtre `[start,end]` (tz
    `Africa/Casablanca`) est **différé** au prochain `start`. Ex. : envoi calculé à
    **23:00 Casablanca** → reporté à **08:00** le lendemain.
  - **cooldown** : deux triggers du même `(automation, email)` à moins de
    `cooldownSeconds` ⇒ un seul run.
  - **daily cap** : le (N+1)-ième run du jour est bloqué ; compteur **remis à zéro à
    minuit Casablanca** (pas UTC).
- **Écarts audit (multiples)** :
  1. `frequency.ts` n'est **jamais importé** par `runner.ts` / `triggers.ts` → code mort.
  2. `applyQuietHours` calcule un offset en **UTC** (`setUTCMinutes`) à partir d'une
     heure locale tz : faux dès que l'offset tz ≠ 0 (Casablanca = UTC+1, +DST). Casse
     aussi au **passage de minuit** (fenêtre qui enjambe 00:00, ex. 22:00→08:00 traitée
     comme `start>end` non gérée) et en **DST** (transition heure d'été marocaine).
  3. `checkDailyCap` utilise `setHours(0,0,0,0)` = minuit **du serveur** (UTC en prod),
     pas minuit Casablanca → reset à la mauvaise heure.
  4. `checkCooldown` lit `triggeredAt` mais n'est appelé nulle part.
- **Specs** : `frequency-quiet-hours.test.ts` (table-driven tz/minuit/DST) doit
  encoder l'oracle CIBLE et donc **échouer** sur l'implémentation actuelle.

### 3.5 Steps V2 (F-053) — 7 types, succès ET échec
- **Cible** : chaque step a une sémantique d'échec explicite. Un échec **bloquant**
  (`tag`/`update_lead`/`webhook` qui rate) doit **stopper l'avance** ou demoter le run
  en `errored` selon une politique documentée — jamais avancer silencieusement.
- **Écarts audit** :
  - `send` : OK ; mais `sendTransactional` est appelé **avant `advance()`** → si le
    process crashe entre l'envoi et l'`UPDATE`, le run sera re-claim et **renvoie**.
    L'`idempotencyKey` dépend du **path** (`step${stepLabel}`) — protège le re-jeu du
    MÊME step, mais une édition qui change le path casse l'idempotence (cf. 3.8).
  - `tag` / `update_lead` / `webhook` : `processRun` **ignore le résultat**
    (`{ok:false}`) et appelle `advance()` quand même ⇒ échec avalé, run avance.
  - `webhook` : `handleWebhookStep` n'a **aucun timeout** (`fetchImpl` sans
    `AbortSignal.timeout`) → un endpoint lent bloque le tick (et le `maxDuration=60`).
  - `branch` : OK via `descendToExecutable` ; brancher avec lead absent ⇒ `ifFalse`
    (condition false, cf. 3.6).
  - `wait_for_event` : cf. 3.7.

### 3.6 Condition-evaluator
- **Écart** : `evaluateConditionAgainstUser` fait `SELECT 1 FROM leads WHERE email=? AND
  <cond>` → **lead absent ⇒ toute condition false**. Conséquence : une branche
  « si NON tag X » prend `ifFalse` pour un email sans lead, contre-intuitivement.
  À tester explicitement comme comportement connu, et cible = distinguer
  « lead absent » de « condition non satisfaite ».

### 3.7 wait_for_event (F-057)
- **Cible** : le run passe en `waiting_for_event` avec `awaitingUntil = now+timeout`.
  L'arrivée de l'event (`resumeRunsForEvent`) réveille le run **une seule fois** ;
  le timeout est balayé (`sweepWaitForEventTimeouts`) et applique
  `onTimeout` (`continue` → step suivant, `abort` → run errored/cancelled).
- **Écarts** :
  - **Course resume vs sweep** : `resumeRunsForEvent` (déclenché par `insertUserEvent`,
    fire-and-forget) et `sweepWaitForEventTimeouts` (cron) peuvent agir sur la même
    ligne sans verrou ⇒ double avance possible.
  - `onTimeout=abort` **ignoré** : le sweep met toujours `running`/`nextActionAt=now`
    (= `continue`) quel que soit `step.onTimeout`.
  - resume cappé à 50 lignes par event sans pagination.

### 3.8 Édition pendant runs en cours (F-056)
- **Cible** : les steps doivent être **versionnés** ; un run garde le snapshot de
  l'automation au moment du trigger (ou une `stepsVersion`), de sorte qu'une édition
  ne re-route pas un run en vol.
- **Écart** : `updateAutomation` réécrit `steps` en place ; les runs adressent par
  **index/path** (`currentStep`, `_path`) → après réordonnancement/suppression de
  steps, le run rejoue le **mauvais** step (ou `getStepAtPath` renvoie null →
  `completed` prématuré). Scénario métier S2 ci-dessous.

### 3.9 Suppression d'automation avec runs (F-056/F-050)
- **Écart** : `deleteAutomation` fait un **hard-delete** ; `email_automation_run`
  référence `automation_id` (FK `references(() => emailAutomation.id)` **sans onDelete**)
  ⇒ violation FK si des runs existent, OU runs orphelins. Cible : soft-delete +
  annulation des runs en cours.

### 3.10 Runner — claim, crash, orphelins (F-054)
- **Cible** : claim concurrent sûr (`FOR UPDATE SKIP LOCKED` — OK) ; un crash en plein
  tick laisse une ligne récupérable ; un **sweep des orphelins** ré-arme les runs.
- **Écarts** :
  - Le claim met `next_action_at = NULL` AVANT le traitement. Si le process crashe
    pendant `processRun`, le run reste `status='running'` **avec `next_action_at=NULL`**
    → **plus jamais re-sélectionné** (le `WHERE next_action_at IS NOT NULL`). Run
    orphelin permanent, **aucun sweep**.
  - Pas de timer systemd en prod (F-054 / module 11) — runner mort.

---

## 4. Écarts audit → IDs de matrice (synthèse)

| Écart | Réf inventaire | IDs matrice clés |
|---|---|---|
| Moteur de triggers jamais câblé | F-051, F-058 | AUT-INT-010..018 |
| Quiet hours offset UTC / minuit / DST | F-052 | AUT-UNIT-030..045 |
| Cooldown / daily cap code mort + reset UTC | F-052 | AUT-INT-046..052 |
| Échecs de steps ignorés | F-053 | AUT-INT-060..069 |
| Webhook sans timeout | F-053 | AUT-UNIT-070, AUT-INT-071 |
| send avant advance (re-jeu) | F-053, F-054 | AUT-INT-080..083 |
| Run orphelin running+nextActionAt=NULL | F-054 | AUT-INT-090..093 |
| Édition pendant runs (path cassé) | F-056 | AUT-INT-100..104 |
| Hard-delete vs FK runs | F-056 | AUT-INT-105..107 |
| wait_for_event course + onTimeout abort | F-057 | AUT-INT-110..117 |
| condition-evaluator lead absent → false | F-053, F-057 | AUT-UNIT-120..123 |
| Toggle actif sans effet | F-050 | AUT-INT-001..005 |
| Wizard valide / faux succès | F-051 | AUT-MSW-130..148 |
| Timeline de run fidèle | F-055 | AUT-MSW-150..156 |

Voir `test-matrix.csv` (≥ 70 lignes), `scenarios-metier.md`, `test-plan.yaml`,
`machine-etats-run.puml`, `sequence-trigger-vers-envoi.puml`, et `specs/`.
