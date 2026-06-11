# F03 — Plan de tests concret

> Étend `lead-sync-queue.test.ts` (unit) + `lead-sync-queue.msw.test.ts` (MSW).
> La plupart des cas existent ; **ajouts** : backoff borné (faux timers), reprise,
> robustesse miroir/storage, et garde-fou « aucun effet UI ».

## A. Unit (transport factice + `sleep`/`now` injectés)
- **F03-S01..S04, S06, S07** : déjà couverts (FIFO, retry même clé, drop 4xx, drop max, non-bloquant, double-flush) — **vérifier verts** + compléter assertions `onDrop(reason)`.
- **F03-S05 backoff borné** (nouveau) : injecter `sleep` espion + `now` fixe ; transport toujours retryable ; asserter que chaque délai = `min(base*2^(n-1), 4000)` (capé) → pas de retry-storm.
- **F03-S08/S09/S12/S13** : miroir (fake `Storage`), hydrate, miroir corrompu (`storage.setItem(KEY,'{bad')` → hydrate no-op), storage `null` (mémoire seule).

## B. MSW (transport HTTP réel)
- **F03-S10/S11** : `leadFlaky(2)` (retry même clé observée) ; `networkError` puis switch `leadOk` (reprise).

## C. Effet UI (RTL, garde-fou)
- **F03-S20** : monter `LeadCaptureStep` flag ON avec MSW `leadFlaky` ; après submit, l'étape address est visible et **aucun** `role=alert`/spinner n'apparaît pendant les retries (l'UI reste calme).

## D. Étapes
1. Vérifier l'existant vert (S01-S04,S06,S07).
2. Ajouter backoff borné (S05) + miroir robuste (S09/S12/S13).
3. MSW reprise (S11) + garde-fou UI calme (S20).
