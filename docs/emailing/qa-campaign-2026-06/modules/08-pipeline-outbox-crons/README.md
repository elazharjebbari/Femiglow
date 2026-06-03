# Module 08 — Pipeline d'envoi · Outbox · Crons

> Backend : `src/lib/mail/{send,outbox,client,backoff,rate-limit,suppression,render,catalog,unsub-token}.ts`
> Crons : `/api/cron/email-outbox` ; public : `/api/mail/unsubscribe`
> Inventaire : **F-080 → F-086**
> IDs de matrice : **PIP-\***

---

## 1. Doctrine du module

Le pipeline transactionnel est la colonne vertébrale : `sendTransactional()` enfile
dans `email_outbox`, le cron `email-outbox` draine par batch, `attemptSend` /
`pickAndProcessBatch` livrent via SMTP (Stalwart) avec backoff. Les défauts ne sont pas
des erreurs visibles à l'écran mais des **pertes silencieuses** et des **lignes
bloquées**. La couche reine ici est **l'intégration DB** (machine d'états outbox réelle)
+ l'**unit** (backoff, token). On teste **chaque transition d'état** (légale acceptée,
illégale rejetée) et chaque scénario de panne SMTP via **transport stub**.

Oracle transversal : **aucun email ne disparaît sans trace** et **aucune ligne ne
reste bloquée en `sending` après un crash**.

---

## 2. Fichiers sources concernés

| Fichier | Rôle | Écart audit clé |
|---|---|---|
| `src/lib/mail/send.ts` | enqueue : suppression → idempotence → render → INSERT → tentative immédiate | render AVANT insert (perte sans trace) ; enqueue hors transaction métier ; `attemptSend` fire-and-forget avalé ; suppression bloque aussi les internes ; `catch{}` vide sur unsub URL |
| `src/lib/mail/outbox.ts` | `attemptSend`, `pickAndProcessBatch`, `deliverRow`, `retryOutbox` | lignes `sending` orphelines (pas de reaper) ; pas de classif permanent/transient ; DLQ silencieuse ; `bounced_soft` jamais ramassé ; `attempts` incrémenté même sur succès ; batch 100 séquentiel × socketTimeout 30s vs maxDuration 60s ; `SmtpNotConfiguredError` → `failed` sans `nextRetry` |
| `src/lib/mail/client.ts` | transport nodemailer singleton | `rejectUnauthorized:false` ; pas de health-check |
| `src/lib/mail/backoff.ts` | `computeBackoff`, `MAX_ATTEMPTS=5`, cap 1h | jitter dérivé de `now()%1000` (déterministe testable) |
| `src/lib/mail/suppression.ts` | `isSuppressed`, `findSuppressed`, `addSuppression` | pas d'allowlist interne |
| `src/lib/mail/rate-limit.ts` | `enforceMailRateLimit` par scope | — |
| `src/lib/mail/unsub-token.ts` | HMAC token RFC 8058 (90j) | — (robuste ; à durcir e2e) |
| `src/app/api/cron/email-outbox/route.ts` | cron drain, `maxDuration=60` | pas de reaper sending ; pas de pickup `bounced_soft` |
| `src/app/api/mail/unsubscribe/route.ts` | clic one-click → suppression + disable subscriber | — |
| `src/lib/db/schema-emails.ts` | `email_outbox` (l.127), `email_event` (l.172), enum status | — |

---

## 3. Fonctionnement OPTIMAL (état cible) + écarts

### 3.1 Machine d'états outbox (F-082/083)
États (`emailOutboxStatus`) : `pending → sending → sent → (delivered | bounced_soft | bounced_hard)` ;
échecs : `sending → failed → … → dlq` ; reprise manuelle : `failed|dlq|bounced_soft → pending`.

