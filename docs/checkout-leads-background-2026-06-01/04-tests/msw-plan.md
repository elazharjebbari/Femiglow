# 04 — Plan MSW (simulation du transport réseau client)

> MSW intercepte les requêtes du `wizard-client` pour tester le comportement de
> `lead-sync-queue` face à la latence, aux 5xx, aux 409, et au batch `/sync`,
> **sans** serveur réel. Handlers OWBS ajoutés à `src/test/msw/`.

## 1. Handlers à fournir (`src/test/msw/handlers/owbs.ts`)

| Handler | Route | Comportement paramétrable |
|---|---|---|
| `leadCreateOk` | `POST /api/checkout/lead` | 201 `{leadId,status:'created',nextStep:'address'}` |
| `leadCreateSlow` | idem | délai `ctx.delay(ms)` configurable (latence injectée) |
| `leadCreateFlaky` | idem | N premières réponses 503 puis 201 (test retry) |
| `leadCreateConflict` | idem | 409 (même clé, payload différent) |
| `addressOk` / `paymentOk` | PATCH … | 200 statut attendu |
| `syncBatchOk` | `POST /api/checkout/lead/sync` | 200 `{results:[…]}` ; capture le body pour assertions |
| `syncBatchPartial` | idem | une envelope `rejected`, reste `applied` |
| `networkError` | n'importe | `res.networkError()` (test branche réseau coupé) |

Chaque handler **enregistre** les requêtes reçues (spy) pour vérifier idempotency-key,
ordre, et dédup.

## 2. Scénarios

### TST-M-01 — Latence n'affecte pas l'UI
- `leadCreateSlow(5000ms)`. `enqueue` ne bloque pas ; `pending()` contient l'envelope ; aucune attente côté appelant. (Complété en e2e par TST-E-01.)

### TST-M-02 — Retry sur 503 puis succès, sans doublon
- `leadCreateFlaky(n=2)` + faux timers. Après backoff, 3ᵉ tentative 201. Le spy montre **3 requêtes avec la MÊME `Idempotency-Key`** ; `pending()` vidé ; aucun double effet.

### TST-M-03 — 409 traité comme « déjà appliqué »
- `leadCreateConflict`. L'envelope est retirée (pas de retry infini), log `owbs.queue.dropped{reason:'conflict'}` ; UI inchangée.

### TST-M-04 — Réseau coupé → reste en file
- `networkError`. L'envelope **reste** dans `pending()` (retryable) ; au rétablissement (handler switch → ok), flush la vide.

### TST-M-05 — Batch /sync idempotent
- `syncBatchOk` reçoit un batch de 3 envelopes (create+address+payment) ; le spy vérifie qu'un **re-POST du même batch** ne change pas le résultat (idempotent). Couplé à TST-I-12 côté serveur.

## 3. Intégration MSW dans Vitest
- Réutiliser le `server` MSW existant (`src/test/msw/server.ts`) : `server.use(...owbsHandlers)` par test ; `resetHandlers()` en `afterEach`.
- Faux timers Vitest (`vi.useFakeTimers()`) pour piloter le backoff de la file de façon déterministe.
- Le transport de `lead-sync-queue` est l'implémentation réelle (`wizard-client`) → on teste le vrai chemin réseau client.

## 4. Anti-flakiness
- Aucune dépendance à l'horloge réelle (faux timers).
- `ctx.delay` borné ; pas de `setTimeout` réel non contrôlé.
- Spies assertés sur le **contenu** (idempotency-key, body), pas sur le timing absolu.
