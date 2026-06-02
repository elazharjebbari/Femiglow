# 04 — Plan Playwright (e2e)

> Build prod local `:3100` (flag ON), DB seedée. Specs `apps/web/e2e/owbs-*.spec.ts`.
> Réseau simulé via `page.route` (throttle/abort) — méthode déjà utilisée dans le repo.

## 1. Scénarios

### TST-E-01 — L'UI avance sans attendre le réseau
**Spec** : `owbs-optimistic.spec.ts`
- Intercepter `**/api/checkout/lead` et **retarder** la réponse de 5 s (`route.fulfill` après delay) ou l'`abort()`.
- Remplir l'étape lead_capture, cliquer « Continuer ».
- **Assert** : l'étape `address` est visible en **< 50 ms** (mesure `performance.now()` entre clic et `data-step="address"`), bien que la réponse réseau ne soit pas revenue.

### TST-E-02 — Trois étapes sans gel
- Throttle global (route delay 3 s sur toutes les routes checkout).
- Parcourir lead_capture → address → payment.
- **Assert** : chaque transition < 50 ms ; aucune attente cumulée ; le store reflète l'étape courante.

### TST-E-03 — Fermeture d'onglet → lead persisté (zéro perte)  [Chromium + WebKit]
- Remplir lead_capture (sans laisser le flush live aboutir : route `**/lead` en `abort` une fois).
- Déclencher `page.close()` / `context.close()` après émission du `pagehide`.
- Intercepter `**/api/checkout/lead/sync` (beacon) et **capturer** le body.
- **Assert** : un POST `/sync` est parti avec l'envelope `lead_create` (leadId attendu, idempotency-key dans le corps). (Variante DB : vérifier la row via endpoint admin.)

### TST-E-04 — Recovery après reload
- Enqueue une envelope, simuler l'échec live, **recharger** la page.
- **Assert** : au remontage, la file ré-hydrate et un POST part (live ou /sync) ; la donnée converge ; idempotent (pas de doublon).

### TST-E-05 — Parcours complet → conversion
- Parcours nominal jusqu'à `order_create` (awaité).
- **Assert** : page `thank_you` ; un POST `/api/checkout/order` avec snapshot complet ; (option) rows `orders` + effets outbox enqueués (via endpoint admin).

### TST-E-06 — Funnel chat sans attente réseau (FR-09)
- Dans `LeadFormBubble`, soumettre le contact avec route `**/api/chat/lead**` retardée.
- **Assert** : confirmation UI immédiate (< 50 ms) ; envelope en file.

### TST-E-07 — Indicateur d'erreur discret (FR-11)
- Forcer N échecs non-retryables sur le flush.
- **Assert** : un indicateur discret (toast/badge) apparaît **sans** bloquer la navigation ; la navigation entre étapes reste possible.

### TST-E-OFF — Garde-fou legacy (flag OFF)
- Build/flag OFF : remplir une étape avec réseau retardé.
- **Assert** : l'étape suivante n'apparaît **qu'après** la réponse (comportement legacy préservé).

## 2. Utilitaires e2e
- `gotoWizard(page, {locale})` : ouvre le wizard sur `/fr/kit` → checkout.
- `throttle(page, pattern, ms)` / `abortOnce(page, pattern)` : helpers `page.route`.
- `measureTransition(page, fromStep, toStep)` : mesure clic→affichage.
- `captureBeacon(page)` : intercepte `/sync` et renvoie les bodies.

## 3. Matrices d'exécution
- **Critiques** (TST-E-01/02/03) : `--project=chromium` **et** `--project=webkit` (R-07).
- Le reste : chromium (suffisant).

## 4. Commandes
```
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm playwright test e2e/owbs-*.spec.ts --project=chromium
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm playwright test e2e/owbs-optimistic.spec.ts e2e/owbs-beacon.spec.ts --project=webkit
```
