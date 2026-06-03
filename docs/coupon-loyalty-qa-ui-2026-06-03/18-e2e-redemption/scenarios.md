# Scénarios F18 — Redemption client (Gherkin FR)

Persona : **Yasmine**, cliente fidèle qui revient avec un code reçu lors d'une commande
précédente.

Précondition globale BLOQUANTE : le code utilisé est **déjà activé** (`activatesAt` dans le
passé) — voir `spec.md` §« Précondition BLOQUANTE ». Pour ces scénarios, le code de référence
est `FG-SAUGE-7212`, activé via `scripts/_loyalty-activate-now.ts`.

## Scénario F18-S1 — Yasmine applique son crédit et commande moins cher (happy)

Contexte : Yasmine a reçu son code il y a quelques jours ; il est désormais utilisable.

```
Étant donné que Yasmine est à l'étape adresse du wizard
  Et qu'elle possède un code de fidélité activé valant 20 MAD
Quand elle clique sur « J'ai un code de fidélité » (summary de la disclosure coupon)
Alors le champ "invitation-code-field" apparaît
Quand elle saisit son code et clique sur « Appliquer »
Alors POST /api/coupons/redeem répond { valid:true, valueCents:2000 }
  Et "invitation-code-ok" affiche « Crédit de 20 MAD appliqué — déduit au paiement. »
  Et "wizard-credit-line" affiche « Crédit fidélité −20 MAD »
  Et "wizard-cart-recap-total" passe de « 199 MAD » à « 179 MAD »
Quand elle clique sur « Confirmer »
Alors POST /api/checkout/order répond 201 (expectedTotalCents = 17900, aucun 422)
  Et l'écran "wizard-step-thankyou" s'affiche
```

## Scénario F18-S2 — Code pas encore actif (edge délai d'activation, le piège central)

Contexte : Yasmine essaie d'utiliser un code reçu tout récemment, avant le délai d'activation.

```
Étant donné que Yasmine possède un code dont activatesAt est dans le futur (not_yet_active)
Quand elle le saisit et clique « Appliquer »
Alors POST /api/coupons/redeem répond { valid:false, reason:'not_yet_active' }
  Et "invitation-code-ko" affiche « Code introuvable ou expiré. »
  Et aucune "wizard-credit-line" n'apparaît
  Et le total reste « 199 MAD »
```

## Scénario F18-S3 — Ré-édition après validation, le crédit s'efface (edge anti-stale)

Contexte : Yasmine modifie son code après l'avoir validé.

```
Étant donné que Yasmine a appliqué un crédit valide (total = 179 MAD)
Quand elle modifie un caractère du code dans le champ
Alors le statut repasse à idle (onClear → clearCoupon)
  Et "wizard-credit-line" disparaît
  Et "wizard-cart-recap-total" revient à « 199 MAD »
  Et elle doit re-valider avant de pouvoir commander avec le crédit
```

## Scénario F18-S4 — Frontière < 3 caractères (edge validation)

Contexte : Yasmine commence à taper son code.

```
Étant donné que la disclosure coupon est ouverte
Quand Yasmine a saisi seulement « FG » (2 caractères)
Alors le bouton « Appliquer » est désactivé
  Et aucun appel POST /api/coupons/redeem n'est émis
```
