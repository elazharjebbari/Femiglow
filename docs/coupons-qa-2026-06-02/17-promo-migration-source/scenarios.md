# CPN-17 — Scénarios métier (Gherkin)

> Bascule de la promo `/kit` : le coupon `welcome_auto` devient la source, `promoPriceCents` redevient un fallback. Point de vue **opérateur** (active/pause/archive) et **visiteur** (prix affiché == prix facturé). Montants en MAD ; centimes entre parenthèses.

```gherkin
Feature: Bascule promo /kit vers source coupon avec fallback de sécurité

  Background:
    Given la variante kit avec priceCents=28900 (289 MAD)
    And promoPriceCents=19900 (199 MAD) conservé comme fallback

  # ---------- Les 5 scénarios critiques ----------

  Scenario: 1 - Coupon actif et fallback présent (pas de double remise)
    Given un coupon welcome_auto actif d'une valeur de 9000 centimes
    And promoPriceCents vaut 19900
    When le système résout le prix produit
    Then le prix effectif est 19900 (199 MAD)
    And la source de prix est "coupon"
    And le prix effectif n'est PAS 10900 (pas d'empilement sur le prix promo)

  Scenario: 2 - Coupon actif sans fallback
    Given un coupon welcome_auto actif d'une valeur de 9000 centimes
    And promoPriceCents vaut null
    When le système résout le prix produit
    Then le prix effectif est 19900 (199 MAD)
    And la source de prix est "coupon"

  Scenario: 3 - Coupon en pause, fallback présent
    Given un coupon welcome_auto en statut "paused"
    And promoPriceCents vaut 19900
    When le système résout le prix produit
    Then le prix effectif est 19900 (199 MAD)
    And la source de prix est "promoPrice"

  Scenario: 4 - Coupon en pause, pas de fallback (prix nu)
    Given un coupon welcome_auto en statut "paused"
    And promoPriceCents vaut null
    When le système résout le prix produit
    Then le prix effectif est 28900 (289 MAD)
    And la source de prix est "none"
    And aucune promotion n'est active

  Scenario: 5 - Coupon actif mais montant incohérent (>= prix)
    Given un coupon welcome_auto actif d'une valeur de 28900 centimes
    And promoPriceCents vaut 19900
    When le système résout le prix produit
    Then le coupon est jugé inapplicable (le prix résultant n'est pas < prix de base)
    And le prix effectif retombe sur le fallback 19900 (199 MAD)
    And la source de prix est "promoPrice"

  # ---------- Invariant prix affiché == prix facturé ----------

  Scenario: Le visiteur paie exactement le prix affiché (coupon actif)
    Given un coupon welcome_auto actif de 9000 centimes
    And le visiteur voit 199 MAD sur /kit
    When il ajoute le kit au panier et valide la commande COD
    Then le snapshot panier vaut 19900
    And le repricing serveur accepte le total 19900
    And la commande est créée avec totalCents=19900 (HTTP 201)

  Scenario: Le serveur rejette un total falsifié issu d'une double remise
    Given un coupon welcome_auto actif de 9000 centimes
    When une commande est soumise avec un total attendu de 10900
    Then le repricing recalcule 19900
    And la commande est rejetée (HTTP 422, PriceMismatchError)

  # ---------- Opérateur : bascule & rollback ----------

  Scenario: L'opérateur active le coupon source
    Given le coupon welcome_auto en statut "draft" et promoPriceCents=19900
    And /kit affiche 199 MAD via le fallback
    When l'opérateur passe le coupon en "active"
    Then /kit affiche toujours 199 MAD
    But la source de prix devient "coupon" (re-scénarisation en geste d'accueil)
    And le visiteur ne perçoit aucun changement de prix

  Scenario: Rollback trivial par mise en pause
    Given le coupon welcome_auto actif et promoPriceCents=19900
    When l'opérateur met le coupon en "paused"
    Then /kit affiche 199 MAD via le fallback promoPriceCents
    And la variante n'a pas été modifiée (promoPriceCents reste 19900)
    And aucun déploiement n'est nécessaire

  Scenario: Retrait total de la promotion
    Given le coupon welcome_auto en "archived"
    And promoPriceCents retiré (null)
    When le visiteur consulte /kit
    Then le prix affiché est 289 MAD (prix nu)
    And aucun prix barré n'est montré

  # ---------- Résilience ----------

  Scenario: Une erreur de résolution coupon ne casse pas l'affichage
    Given le moteur resolveCoupon lève une exception
    And promoPriceCents vaut 19900
    When le système résout le prix produit
    Then l'exception est capturée
    And le prix effectif retombe sur 19900 (fallback)
    And l'UI publique ne plante pas
```
