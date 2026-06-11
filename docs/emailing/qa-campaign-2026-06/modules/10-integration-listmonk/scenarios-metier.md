# Scénarios métier — Intégration Listmonk

Personas :
- **Système FemiGlow** : pousse les audiences, sync les abonnés, nettoie les listes.
- **Listmonk** : moteur de broadcast (loopback, API Basic auth).
- **Imane**, opératrice, ouvre l'iframe Listmonk sous l'admin FemiGlow.

---

## S-LMK-1 — « Imane diffuse à 4200 abonnées, le push ne perd personne » (F-101)

1. Imane finalise une campagne ciblant l'audience « initiées Casablanca » (snapshot figé, 4200 membres).
2. `pushSnapshotToListmonk(snapshotId)` :
   - crée la liste éphémère Listmonk (taggée `ephemeral`), persiste `listmonkListId` **avant** le push.
   - **État cible** : import par **chunks** (4 lots de ~1050) via `/api/import/subscribers` —
     pas 4200 requêtes unitaires (audit : « 1 POST/contact »).
3. **Oracle d'intégrité** : `subscriber_count` de la liste == `snapshot.size` (4200) — `LMK-INT-PUSH-COUNT`.

---

## S-LMK-2 — « Le serveur redémarre au milieu du push » (reprise, L-ATOM)

1. Push démarré : 1800/4200 contacts poussés, puis crash (déploiement, OOM).
2. `listmonkListId` est déjà persisté sur la snapshot ⇒ au **re-run**, on **reprend** :
   les 1800 déjà présents côté Listmonk sont idempotents (upsert par email), on pousse les 2400 restants.
3. **Oracle** : `LMK-INT-PUSH-RECOVERY` — après le 2e run, total poussé = 4200, **sans** re-pousser
   intégralement (compteur `pushedCount` repris). Le push n'est ni perdu ni dupliqué.

---

## S-LMK-3 — « Listmonk est lent / limite le débit » (résilience client, L-TIMEOUT)

1. Sous charge, Listmonk renvoie `429 Retry-After: 2` puis `503` transitoire.
2. **État cible** du client : respecte `Retry-After` sur 429, retry backoff+jitter sur 5xx,
   **timeout** (`AbortController`) sur un hang.
3. **Oracle MSW** : `LMK-MSW-429` (attend puis retente), `LMK-MSW-RETRY` (2e tentative OK),
   `LMK-MSW-TIMEOUT` (abort, pas de hang infini), `LMK-MSW-NORETRY-4XX` (un `422` ne retente jamais).

---

## S-LMK-4 — « Pagination : on ne tronque pas à 50 » (L-PAGE)

1. `listmonk.subscribers.list()` doit énumérer **tous** les abonnés d'une liste (130, sur 3 pages).
2. **Bug actuel** : `per_page:50` (ou `'all'` fragile) ⇒ on ne voit que les 50 premiers, silencieusement.
3. **Oracle** : `LMK-MSW-PAGE-FULL` — 130 items récupérés en itérant jusqu'à `total`. `LMK-MSW-PAGE-CAP`
   est un test de régression : il échoue si le code retombe sur un cap de 50.

---

## S-LMK-5 — « Nettoyage nocturne : pas de fuite de listes » (ordre, L-LEAK)

1. À J+30, une snapshot expire (`purgeableAfter < now()`). Elle a une `listmonkListId`.
2. **Bug actuel** : deux crons (`email-audience-purge`, `email-listmonk-cleanup`) tournent sur le
   **même critère sans ordre**. Si la purge passe d'abord, elle **DELETE la snapshot** (et son
   `listmonkListId`) ⇒ le cleanup ne sait plus quelle liste Listmonk supprimer ⇒ **fuite**.
3. **État cible** :
   - cleanup Listmonk **d'abord** (supprime la liste distante, met `listmonkListId=NULL`),
   - purge **ensuite**, et la purge **ne supprime que** les snapshots dont `listmonkListId IS NULL` (garde).
4. **Oracles** : `LMK-INT-ORDER` (liste supprimée avant le DELETE snapshot), `LMK-INT-PURGE-GUARD`
   (une snapshot avec `listmonkListId` non-NULL survit à la purge), `LMK-INT-ORPHAN-TAG` (filet : une
   liste `ephemeral` sans snapshot est nettoyée).

---

## S-LMK-6 — « Imane ouvre Listmonk dans l'admin, sans fuite de credentials » (proxy, L-PROXY)

1. Imane (session admin) ouvre `/admin/emails/listmonk` → `ListmonkFrame`.
2. Le proxy `/api/listmonk/[...path]` : **exige** la session admin (`401` sinon), injecte le Basic auth
   **côté serveur** (jamais exposé au navigateur), strippe `CSP`/`X-Frame-Options` de l'upstream.
3. **Sécurité** : l'iframe est `sandbox` sans `allow-top-navigation` (pas d'évasion) ; le
   `postMessage` listener ignore toute origine ≠ `window.location.origin`.
4. **Oracles** : `LMK-INT-PROXY-AUTH` (401 sans session), `LMK-INT-PROXY-INJECT` (auth ajoutée upstream),
   `LMK-CMP-IFRAME-SANDBOX` (pas de top-nav), `LMK-CMP-IFRAME-POSTMSG` (origine étrangère ignorée).
