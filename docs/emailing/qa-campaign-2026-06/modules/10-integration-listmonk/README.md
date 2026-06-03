# Module 10 — Intégration Listmonk (LMK-*)

> Réf. inventaire : **F-100..F-105**.
> Couvre le client HTTP Listmonk, le push d'une snapshot d'audience vers une
> liste éphémère, le cleanup/purge de ces listes, la sync des abonnés
> (`email_subscriber_link`), et l'iframe/proxy admin.

---

## 1. Périmètre

| Réf | Fonctionnalité | Surface | Acteur |
|---|---|---|---|
| F-100 | Client API Listmonk (auth/listes/subscribers/campagnes) | backend | Système |
| F-101 | Push snapshot → liste éphémère Listmonk | backend | Système |
| F-102 | Cleanup listes éphémères expirées | backend cron | Système |
| F-103 | Purge snapshots expirés | backend cron | Système |
| F-104 | Iframe admin Listmonk (proxy) | UI admin | Opérateur |
| F-105 | Sync abonnés (`email_subscriber_link`) | backend | Système |

### Fichiers sources concernés

- `src/lib/mail/listmonk/client.ts` — client typé (`listmonk.lists/subscribers/templates/campaigns/...`).
- `src/lib/mail/campaigns/listmonk-sync.ts` — `pushSnapshotToListmonk()`, `cleanupExpiredListmonkLists()`.
- `src/lib/mail/audiences/purge.ts` — `purgeExpiredSnapshots()`.
- `src/app/api/cron/email-listmonk-cleanup/route.ts` + `src/app/api/cron/email-audience-purge/route.ts`.
- `src/components/admin/emails/ListmonkFrame.tsx` — iframe sandboxée.
- `src/app/api/listmonk/[...path]/route.ts` — reverse-proxy admin → Listmonk loopback.
- `src/lib/db/schema-emails.ts` — `email_audience_snapshot(.listmonkListId)`, `email_subscriber_link`.

---

## 2. Fonctionnement OPTIMAL (état cible)

### 2.1 Client API résilient — F-100

**État actuel** : `fetch` sans timeout/retry/429, pagination cap 50 silencieux,
`per_page:'all'` passé comme `number` (fragile).

**État cible** :
1. **Timeout** par requête (`AbortController`, ex. 10 s) — Listmonk loopback peut se figer
   (verrou DB, import en cours). Un timeout déterministe vaut mieux qu'un hang.
2. **Retry** avec backoff exponentiel + jitter sur erreurs **transitoires** (5xx, réseau, timeout) ;
   **pas** de retry sur 4xx (auth/validation).
3. **429** : respecter `Retry-After`, attendre puis retenter (cap N tentatives).
4. **Pagination complète** : itérer `page`/`per_page` jusqu'à `total` épuisé — ne **jamais**
   tronquer silencieusement à 50. `per_page:'all'` remplacé par une boucle paginée typée.
5. **Auth KO (401)** : lève `ListmonkApiError(401)` explicite (pas de retry, message exploitable).

### 2.2 Push snapshot atomique & rejouable — F-101

**État actuel** : `pushSnapshotToListmonk` non atomique — 1 POST/contact, push partiel non
rejouable (si crash à mi-parcours, certains contacts poussés, pas de reprise propre).

**État cible** :
1. **Chunking** : import par lots (ex. 1000) via `/api/import/subscribers` (CSV/JSON) — pas un POST
   par contact (4200 contacts ≠ 4200 requêtes).
2. **Atomicité logique / reprise** : la snapshot porte `listmonkListId` **avant** le push des membres ;
   un re-run **reprend** là où il s'est arrêté (idempotent par email côté liste) plutôt que de tout
   re-pousser ou d'échouer. Un compteur `pushedCount` persisté permet de vérifier le **compte exact**.
