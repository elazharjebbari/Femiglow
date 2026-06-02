# F14 — Intégrité données, idempotence end-to-end & tracking/attribution

**Surface :** transverse (routes, upsert, outbox, tracking). **Public :**
système/opérateur. **But :** prouver les **invariants** dont dépend la confiance
métier : pas de doublon, pas de perte, valeur d'attribution préservée.

## 1. Fonctionnement optimal (invariants)
- **Idempotence end-to-end** : double-submit / retour arrière / rejeu (live + beacon + reload) ⇒ **un** lead, **une** commande, **un** webhook.
- **Désordre toléré** : address avant create (via /sync) converge.
- **Timestamps monotones** : `address_completed_at`/`payment_selected_at`/`purchased_at` ne régressent pas (fill-forward).
- **Dédup d'effet** : `UNIQUE(type, lead_id, dedupe_key)` ⇒ pas de double webhook.
- **Scanner d'abandon préservé** : les rows partielles existent (capture/adresse) → relance possible.
- **Attribution préservée** : `generate_lead`/`purchase` portent la **valeur** ; le pont lead→Meta Purchase (cookie) dédoublonne ; le webhook `order.created` part **une** fois (durable).

## 2. Points à vérifier (tous angles)
### Data
- Convergence à 1 lead / 1 commande quel que soit le chemin (live/beacon/reload/désordre).
- Monotonie des timestamps ; pas d'écrasement par null (fill-forward upsert).
### Tracking/attribution (métier critique)
- `purchase` (wizard) et `generate_lead` (chat) émis **une** fois, avec valeur.
- Webhook `order_webhook` : 1 par commande (dedupe orderId) ; `dead`→rejeu sans doublon.
- Pas de double-comptage Meta/GA4 (event_id/dédup).
### Backend
- Upsert idempotent ; outbox dédup ; conversion idempotente (order_create).

## 3. Oracle principal
> Quel que soit le parcours adverse (double-clic, reload, beacon, désordre), le
> système converge à **1 lead, 1 commande, 1 webhook**, avec la **valeur**
> d'attribution intacte.

## 4. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md) · [`business-scenarios.md`](business-scenarios.md)
