# Glossaire (langage commun)

| Terme | Définition |
|---|---|
| **OWBS** | Optimistic Wizard & Background Lead Sync — le nom de cette solution. |
| **Wizard** | Le tunnel de checkout multi-étapes (`src/components/checkout/wizard/`). Étapes : `cart_review` → `lead_capture` → `address` → `payment` → `thank_you`. |
| **Lead** | Row `chat_lead` représentant un prospect en cours de checkout (partiel) ou converti. Id préfixé `cl_`. |
| **Mutation** | Une opération d'écriture déclenchée par une étape : `lead_create`, `address_update`, `payment_select`, `order_create`, `email_optin`. |
| **Envelope** | Message sérialisable décrivant une mutation à synchroniser : `{ mutationId, leadId, scope, idempotencyKey, payload, enqueuedAt, attempt }`. |
| **lead-sync-queue** | File côté client (mémoire + miroir `sessionStorage`) qui ordonne et envoie les envelopes en tâche de fond, avec retry. |
| **Optimistic advance** | `goToStep()` appelé **avant** la confirmation réseau ; l'UI n'attend pas le serveur. |
| **Upsert-by-leadId** | Écriture serveur idempotente : crée le lead s'il n'existe pas, sinon applique le sous-ensemble de champs de la mutation. |
| **Idempotency-Key** | Clé `(scope, resourceId)` gérée client (`sessionStorage`) garantissant qu'un retry rejoue la réponse au lieu de double-écrire (`checkout_idempotency`). |
| **lead_event_outbox** | Table « boîte d'envoi » des effets de bord durables (tracking serveur, webhook), drainée par un worker cron — calquée sur `email_outbox`. |
| **Projector / worker** | Process cron (`/api/cron/lead-outbox`) qui consomme `lead_event_outbox` (`FOR UPDATE SKIP LOCKED`) et exécute les effets avec retry/backoff. |
| **Beacon flush** | Envoi de dernier recours des envelopes en attente via `navigator.sendBeacon` au moment où l'onglet se ferme/se masque. |
| **Conversion** | Création de la commande (`order_create`) — étape finale, synchrone, qui matérialise l'achat. |
| **Scanner d'abandon** | Détection des leads partiels non convertis (timestamps + `stampStep1AbandonWebhook`) pour relance / `cart.abandoned`. |
| **RTT** | Round-Trip Time réseau (client ↔ origine LiteSpeed, sans CDN). |
| **Flag** | `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` (serveur) + `NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` (client). |
