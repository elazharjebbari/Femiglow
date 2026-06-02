# F03 — File de synchronisation en arrière-plan

**Surface :** `lead-sync-queue` (FIFO/retry/backoff/miroir), `lead-sync-transport`
(fetch keepalive + Idempotency-Key), `lead-sync-singleton`. **Public :** système,
mais **effets perceptibles** par l'acheteuse (jamais de gel ; indicateur si dégradé).

## 1. Fonctionnement optimal
- `enqueue()` est **non bloquant** : pousse l'envelope, persiste le miroir `sessionStorage`, déclenche un flush en fond.
- **FIFO** : la tête est réessayée jusqu'au succès avant la suivante → ordre create→address préservé.
- **Retry** : sur réseau/5xx → backoff exponentiel + jitter, **même Idempotency-Key**, jusqu'à `maxAttempts` (6) puis **drop + `onDrop`** (→ FR-11).
- **Non-retryable** (4xx/409) → drop immédiat (pas de boucle).
- **Un seul flush concurrent** (await fiable) ; reprise via `hydrateFromMirror`.

## 2. Points à vérifier (tous angles)
### Frontend / UX
- `enqueue` ne bloque **jamais** l'appelant (l'UI a déjà avancé).
- Un retry ne produit **aucun** effet visible négatif (pas de spinner, pas d'erreur) tant qu'on n'a pas atteint `maxAttempts`.
- Après `maxAttempts`, `onDrop` est appelé exactement une fois (→ indicateur F05).
### Réseau / contrat
- Toutes les requêtes d'une même envelope portent **la même** `Idempotency-Key` (anti-doublon).
- `keepalive:true` (survie au unload partiel).
### Data / persistance
- Le miroir reflète la file ; `hydrateFromMirror` recharge des envelopes valides et ignore un miroir corrompu.
### Robustesse
- Backoff **borné** (pas de retry-storm CPU) ; double-flush concurrent ⇒ **un** envoi par `mutationId`.

## 3. Oracle principal
> Sous 2×503 puis 201, l'envelope part **3 fois avec la même clé** et la file se
> vide, **sans** impact UI ; sous 4xx, **un** seul envoi puis drop + onDrop.

## 4. État actuel
**Bien couvert** (unit `lead-sync-queue.test.ts` + MSW `lead-sync-queue.msw.test.ts`).
Cette batterie **ajoute** : la dimension **perceptible** (effets UI d'un retry / d'un
drop), les faux timers pour le backoff borné, et la reprise multi-onglet (→ F09).

## 5. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md)
