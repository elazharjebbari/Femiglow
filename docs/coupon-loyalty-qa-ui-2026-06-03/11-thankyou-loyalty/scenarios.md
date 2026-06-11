# F11 — Scénarios (Gherkin FR)

Persona : **Yasmine** (cliente qui vient de finaliser sa commande). Le store est seedé via
`useWizardStore.setState`, `useOrderEmailConfirmationMutation` est mockée, `navigator.clipboard` est
mocké. Le code de fidélité est lié à son numéro côté backend mais le numéro n'est jamais affiché.

## Scénario F11-S1 — Yasmine reçoit son code de fidélité (happy)
Contexte: la commande est passée, le backend a émis « FG-SAUGE-7212 » valant 20 MAD, activable le 10 juin.
Étant donné que le store contient loyalty = { code, valueCents:2000, activatesAt:'2026-06-10' }
Quand l'écran de remerciement s'affiche
Alors la carte de fidélité apparaît avec le code « FG-SAUGE-7212 »
Et la valeur « 20 MAD » s'affiche en terracotta
Et une ligne « Utilisable à partir du 10 juin · valable 60 jours. » est présente.

## Scénario F11-S2 — Pas de code émis (edge / absence)
Contexte: la commande n'a pas généré de code (template inactif).
Étant donné que le store contient loyalty = null
Quand l'écran s'affiche
Alors aucune carte de fidélité n'est rendue
Et le reste de l'écran (réf order, opt-in email) reste fonctionnel.

## Scénario F11-S3 — Yasmine copie son code (happy)
Contexte: la carte est affichée.
Étant donné qu'elle clique sur « Copier »
Quand le clic est traité
Alors navigator.clipboard.writeText reçoit « FG-SAUGE-7212 »
Et le bouton affiche « Copié » temporairement.

## Scénario F11-S4 — Code sans date d'activation (edge / null)
Contexte: le backend n'a pas encore figé la date d'activation.
Étant donné loyalty.activatesAt = null
Quand la carte s'affiche
Alors aucune ligne « Utilisable à partir » n'apparaît
Et le code et la valeur restent lisibles.

## Scénario F11-S5 — Le téléphone n'apparaît jamais (edge / INV-PII)
Contexte: le code est lié au numéro de Yasmine côté backend.
Étant donné que l'écran de remerciement est rendu avec la carte
Quand on lit tout le texte de l'écran
Alors aucune séquence de six chiffres consécutifs (numéro) n'est présente.

## Scénario F11-S6 — Parcours en arabe (edge / i18n RTL)
Contexte: Yasmine navigue en arabe.
Étant donné que le store a language = 'ar'
Quand la carte s'affiche
Alors elle est en dir="rtl"
Et le bouton de copie affiche « نسخ »
Et la valeur contient « درهم ».
