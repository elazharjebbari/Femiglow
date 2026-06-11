# CPN-07 — Scénarios Gherkin : snapshot panier coupon-aware

> Gate **G-PRICE-PARITY**. Le `totalCents` du snapshot est la promesse de prix ;
> `order-repo` reprice et rejette en 422 toute divergence. Helper PUR, appelant
> coupon-aware. Prix : 199 (effectif coupon) / 289 (plein).

```gherkin
Feature: Le snapshot panier porte le prix coupon et reste égal au total facturé
  En tant que visiteuse qui ajoute le Kit au panier
  Je veux que le total affiché dans le récap soit exactement ce que je paierai
  Afin de ne jamais être bloquée par une erreur de prix au paiement

  Background:
    Given le coupon "welcome_auto" est actif (-90 MAD, holdout 0)
    And le kit est au prix régulier de 289 MAD

  # ── Nominal qty 1 ──────────────────────────────────────────────
  Scenario: Le snapshot d'un kit porte le prix remisé et le barré
    Given je commande 1 kit sur "/kit"
    When le snapshot panier est projeté
    Then le prix unitaire est 19900 centimes
    And le prix barré (compareAt) est 28900 centimes
    And le total est 19900 centimes
    And le total barré est 28900 centimes

  # ── Quantité multiple ──────────────────────────────────────────
  Scenario Outline: Le total suit la quantité
    Given je commande <qty> kits avec le coupon actif
    When le snapshot est projeté
    Then le total est <total> centimes
    And le total barré est <compareTotal> centimes
    And le prix unitaire reste 19900 centimes

    Examples:
      | qty | total | compareTotal |
      | 1   | 19900 | 28900        |
      | 2   | 39800 | 57800        |
      | 3   | 59700 | 86700        |

  # ── Sans coupon ────────────────────────────────────────────────
  Scenario: Sans coupon, le snapshot porte le plein tarif sans barré
    Given le coupon "welcome_auto" est en pause
    When je commande 1 kit et que le snapshot est projeté
    Then le prix unitaire est 28900 centimes
    And il n'y a pas de prix barré (compareAt undefined)
    And le total barré est undefined

  # ── Garde data incohérente ─────────────────────────────────────
  Scenario Outline: Une promo incohérente n'altère pas le snapshot
    Given une valeur de promo de <raw> centimes sur un prix de 28900
    When le snapshot est projeté
    Then le prix unitaire est 28900 centimes
    And il n'y a pas de prix barré

    Examples:
      | raw   |
      | 28900 |
      | 30000 |
      | 0     |
      | -100  |

  # ── Pureté de l'appelant ───────────────────────────────────────
  Scenario: L'appelant injecte le prix effectif résolu par le moteur
    Given le coupon résout un prix effectif de 19900 centimes
    When KitCommanderSectionBound projette le snapshot
    Then il appelle resolveProductPricing avant de projeter
    And il passe au helper promoPriceCents = 19900 (effectif), pas une constante

  # ── Cross-surface (cœur du gate) ───────────────────────────────
  Scenario: Le total du snapshot est exactement le total reprice
    Given un visiteur classé "treatment" pour le coupon actif
    When le snapshot projette un total
    And order-repo recalcule le total côté serveur pour le même contexte
    Then les deux totaux sont strictement égaux (19900)
    And aucune erreur 422 PriceMismatch n'est levée

  Scenario: Un visiteur sans coupon a un snapshot égal au reprice plein tarif
    Given le coupon est désactivé
    When le snapshot projette 28900 et order-repo reprice
    Then les deux totaux valent 28900
    And aucune erreur 422 n'est levée

  # ── Anti-fraude ────────────────────────────────────────────────
  Scenario: Un total client falsifié est rejeté côté serveur
    Given je manipule le total côté client pour qu'il vaille 1000 centimes
    When je soumets la commande
    Then le serveur recalcule et détecte la divergence
    And la commande est rejetée en 422 PriceMismatch
    And rien n'est facturé
```