**Transitions LÉGALES (cible)** :
| De | Vers | Déclencheur |
|---|---|---|
| pending | sending | claim (`attemptSend` / batch CTE) |
| failed | sending | claim (retry dû) |
| sending | sent | SMTP accepté (`deliverRow`) |
| sending | failed | erreur transitoire, `attempts < MAX` |
| sending | dlq | erreur, `attempts >= MAX` |
| sent | delivered | webhook Stalwart delivered |
| sent | bounced_soft | webhook bounce soft |
| sent | bounced_hard | webhook bounce hard (+ suppression) |
| bounced_soft | pending | reaper soft (cible) ou retry manuel |
| failed/dlq/bounced_soft | pending | `retryOutbox` (manuel) |

**Transitions ILLÉGALES (à rejeter)** :
- `sent → sending` (double envoi) ; `delivered → sending` ; `dlq → sending` (sans retry explicite) ;
- claim d'une ligne déjà `sending` par un autre worker (le `inArray(status,['pending','failed'])` du claim doit l'exclure) ;
- `pending → sent` sans passer par `sending`.

**Écarts** :
- **`sending` orphelin (F-082)** : `pickAndProcessBatch` met `sending` via CTE puis, si le
  process crashe avant `deliverRow`/`update`, la ligne reste `sending` **à vie** — le
  `WHERE status IN ('pending','failed')` ne la reprend jamais. **Aucun reaper.** Cible :
  un reaper remet en `pending|failed` les `sending` dont `updatedAt` dépasse un seuil.
- **`attempts` sur succès (F-083)** : `deliverRow` fait `attempts: (row.attempts ?? 0) + 1`
  même quand l'envoi **réussit** → compteur faussé, épuise le budget de retry.
- **`bounced_soft` jamais drainé (F-083)** : le claim du cron ne sélectionne que
  `pending|failed`. Une ligne passée `bounced_soft` par un webhook n'est jamais reprise.

### 3.2 Enqueue (F-080)
**Cible** : `sendTransactional` ordonne : suppression → idempotence → INSERT `pending` →
render (ou render dans une transaction qui, en cas d'échec, marque la ligne `failed`
avec trace), → tentative immédiate.
**Écarts** :
- **render AVANT insert** : si `renderTemplate` jette (payload Zod invalide, composant
  qui throw), l'exception remonte **sans aucune ligne outbox** → email perdu **sans
  trace** (F-065/F-080). Cible : insérer d'abord (ou capturer le render et persister
  `failed` + `lastError`).
- **enqueue hors transaction métier** : appelé en fire-and-forget depuis le checkout ;
  une exception est avalée → 0 confirmation envoyée sans alerte (F-091).
- **tentative immédiate fire-and-forget** : `void attemptSend(id).catch(log)` — l'échec
  immédiat n'est visible que dans les logs ; OK car le cron reprend, mais l'oracle doit
  vérifier que la ligne reste reprenable (`failed` avec `nextRetry`).
- **`catch{}` vide sur unsub URL** : si `MAIL_UNSUB_TOKEN_SECRET` manque, le placeholder
  `{{unsubscribe_url}}` reste **littéral** dans l'email (F-086). Cible : log + métrique,
  jamais d'email avec placeholder brut en prod.

### 3.3 Drain & concurrence (F-082)
**Cible** : claim `FOR UPDATE SKIP LOCKED` (OK) ; deux crons concurrents traitent des
sous-ensembles **disjoints** ; le batch est **borné par le temps** (sortir avant
`maxDuration=60`).
**Écart** : batch **100 séquentiel** × `socketTimeout 30s` → 2 emails lents suffisent à
dépasser `maxDuration=60` ; pas de borne temporelle ni de parallélisme contrôlé. Cible :
batch dimensionné + budget temps (ex. stop à 50s).

### 3.4 Retry / backoff / classification (F-083)
**Cible** : `computeBackoff` exponentiel + jitter, cap 1h (OK) ; **classification**
permanent (5xx SMTP, adresse invalide → DLQ direct) vs transient (timeout, 4xx temporaire
→ retry). 
**Écarts** :
- **pas de classification** : tout échec suit le même chemin `failed → … → dlq` après 5
  tentatives, même une erreur permanente (gaspille 5 essais sur une adresse morte).
