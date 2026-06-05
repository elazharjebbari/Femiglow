# Scénarios métier — Automations

Personas :
- **Salma**, opératrice marketing FemiGlow (admin) — compose et active les automations.
- **Kaoutar / Nourelhouda / Yassine**, clientes/prospects (leads) — destinataires.
- **Le système** (cron `email-automation` + bridge `insertUserEvent`).

Chaque scénario décrit le parcours réel, l'état serveur attendu (**oracle**), et le
**défaut audit ciblé** (ce que le scénario doit faire échouer en l'état actuel).

---

## S1 — Séquence de bienvenue 3 emails sur 7 jours, avec désabonnement au milieu

**But** : valider l'enchaînement send/wait sur plusieurs ticks + l'interaction avec la
suppression list au milieu de la séquence.

**Données** : automation `welcome-series`, `triggerType=event`,
`triggerConfig.eventName=newsletter.subscribed`, steps :
1. `send welcome-1`
2. `wait 3j`
3. `send welcome-2`
4. `wait 4j`
5. `send welcome-3`

**Déroulé** :
1. Salma crée et **active** l'automation via le wizard (4 étapes). Oracle : ligne
   `email_automation` `active=true`, 5 steps persistés fidèlement.
2. Kaoutar s'inscrit à la newsletter → `insertUserEvent('newsletter.subscribed', …)`.
   **Oracle de câblage (F-051)** : le dispatcher crée **un** `email_automation_run`
   `running`, `currentStep=0`, `nextActionAt=now`. *(RED en l'état : aucun dispatcher,
   donc 0 run — le test de non-régression `regression:F-051` doit échouer.)*
3. Tick #1 : `welcome-1` envoyé (1 outbox), run avance au `wait 3j`,
   `nextActionAt=now+3j`.
4. À J+3 (DB antidatée), tick #2 : `welcome-2` envoyé, run avance au `wait 4j`.
5. **Entre J+3 et J+7, Kaoutar clique le lien unsubscribe** → `email_suppression`
   contient son email.
6. À J+7, tick #3 : avant d'envoyer `welcome-3`, `sendTransactional` voit la
   suppression et retourne `suppressed`. **Oracle** : `welcome-3` **non envoyé** (aucun
   outbox supplémentaire) ; le run se **termine proprement** (`completed`), pas
   d'`errored`.

**Oracles agrégés** : exactement 2 emails envoyés (welcome-1, welcome-2),
0 pour welcome-3, run final `completed`, `outboxIds.length === 2`.

**Couverture** : AUT-INT-060/062, AUT-E2E-160, AUT-INT-002 (câblage trigger).

---

## S2 — L'admin édite l'automation pendant que 40 runs attendent au step 2

**But** : exposer l'adressage par index cassé (F-056) lors d'une édition concurrente.

**Données** : automation `panier-relance`, steps :
1. `send relance-1`
2. `wait 24h`
3. `send relance-2`
4. `send relance-3-promo`

40 leads ont déclenché l'automation et sont tous **en `wait` au step index 1**
(`currentStep=1`, `_path=[1]`, `nextActionAt=J+1`).

**Déroulé** :
1. Salma se rend compte qu'il manque une étape et **insère un nouveau step en
   position 1** (avant le wait) : `tag relance-engagee`. La liste devient :
   `[send relance-1, tag, wait 24h, send relance-2, send relance-3-promo]`.
2. `updateAutomation` réécrit `steps` **en place** (pas de versioning).
3. À J+1, le runner reprend les 40 runs. Chaque run a `_path=[1]` qui pointait sur le
   `wait` — désormais **`steps[1]` est le `tag`**. **Oracle CIBLE (RED)** : aucun run
   ne doit ré-exécuter un `tag` à la place du `wait`, ni sauter `relance-2`.
4. Variante suppression : si Salma supprime un step, `getStepAtPath` peut renvoyer
   `null` → le run passe `completed` prématurément (relance-2/3 jamais envoyés).

**Oracle CIBLE** : un run garde le snapshot/`stepsVersion` du trigger ; il continue sa
trajectoire logique (envoie relance-2 puis relance-3-promo) indépendamment de
l'édition. **En l'état**, le test échoue (preuve du bug).

**Couverture** : AUT-INT-100/101/102/104, AUT-E2E-161.

---

## S3 — wait_for_event : avis produit après livraison, avec timeout

**But** : valider resume + sweep + `onTimeout`.

**Données** : automation `avis-post-livraison`, steps :
1. `send merci-commande`
2. `wait_for_event { eventName: 'order.delivered', timeoutMs: 14j, onTimeout: 'abort' }`
3. `send demande-avis`

**Déroulé A (event arrive)** :
1. Commande passée → run créé, tick envoie `merci-commande`, run passe
   `waiting_for_event` (`awaitingEventName=order.delivered`, `awaitingUntil=now+14j`).
2. Colis livré J+3 → `insertUserEvent('order.delivered', …)` → `resumeRunsForEvent`
   réveille le run **une fois** (`running`, path avancé past le wait_for_event).
3. Tick suivant : `demande-avis` envoyé. **Oracle** : un seul email d'avis.

**Déroulé B (timeout, onTimeout=abort)** :
1. Aucun `order.delivered` en 14j. Le sweep balaie le run.
2. **Oracle CIBLE (RED)** : `onTimeout=abort` ⇒ run **cancelled/errored**, `demande-avis`
   **non envoyé**. *(En l'état, `sweepWaitForEventTimeouts` force `running`/`nextActionAt`
   = `continue` quel que soit `onTimeout` → l'avis serait envoyé à tort.)*

**Déroulé C (course)** : l'event arrive **exactement** au moment du sweep. **Oracle**
(RED) : une seule avance (pas de double `demande-avis`).

**Couverture** : AUT-INT-110..117, AUT-E2E-162.

---

## S4 — Quiet hours Casablanca : campagne de nuit différée à l'aube

**But** : prouver le câblage et la correction tz/minuit/DST de `frequency.ts`.

**Déroulé** :
1. Automation `relance-nuit` avec `quietHoursEnabled=true`, fenêtre `08:00–22:00`,
   tz `Africa/Casablanca`.
2. Un trigger à **23:00 heure de Casablanca** calcule `nextActionAt`. **Oracle**
   (F-052) : l'envoi est différé à **08:00 le lendemain (heure locale Casablanca)**.
3. Variante passage minuit : trigger à **00:30 Casablanca** → différé à **08:00 le
   jour même**.
4. Variante DST : trigger pendant la transition d'heure marocaine → l'heure cible
   reste **08:00 wall-clock**, pas 07:00/09:00.

**Oracle CIBLE (RED)** : `applyQuietHours` est **importé et appelé** par le runner/le
trigger (actuellement code mort), et calcule en **heure locale** (actuellement
`setUTCMinutes` → faux pour UTC+1).

**Couverture** : AUT-UNIT-030..045, AUT-E2E-163.

---

## S5 — Crash du runner en plein tick → run orphelin

**But** : exposer le run orphelin `running` + `nextActionAt=NULL` (F-054).

**Déroulé** :
1. 10 runs dus. Le claim CTE met `nextActionAt=NULL` sur les 10 et les retourne.
2. Le process **crashe** après avoir traité 4 runs (redéploiement, OOM).
3. Les 6 runs restants sont `status='running'` avec `nextActionAt=NULL`.
4. Tick suivant : le `WHERE next_action_at IS NOT NULL` les **exclut** → ils ne sont
   **jamais** repris. **Oracle CIBLE (RED)** : un **sweep des orphelins** (ex.
   `running` + `nextActionAt IS NULL` + `updatedAt` ancien) ré-arme `nextActionAt` →
   les 6 runs repartent.
5. Bonus idempotence : pour les runs dont le `send` avait déjà eu lieu avant le crash,
   la reprise ne doit **pas** renvoyer (idempotencyKey `automation:<run>:step<path>`).

**Couverture** : AUT-INT-090/091/092/093, AUT-INT-081.