3. **Vérification post-push** : `subscriber_count` de la liste Listmonk == `snapshot.size` (oracle d'intégrité).

### 2.3 Cleanup / purge — ordre garanti — F-102 / F-103

**État actuel** : deux crons (`email-listmonk-cleanup`, `email-audience-purge`) opèrent sur le
**même critère** (`purgeableAfter < now()`) **sans ordre** → course : la purge supprime la snapshot
(et donc l'`listmonkListId`) **avant** que le cleanup n'ait supprimé la liste Listmonk ⇒ **fuite de listes**.

**État cible** :
1. **Ordre imposé** : cleanup Listmonk **d'abord** (supprime la liste distante + met `listmonkListId=NULL`),
   purge snapshots **ensuite** (DELETE des lignes DB). Soit orchestré par un seul cron, soit garde
   explicite (la purge ne supprime que les snapshots dont `listmonkListId IS NULL`).
2. **Orphelins par tag** : balayage de sécurité côté Listmonk — toute liste taggée `ephemeral` sans
   snapshot FemiGlow correspondant est supprimée (filet anti-fuite).
3. **Idempotence** : `404` côté Listmonk = déjà supprimée → succès. Rejouable sans effet de bord.

### 2.4 Sync abonnés — F-105

**État actuel** : `email_subscriber_link` = 0 ligne en prod (jamais alimenté).

**État cible** : la confirmation newsletter (module 09) **et** le webhook `subscriber.created`
Listmonk alimentent `email_subscriber_link` ; un sync réconcilie `listmonkSubscriberId`,
`status`, `doubleOptinConfirmedAt`. Le test prouve qu'un confirm crée la ligne **et** la pousse.

### 2.5 Iframe / proxy — sécurité — F-104

**État actuel** : le proxy `strippe` `CSP` et `X-Frame-Options` de Listmonk pour permettre l'iframe.

**État cible** :
1. Le proxy **exige une session admin** (déjà le cas) et n'expose **jamais** les credentials Listmonk.
2. **Sandbox** : l'iframe garde `sandbox="allow-same-origin allow-scripts allow-forms allow-popups"`
   **sans** `allow-top-navigation` (pas d'évasion de l'iframe).
3. **CSP du parent** : la page parente conserve une CSP stricte (`frame-ancestors 'self'`,
   `frame-src` limité au proxy/subdomaine) — strip côté upstream OK **uniquement** parce que le
   parent ré-applique une politique. Le test vérifie que le strip ne crée pas de surface XSS
   (pas de navigation arbitraire, postMessage filtré par `origin`).
4. **Préférence** : servir Listmonk depuis son sous-domaine dédié (`listmonk.femiglow-maroc.com`)
   plutôt que le proxy same-origin (cf. mémoire projet — collision `/admin/*`).

---

## 3. Diagramme

`sync-db-listmonk.puml` — séquence push snapshot (chunking + reprise) + cleanup/purge ordonnés.

---

## 4. Écarts audit ciblés

| Code | Constat prod | Garantie de test |
|---|---|---|
| L-TIMEOUT | client sans timeout/retry/429 | `LMK-MSW-TIMEOUT/RETRY/429` via MSW interceptant l'API Listmonk. |
| L-PAGE | pagination cap 50 silencieux, `per_page:'all'` fragile | `LMK-MSW-PAGE-FULL` : 130 items sur 3 pages tous récupérés. |
| L-ATOM | push non atomique, partiel non rejouable, 1 POST/contact | `LMK-INT-PUSH-RECOVERY` : reprise après push partiel ; chunking vérifié. |
| L-LEAK | fuite de listes (purge vs cleanup, 2 crons même critère sans ordre) | `LMK-INT-ORDER` : purge ne tue pas la snapshot avant cleanup. |
| L-SUBLINK | `email_subscriber_link` jamais alimenté | `LMK-INT-SUBSYNC` : confirm crée + pousse la ligne. |
| L-PROXY | proxy strippe CSP/X-Frame-Options (surface XSS) | `LMK-CMP-IFRAME-SANDBOX` + `LMK-INT-PROXY-AUTH` : auth requise, sandbox sans top-nav, postMessage filtré. |

---

## 5. Stratégie de test (couches)

- **Client résilience (couche 1/5)** : `specs/listmonk-client-resilience.test.ts` — **MSW** intercepte
  l'API Listmonk (timeout, retry, 429, 5xx, pagination, auth KO).
- **Push recovery (couche 3)** : `specs/snapshot-push-recovery.integration.test.ts` — vraie DB +
  MSW Listmonk : atomicité, reprise après partiel, chunking, compte exact, ordre cleanup/purge.
- **Composant (couche 2)** : `ListmonkFrame` (sandbox, src proxy/subdomaine, postMessage filtré).
- **Intégration proxy (couche 3)** : auth admin requise, strip CSP contrôlé.

Voir `test-matrix.csv` (≥ 40 lignes), `scenarios-metier.md`, `test-plan.yaml`.