- **`SmtpNotConfiguredError` → `failed` sans `nextRetry`** : `deliverRow` met `failed`
  sans poser `nextRetry` → le claim `(next_retry IS NULL OR next_retry <= now())`
  **la reprend en boucle immédiate** à chaque tick (busy-loop), brûlant `attempts`.

### 3.5 DLQ (F-083)
**Cible** : à `attempts >= MAX`, ligne `dlq` + event `dlq` + **alerte/visibilité**
(compteur, badge santé). **Écart** : DLQ **silencieuse** — event inséré mais aucune
alerte ni surface UI dédiée (module 11 F-114).

### 3.6 Suppression à l'envoi (F-084)
**Cible** : `isSuppressed` bloque les marketing/transactionnels destinés aux **clients**,
mais une **allowlist interne** (ex. `info@femiglow-maroc.com`, notifications leads
opérateur) ne doit **jamais** être suppressible.
**Écart** : `sendTransactional` appelle `isSuppressed(toEmail)` pour **toute** adresse →
si une adresse interne atterrit dans `email_suppression` (bounce d'une notif), les
notifications internes (nouveau lead chat, F-094) sont **silencieusement bloquées**.
Cible : `isSuppressed` consulte une allowlist `INTERNAL_ALLOWLIST` court-circuitante.

### 3.7 SMTP transport (F-081)
**Cible** : pool borné, timeouts, **`rejectUnauthorized:true`** avec CA correct, health-check.
**Écart** : `rejectUnauthorized:false` (accepte tout cert) ; singleton sans `verify()`
périodique. À tester via **stub** (down/lent/refusé) sans toucher au vrai Stalwart.

### 3.8 Rate-limit (F-085)
**Cible** : `enforceMailRateLimit('unsubscribe'|'newsletter'|…)` borne par IP/scope,
retourne 429 + `Retry-After`. À tester : limites exactes par scope, header `Retry-After`,
fenêtre glissante.

### 3.9 Unsub token (F-086)
**Cible** : HMAC SHA-256, expiration 90j, `timingSafeEqual`, base64url. Clic e2e : POST
one-click → INSERT suppression + disable subscriber, idempotent (`onConflictDoNothing`).
À tester : signature, expiration, falsification (sig + payload), e2e clic → effet DB.

---

## 4. Écarts audit → IDs matrice (synthèse)

| Écart | Réf | IDs clés |
|---|---|---|
| Transitions outbox (légales/illégales) | F-082/083 | PIP-INT-001..030 |
| `sending` orphelin (reaper absent) | F-082 | PIP-INT-031..036 |
| `attempts` incrémenté sur succès | F-083 | PIP-INT-040..042 |
| `bounced_soft` jamais drainé | F-083 | PIP-INT-043..045 |
| render avant insert (perte sans trace) | F-080 | PIP-INT-050..054 |
| enqueue hors transaction / fire-and-forget | F-080 | PIP-INT-055..058 |
| Drain SKIP LOCKED concurrent + borne temps | F-082 | PIP-INT-060..066 |
| backoff bornes/jitter/cap | F-083 | PIP-UNIT-070..082 |
| classification permanent/transient | F-083 | PIP-INT-083..088 |
| DLQ entrée + visibilité | F-083 | PIP-INT-090..094 |
| suppression + allowlist interne | F-084 | PIP-INT-100..107 |
| SMTP down/lent/refusé (stub) | F-081 | PIP-INT-110..116 |
| `SmtpNotConfiguredError` busy-loop | F-081/083 | PIP-INT-117..119 |
| rate-limit scopes | F-085 | PIP-INT-120..125 |
| unsub token sig/exp/falsif + e2e | F-086 | PIP-UNIT-130..137, PIP-E2E-138..140 |
| crash mid-batch / redéploiement | F-082 | PIP-INT-150..155 |

Voir `test-matrix.csv` (≥ 60 lignes), `scenarios-metier.md`, `test-plan.yaml`,
`machine-etats-outbox.puml`, et `specs/`.
