# Scénarios métier — Pipeline / Outbox / Crons

Personas :
- **Le système** : `sendTransactional` (enqueue), cron `email-outbox` (drain),
  transport SMTP (Stalwart), webhooks entrants.
- **Salim**, ingénieur d'astreinte — observe la santé, fait les redéploiements.
- **Clients** : destinataires des transactionnels (confirmations, etc.).

Chaque scénario donne le déroulé, l'**oracle** d'état DB, et le **défaut audit** ciblé.

---

## S1 — Redéploiement prod pendant un batch de 80 emails

**But** : garantir qu'un `SIGTERM` en plein drain ne perd ni ne double aucun email.

**Déroulé** :
1. 80 lignes `pending` dues. Le cron lance `pickAndProcessBatch` : le CTE met les 80 (≤
   `BATCH_SIZE=100`) en `sending` et commence à les livrer **séquentiellement**.
2. Après 25 envois (`sent`), un **redéploiement** envoie `SIGTERM` → le process est tué.
3. **État** : 25 `sent`, **55 bloquées en `sending`**, 0 reprise.
4. Tick suivant : le claim `WHERE status IN ('pending','failed')` **ignore les 55
   `sending`** → elles ne repartent **jamais**.

**Oracle CIBLE (RED)** :
- Un **reaper** remet en `pending`/`failed` les `sending` dont `updatedAt` > seuil → les
  55 repartent au prochain tick.
- Les 25 `sent` ne sont **jamais** re-claimées (pas de double envoi).
- Borne temps : le batch s'arrête avant `maxDuration=60` (sinon SIGKILL Next).

**Couverture** : PIP-INT-031/033/064/152/151, PIP-INT-150.

---

## S2 — Stalwart down 2h puis retour

**But** : valider le comportement de retry/backoff pendant une panne SMTP prolongée et
le rattrapage propre au retour, **sans DLQ prématurée** ni busy-loop.

**Déroulé** :
1. Stalwart tombe (refus connexion). 30 lignes `pending`.
2. Tick : chaque ligne → `deliverRow` jette (transport down) → `failed`, `attempts=1`,
   `nextRetry=now+~1min` (backoff).
3. Ticks suivants : backoff exponentiel 1m, 2m, 4m, 8m, … **cappé à 1h**. Comme le cap
   est 1h, une ligne peut être réessayée ~quelques fois en 2h **sans atteindre
   `MAX_ATTEMPTS=5`** si le backoff l'espace assez → **oracle** : pas de passage en
   `dlq` tant que `attempts < 5`. (Si la panne dépasse le budget de 5 tentatives, le
   passage en `dlq` est attendu et acceptable, mais doit être **visible**.)
4. **Cas `SmtpNotConfiguredError`** (variante : secret SMTP retiré par erreur) :
   `deliverRow` met `failed` **sans `nextRetry`** → la ligne est re-claimée **à chaque
   tick** (`next_retry IS NULL`) en **busy-loop**, brûlant `attempts` en quelques
   secondes jusqu'à `dlq`. **Oracle CIBLE (RED)** : `failed` **avec** `nextRetry` (backoff)
   → pas de busy-loop.
5. Retour de Stalwart à H+2 : au tick suivant les lignes `failed` dues passent `sending`
   → `sent`. **Oracle** : toutes livrées, aucune perdue.

**Couverture** : PIP-INT-110/153/154/117/118/119, PIP-UNIT-072.

---

## S3 — Confirmation de commande : render qui échoue ne doit pas perdre l'email

**But** : exposer « render avant insert » (F-080).

**Déroulé** :
1. Au checkout, `sendTransactional({ template:'order-confirmation', payload })` est
   appelé. Le `payload` a un champ manquant → `renderTemplate` (`meta.schema.parse`)
   **jette**.
2. **État actuel** : l'exception remonte **avant** l'INSERT outbox → **aucune ligne**,
   et comme l'enqueue est fire-and-forget côté checkout, l'erreur est **avalée** → 0
   confirmation, **aucune trace** (corrèle F-091 : 0 confirmation en 30j).

**Oracle CIBLE (RED)** :
- Une ligne outbox existe (insérée AVANT render, ou render encapsulé), status `failed`
  avec `lastError` décrivant l'échec de render → **visible** dans le cockpit, retry
  possible après correction du payload.
- L'appelant (checkout) reçoit/loggue l'échec, pas un silence.

**Couverture** : PIP-INT-050/051/052/055.

---

## S4 — Crash mid-batch + idempotence d'envoi

**But** : prouver l'isolation crash/idempotence au niveau ligne.

**Déroulé** :
1. 10 lignes dues. Drain en cours : 4 livrées (`sent` + event `sent`), la 5e est
   `sending` quand le process **crashe** (OOM).
2. **État** : 4 `sent`, 1 `sending` orpheline, 5 encore `pending`/`failed` non touchées.
3. Reprise :
   - Reaper recycle la `sending` orpheline (S1).
   - Les 4 `sent` ne sont **pas** re-claimées (oracle : pas de double `email_event sent`,
     pas de 2e `sendMail`).
   - Les 5 restantes sont drainées normalement.

**Oracle** : à la fin, 10 `sent`, exactement 10 events `sent`, 0 doublon SMTP.

**Couverture** : PIP-INT-150/151/155/060/061, PIP-INT-040 (attempts non gonflés).

---

## S5 — Suppression d'une adresse interne casse les notifications opérateur

**But** : exposer l'absence d'allowlist interne (F-084).

**Déroulé** :
1. Un fournisseur renvoie un bounce pour une **adresse interne** (ex. la boîte qui reçoit
   les notifications « nouveau lead chat »). Le webhook ajoute cette adresse à
   `email_suppression`.
2. Un nouveau lead chat arrive → `lead-notification` est envoyée à l'adresse interne via
   `sendTransactional`. `isSuppressed(interne)` retourne **true** → `suppressed`,
   `outboxId=null`. **L'opérateur ne reçoit plus AUCUNE notification**, silencieusement
   (corrèle F-094).

**Oracle CIBLE (RED)** : `INTERNAL_ALLOWLIST` court-circuite la suppression pour les
adresses internes → la notification part toujours. Un client suppressé, lui, reste bloqué
(PIP-INT-100).

**Couverture** : PIP-INT-101/102/107.
