# F04 — Zéro-perte : beacon flush + endpoint /sync + reprise

**Surface :** `beacon-flush` (pagehide/visibilitychange → `sendBeacon`),
`POST /api/checkout/lead/sync` (batch idempotent), `lead-sync-singleton`
(hydrate + reflush). **Public :** acheteuse (invisible mais critique).

## 1. Fonctionnement optimal
- Au **masquage/fermeture** de l'onglet (`visibilitychange:hidden`, `pagehide`),
  les envelopes **en file** sont envoyées via `navigator.sendBeacon('/api/checkout/lead/sync')`
  (Idempotency-Key **dans le corps**, fallback `fetch keepalive`).
- `/sync` : **flag OFF → 204** (no-op) ; flag ON → applique chaque envelope en
  **upsert/patch idempotent**, tolère le désordre, plafonds (32/60 KB → 413), rate-limit (→ F13).
- **Reprise reload** : au remontage, `hydrateFromMirror` recharge les envelopes non
  confirmées et reflush (idempotent → pas de doublon).

## 2. Points à vérifier (tous angles)
### Frontend / robustesse navigateur
- Beacon émis sur **`pagehide`** ET **`visibilitychange:hidden`** ; **iOS Safari/bfcache** (R-07) couvert.
- File vide ⇒ **aucun** envoi. Teardown retire les listeners.
- Fallback `fetch keepalive` si `sendBeacon` indisponible/false.
### Backend / contrat
- Corps = `{schemaVersion, sentVia:'beacon', envelopes:[…]}` ; chaque envelope porte `leadId` `cl_…`, `scope`, `payload`.
- 204 si flag OFF ; 413 si trop gros ; 400 si envelope malformée ; 200 + `results` sinon.
### Data
- Après beacon, le lead est persisté (row `chat_lead`) **sans doublon** même si la création de fond avait aussi (partiellement) abouti.
### UX
- **Zéro perception** négative : l'acheteuse ne voit rien ; la garantie est invisible mais réelle.

## 3. Oracle principal
> Création en file (réseau aborté) + masquage onglet ⇒ **un POST `/sync`** part avec
> l'envelope `lead_create` (leadId `cl_…`) ; après reload, la file se vide sans
> créer de 2ᵉ lead.

## 4. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md) · [`business-scenarios.md`](business-scenarios.md)
