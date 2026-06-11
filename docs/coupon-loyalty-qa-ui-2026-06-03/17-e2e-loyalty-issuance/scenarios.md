# Scénarios F17 — Parcours client fidélité (Gherkin FR)

Persona : **Yasmine**, visiteuse anonyme qui découvre FemiGlow et passe sa première commande
en paiement à la livraison (COD).

Précondition globale : un template `post_purchase` est **actif** (seed `seed-coupons.ts`).

## Scénario F17-S1 — Yasmine commande et reçoit son code de fidélité (happy)

Contexte : Yasmine remplit le wizard de bout en bout avec un téléphone unique pour ce run.

```
Étant donné que Yasmine ouvre /kit et déroule jusqu'au wizard
  Et qu'un template de fidélité post_purchase est actif
Quand elle renseigne son prénom « Yasmine », un téléphone unique, et coche le consentement
  Et clique sur le bouton de validation du lead
Alors l'étape adresse s'affiche
Quand elle choisit « Casablanca » dans l'autocomplétion ville
  Et renseigne son adresse
  Et clique sur « Confirmer »
Alors la commande est créée (POST /api/checkout/order répond avec un orderId)
  Et l'écran de remerciement "wizard-step-thankyou" s'affiche
  Et la carte "loyalty-code-card" est visible
  Et "loyalty-code-value" affiche un code de la forme « FG-…-NNNN »
  Et la carte mentionne « valable 60 jours » avec une date d'activation civile
```

## Scénario F17-S2 — Aucune fuite du numéro de téléphone (edge PII)

Contexte : le code de fidélité est lié au numéro de Yasmine, mais ne doit jamais l'exposer.

```
Étant donné que Yasmine vient de recevoir son code de fidélité
Quand on lit l'intégralité du texte de l'écran de remerciement
Alors le numéro de téléphone qu'elle a saisi n'y apparaît nulle part en clair
  Et seul le code « FG-… » est visible
```

## Scénario F17-S3 — Date d'activation civile, jamais de compte à rebours (edge charte/activation)

Contexte : la maison annonce une disponibilité posée, pas une urgence.

```
Étant donné que Yasmine a choisi une ville avec un ETA connu (Casablanca ~48-72h)
Quand la carte de fidélité s'affiche
Alors elle indique « Utilisable à partir du <jour mois> »
  Et « valable 60 jours »
  Et n'affiche ni compte à rebours, ni minutes/secondes, ni emoji ⏰
  (activatesAt = date commande + délai max livraison + 1 jour)
```

## Scénario F17-S4 — Template de fidélité absent, parcours non bloqué (edge seed)

Contexte : sur un environnement où le template `post_purchase` n'est pas actif.

```
Étant donné qu'aucun template post_purchase actif n'existe
Quand Yasmine termine sa commande
Alors la commande réussit quand même (émission best-effort, non bloquante)
  Et aucune carte "loyalty-code-card" n'est rendue
  Et ce résultat est traité comme une PRÉCONDITION de seed manquante, pas comme un bug
```
