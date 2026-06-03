# CPN-02 — Scénarios Gherkin : `applyCoupon`

> Fonction pure. Les scénarios décrivent la math de prix observable, sans réseau
> ni horloge. Prix de base canonique : `28900` centimes (289 MAD).

```gherkin
Feature: applyCoupon transforme un coupon en PromoComputation
  En tant que moteur de prix
  Je veux fabriquer un prix candidat puis déléguer la garde à computePromo
  Afin que l'affichage et la caisse partagent la même vérité de prix

  Background:
    Given le prix de base du kit est 28900 centimes

  # ── Montant fixe ──────────────────────────────────────────────
  Scenario: Geste d'accueil -90 MAD (montant fixe)
    Given un coupon fixed_amount de valeur 9000
    When j'applique le coupon au prix 28900
    Then la promo est active
    And le prix effectif est 19900
    And l'économie est 9000 centimes
    And le pourcentage affiché est 31
    And le framing recommandé est "amount"

  Scenario: Montant fixe qui ramène exactement à zéro
    Given un coupon fixed_amount de valeur 28900
    When j'applique le coupon au prix 28900
    Then la promo n'est pas active
    And le prix effectif est 28900
    # candidat 0 -> garde computePromo "promo>0" -> refus ; jamais de kit gratuit

  Scenario: Montant fixe qui dépasse le prix
    Given un coupon fixed_amount de valeur 40000
    When j'applique le coupon au prix 28900
    Then le prix candidat planché vaut 0
    And la promo n'est pas active
    And le prix effectif est 28900
    # jamais de prix négatif facturé

  Scenario: Montant fixe nul
    Given un coupon fixed_amount de valeur 0
    When j'applique le coupon au prix 28900
    Then la promo n'est pas active
    And le prix effectif est 28900

  # ── Pourcentage ───────────────────────────────────────────────
  Scenario: Remise 10 pourcent
    Given un coupon percent de valeur 10
    When j'applique le coupon au prix 28900
    Then le prix effectif est 26010
    And l'économie est 2890 centimes
    And le pourcentage affiché est 10

  Scenario: Pourcentage avec arrondi non entier
    Given un coupon percent de valeur 33
    When j'applique le coupon au prix 28900
    Then le prix effectif est 19363
    And l'économie est 9537 centimes
    And le pourcentage affiché est 33

  Scenario: Pourcentage 100 (gratuit) refusé par la garde
    Given un coupon percent de valeur 100
    When j'applique le coupon au prix 28900
    Then le prix candidat vaut 0
    And la promo n'est pas active
    And le prix effectif est 28900

  Scenario: Pourcentage 0 sans effet
    Given un coupon percent de valeur 0
    When j'applique le coupon au prix 28900
    Then la promo n'est pas active
    And le prix effectif est 28900

  # ── Saisies incohérentes : jamais d'exception ─────────────────
  Scenario Outline: Entrée incohérente dégrade silencieusement vers le prix plein
    Given un coupon <kind> de valeur <value>
    When j'applique le coupon au prix 28900
    Then aucune exception n'est levée
    And la promo n'est pas active
    And le prix effectif est 28900

    Examples:
      | kind         | value |
      | percent      | NaN   |
      | percent      | 150   |
      | fixed_amount | -5000 |

  # ── Frontière de responsabilité avec resolveCoupon ────────────
  Scenario: applyCoupon ignore le statut et la fenêtre de validité
    Given un coupon fixed_amount de valeur 9000 dont le statut est "archived" et la fenêtre expirée
    When j'applique le coupon au prix 28900
    Then le résultat est identique à celui d'un coupon "active" de mêmes valueKind et valueAmount
    # la sélection (statut/fenêtre/éligibilité) est la responsabilité de resolveCoupon (CPN-03)

  # ── Framing selon la taille du panier (Kolenda #34) ───────────
  Scenario: Petit panier privilégie le pourcentage
    Given le prix de base est 800 centimes
    And un coupon percent de valeur 25
    When j'applique le coupon
    Then l'économie est 200 centimes
    And le framing recommandé est "percent"
    # 200/100 = 2.00 < 25 -> on montre le digit le plus grand (le %)
```
