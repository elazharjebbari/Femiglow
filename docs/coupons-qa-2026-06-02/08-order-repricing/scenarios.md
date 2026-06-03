# CPN-08 — Scénarios Gherkin : repricing commande (coupon-aware)

> Parcours visiteur **bout-en-bout** : création lead → adresse → commande, plus
> les chemins d'erreur (422/409), la concurrence, l'idempotence et la course coupon.
> Prix canoniques (MAD, centimes) : prix nu kit = `28900`, promo de repli = `19900`,
> coupon welcome_auto = `−9000` (→ 19900). Phase 1 : `holdoutPct = 0` (tout treatment).

```gherkin
Feature: Le serveur facture exactement le prix affiché (coupon-aware)
  En tant que visiteur de /kit qui voit un geste d'accueil -90 MAD
  Je veux que ma commande soit facturée au prix que j'ai vu
  Afin de ne jamais subir un rejet 422 ni un débit incohérent

  Background:
    Given un coupon "welcome_auto" actif, mode auto, -90 MAD, holdout 0
    And le variant "kit" a un prix nu de 28900 centimes
    And un chat_lead existant dont l'adresse est finalisée
    And du stock disponible pour le kit

  # ── Parcours nominal bout-en-bout ─────────────────────────────
  Scenario: Commande COD au prix coupon, aucun 422
    Given le visiteur a vu le prix 19900 sur /kit (couponContext visitorKey "vk1")
    When il poste une commande avec expectedTotalCents 19900 et le même couponContext
    Then la réponse est 201
    And le statut est "pending_confirmation"
    And order.totalCents vaut 19900
    And order_items[0].unitPriceCents vaut 19900

  Scenario: Quantité 2 — total cohérent
    Given le visiteur commande 2 kits au prix coupon
    When il poste expectedTotalCents 39800
    Then la réponse est 201
    And order.totalCents vaut 39800

  # ── Fraude / total client incohérent ──────────────────────────
  Scenario: Le client envoie le prix nu alors que le coupon s'applique
    Given le serveur calcule 19900 (coupon treatment)
    When le client poste expectedTotalCents 28900
    Then la réponse est 422 avec code "price_mismatch"
    And details.expectedTotalCents vaut 28900
    And details.computedTotalCents vaut 19900
    And aucune commande n'est créée

  Scenario: Le client tente de sous-payer
    When le client poste expectedTotalCents 10000
    Then la réponse est 422 "price_mismatch"
    And details.computedTotalCents vaut 19900
    And aucune commande n'est créée

  Scenario: Le client falsifie unitPriceCents dans items
    When le client poste items unitPriceCents 100 mais expectedTotalCents 19900
    Then le serveur ignore le prix client et recalcule 19900
    And la réponse est 201
    And order_items[0].unitPriceCents vaut 19900

  # ── Course coupon entre affichage et commande ─────────────────
  Scenario: Coupon expiré mais la promo de repli couvre le prix
    Given le visiteur a vu 19900 (coupon)
    And le coupon expire avant la soumission
    And le variant garde promoPriceCents 19900
    When il poste expectedTotalCents 19900
    Then resolveProductPricing retombe sur la promo 19900
    And la réponse est 201
    And order.totalCents vaut 19900

  Scenario: Coupon expiré ET promo retirée — mismatch documenté
    Given le visiteur a vu 19900 (coupon)
    And le coupon expire ET promoPriceCents devient null
    When il poste expectedTotalCents 19900
    Then le serveur calcule 28900 (prix nu)
    And la réponse est 422 "price_mismatch"
    And details.computedTotalCents vaut 28900

  # ── Holdout ───────────────────────────────────────────────────
  Scenario: Phase 1 holdout 0 — tout le monde en treatment
    Given holdoutPct 0
    When n'importe quel visitorKey poste expectedTotalCents 19900
    Then la réponse est 201 (jamais la branche holdout)

  Scenario: Holdout théorique sert le prix de repli (Phase >= 2)
    Given holdoutPct 100 force le bucket holdout
    And l'affichage holdout montrait déjà la promo 19900
    When le visiteur poste expectedTotalCents 19900
    Then la réponse est 201
    And order.totalCents vaut 19900

  Scenario: Cross-surface — visitorKey divergent change le bucket
    Given Phase >= 2 avec holdoutPct 50 et promoPriceCents null
    And l'affichage a bucketé "vkA" en treatment (prix 19900 vu)
    When la commande envoie "vkB" qui tombe en holdout (prix nu 28900)
    Then la réponse est 422 "price_mismatch"
    # garde-fou : le checkout DOIT réutiliser le même visitorKey que l'affichage

  # ── SKU / stock ───────────────────────────────────────────────
  Scenario: SKU totalement inconnu
    When le client poste un item sku "zzz" sans fallback slug
    Then la réponse est 400 "invalid_input"
    And details.sku vaut "zzz"

  Scenario: Stock insuffisant
    Given le stock du kit est 0
    When le visiteur poste une commande valide à 19900
    Then la réponse est 409 "stock_insufficient"
    And details.sku vaut "kit"
    And aucune commande n'est persistée

  Scenario: Fallback slug "kit" vers variant primaire sous coupon-aware
    Given l'item porte sku "kit" qui est un slug produit (pas un SKU variant)
    When le client poste expectedTotalCents 19900
    Then le serveur résout slug -> variant primaire puis applique le coupon
    And la réponse est 201 à 19900

  # ── Idempotence / concurrence ─────────────────────────────────
  Scenario: Double POST avec la même Idempotency-Key
    Given une première commande 201 avec Idempotency-Key "k1"
    When le client renvoie exactement la même requête avec "k1"
    Then la réponse est 201 avec le même orderId
    And result.replayed vaut true
    And une seule commande existe
    And le stock n'est committé qu'une seule fois

  Scenario: Deux visiteurs se disputent le dernier kit
    Given le stock du kit est 1
    When deux commandes valides arrivent quasi simultanément
    Then exactement une réponse est 201
    And exactement une réponse est 409
    And une seule commande est créée

  # ── Parité legacy (rollback) ──────────────────────────────────
  Scenario: Aucun coupon en jeu — comportement legacy strict
    Given aucun coupon actif et promoPriceCents 19900
    When le client poste sans champ couponContext, expectedTotalCents 19900
    Then la réponse est 201 (identique au repricing legacy)
    And order.totalCents vaut 19900

  Scenario: Aucun coupon ni promo — prix nu facturé
    Given aucun coupon et promoPriceCents null
    When le client poste sans couponContext, expectedTotalCents 28900
    Then la réponse est 201
    And order.totalCents vaut 28900

  # ── Anti-double-remise ────────────────────────────────────────
  Scenario: Le coupon ne s'empile jamais sur promoPriceCents
    Given le coupon -90 et promoPriceCents 19900 coexistent
    When le visiteur commande à 19900
    Then la réponse est 201 à 19900 (jamais 10900 — pas de cumul)
```
