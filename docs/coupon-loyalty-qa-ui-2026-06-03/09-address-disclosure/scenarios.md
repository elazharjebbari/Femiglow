# F09 — Scénarios (Gherkin FR)

Persona : **Yasmine** (cliente au step adresse du wizard). La porte « J'ai un code de fidélité » est
repliée par défaut : aucune friction pour qui n'a pas de code. Le store seed via
`useWizardStore.setState`, `useAddressMutation` est mockée, le champ valide via MSW `redeemHandlers`.

## Scénario F09-S1 — Pas de code : la porte reste fermée (happy / anti-friction)
Contexte: Yasmine arrive à l'étape adresse sans code en store.
Étant donné que le step adresse est rendu
Quand Yasmine regarde le bloc crédit
Alors la disclosure « J'ai un code de fidélité » est repliée (open falsy)
Et le champ de saisie n'est pas mis en avant.

## Scénario F09-S2 — Reprise : la porte s'ouvre d'office (happy / resume)
Contexte: Yasmine avait déjà saisi « FG-SAUGE-7212 », puis a rafraîchi la page (couponCode persisté).
Étant donné que le store contient couponCode = « FG-SAUGE-7212 »
Quand le step adresse est rendu
Alors la disclosure est ouverte d'office
Et le champ affiche déjà « FG-SAUGE-7212 ».

## Scénario F09-S3 — Yasmine applique un code et le total se met à jour (happy)
Contexte: store vide, MSW reconnaît « FG-SAUGE-7212 » à 20 MAD.
Étant donné qu'elle ouvre la disclosure et saisit le code
Quand elle clique « Appliquer » et que la validation réussit
Alors le store contient couponCode = « FG-SAUGE-7212 » et creditCents = 2000
Et le total transmis à la commande devient total − 20 MAD.

## Scénario F09-S4 — Anti-stale : elle modifie un code déjà validé (edge)
Contexte: un crédit a été appliqué.
Étant donné que le store contient un crédit validé
Quand Yasmine modifie un caractère du code dans le champ
Alors clearCoupon est déclenché
Et le store repasse à couponCode = null, creditCents = 0
Et le total revient au montant plein.

## Scénario F09-S5 — Crédit supérieur au total : plancher à zéro (edge / INV-422)
Contexte: total 199 MAD, code de 250 MAD.
Étant donné un crédit qui dépasse le total
Quand on calcule le montant attendu de la commande
Alors expectedTotalCents = 0 (jamais négatif)
Et c'est ce montant plancher qui est envoyé au serveur.

## Scénario F09-S6 — Code refusé : aucun crédit câblé (edge)
Contexte: Yasmine saisit un code que le backend ne reconnaît pas.
Étant donné qu'elle valide « FG-NOPE »
Quand la réponse est { valid:false }
Alors le store reste vide (couponCode null, creditCents 0)
Et une alerte sobre s'affiche dans le champ.
