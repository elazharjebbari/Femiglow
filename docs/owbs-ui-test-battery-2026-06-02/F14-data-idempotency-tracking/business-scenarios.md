# F14 — Scénarios métier réalistes (intégrité)

## BM-F14-1 — La journée d'audit : 1 lead = 1 ligne, 1 commande = 1 webhook
**Parcours :** sur un échantillon de parcours adverses (double-clic, reload, coupure,
beacon), l'opérateur réconcilie : nombre de leads admin == soumissions ; nombre de
commandes == thank-you ; nombre de webhooks `order.created` == commandes.
**Bug recherché :** doublons (leads/commandes/webhooks) ou pertes.

## BM-F14-2 — ROAS : la valeur ne se perd pas en optimiste
**Contexte :** une campagne pub mesure `generate_lead` et `purchase` à leur **valeur**.
**Attendu :** même en optimiste (succès affiché avant la réponse), les events
portent la **valeur serveur** (prix du kit) — pas d'événement « sans valeur ».
**Bug recherché (RSK-10) :** ROAS sous-évalué car valeur perdue.

## BM-F14-3 — Le CRM revient après une panne : rejeu sans doublon
**Parcours :** des `order_webhook` `dead` sont rejoués (F11).
**Attendu :** le CRM reçoit chaque commande **une** fois (dedupe `orderId`).
**Bug recherché :** double commande CRM au rejeu.

## BM-F14-4 — Acheteuse indécise : avance, recule, recommence
**Parcours :** remplit, avance, revient en arrière, re-soumet, recharge.
**Attendu :** un **seul** lead cohérent (timestamps monotones), pas d'état corrompu.
**Bug recherché :** timestamp régressif, lead dupliqué, état incohérent en admin.
