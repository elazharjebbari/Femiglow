# F10 — Admin : leads (liste, détail, états, actions)

**Surface :** back-office `/admin/leads` (+ `/admin/chat/leads`), `LeadStatusMenu`,
`LeadNoteForm`, `LeadStatusMenu`/tags, queries journey. **Public :** **opérateur**
(Nadia). **Pourquoi critique pour OWBS :** avec la capture **optimiste**, un lead
peut exister côté serveur **avant** que l'acheteuse ait fini — l'opérateur doit le
**voir** correctement (état, horodatages, capture/adresse/conversion/abandon).

## 1. Fonctionnement optimal
- La **liste** affiche les leads avec leur **état** dérivé des timestamps OWBS :
  `captured` (lead_captured_at), `address` (address_completed_at), `purchased`
  (purchased_at), `abandoned` (scanner). Filtres par état/source/date.
- Le **détail** montre la chronologie (capture → adresse → paiement → conversion /
  abandon), le panier (cart_snapshot), l'attribution (utm/gclid/fbp/fbc).
- **Actions** opérateur : changer le statut (`LeadStatusMenu`), ajouter une note
  (`LeadNoteForm`), tags. Idempotentes, traçables.
- Un lead **capturé en tâche de fond** (optimiste) apparaît dès que la sync a abouti
  (≤ quelques secondes / beacon).

## 2. Points à vérifier (tous angles)
### UI/UX opérateur
- États lisibles, filtres fonctionnels, pas d'état « fantôme » incohérent.
- Détail complet et exact (les nouveaux champs OWBS : leadId client `cl_`, timestamps).
- Actions avec feedback (succès/erreur), pas de double-action.
### Frontend/Backend
- La liste/détail reflètent fidèlement la row `chat_lead` (projection correcte des nouveaux états).
- Un lead optimiste (créé par upsert) est **indistinct** d'un lead legacy pour l'opérateur (même rendu).
### Data
- Cohérence : un lead `purchased` a `purchased_at` ET une commande ; un `abandoned` a les bons timestamps.
### Sécurité/perm
- Accès admin requis (auth) ; pas de PII exposée hors périmètre.

## 3. Oracle principal
> Après qu'une acheteuse a validé en optimiste, l'opérateur **voit** le lead avec
> le bon état et la bonne chronologie ; après conversion, il passe à `purchased`.

## 4. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md) · [`business-scenarios.md`](business-scenarios.md)
