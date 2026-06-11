# CPN-04 — Scénarios Gherkin : `resolveProductPricing`

> server-only. Composition `resolveCoupon` + `applyCoupon` + bucketing, avec
> fallback `computePromo`. Temps = `ctx.now` injecté. `resetMemoryStore()` entre
> scénarios. Prix de référence : plein 28900 (289 MAD), promo classique 19900
> (199 MAD), coupon welcome_auto = -9000 (-90 MAD).

```gherkin
Feature: resolveProductPricing compose prix coupon-aware avec fallback promo
  En tant que moteur de prix server-only
  Je veux produire un ResolvedPricing identique à l'affichage et au repricing
  Afin de garantir l'invariant prix affiché == prix facturé

  Background:
    Given le temps courant injecté est 2026-06-02T12:00:00.000Z
    And la devise du contexte est "MAD"
    And le prix plein est 28900 centimes
    And la promo classique de repli est 19900 centimes

  # ── Chemin coupon (treatment) ─────────────────────────────────
  Scenario: Un visiteur en treatment voit la remise du coupon
    Given un coupon "welcome_auto" actif de type amount -9000 éligible à tout le trafic
    And le visiteur est bucketé en "treatment"
    When je résous le pricing produit
    Then le prix effectif est 19900 centimes
    And la remise est active
    And le champ coupon n'est pas null
    And coupon.bucket vaut "treatment"
    And coupon.id vaut "welcome_auto"

  Scenario: La forme PromoComputation est strictement préservée
    Given un coupon actif appliqué en treatment
    When je résous le pricing produit
    Then le résultat contient exactement les champs active, effectivePriceCents, originalPriceCents, savingsCents, savingsPct, framing et coupon
    And aucun champ surnuméraire n'est présent

  # ── Chemin fallback (aucun coupon) ────────────────────────────
  Scenario: Sans coupon applicable on retombe sur la promo classique
    Given aucun coupon candidat applicable
    When je résous le pricing produit
    Then le résultat est égal champ par champ à computePromo(28900, 19900)
    And le prix effectif est 19900 centimes
    And le champ coupon est null

  Scenario: Sans coupon ni promo on sert le plein tarif
    Given aucun coupon candidat applicable
    And la promo classique de repli est null
    When je résous le pricing produit
    Then la remise est inactive
    And le prix effectif est 28900 centimes
    And le champ coupon est null

  # ── Chemin holdout (Phase 2/3, contrat testé dès Phase 1) ──────
  Scenario: Un visiteur en holdout ne voit pas la remise coupon
    Given un coupon "welcome_auto" actif sélectionné
    And le visiteur est bucketé en "holdout"
    When je résous le pricing produit
    Then le prix effectif est celui de computePromo(28900, 19900)
    And le champ coupon n'est pas null
    And coupon.bucket vaut "holdout"
    # le coupon reste attribué (stats incrémentalité) mais le prix est le repli

  Scenario: Holdout sans promo de repli sert le plein tarif tout en attribuant le coupon
    Given un coupon actif sélectionné
    And le visiteur est bucketé en "holdout"
    And la promo classique de repli est null
    When je résous le pricing produit
    Then le prix effectif est 28900 centimes
    And le champ coupon n'est pas null avec bucket "holdout"

  Scenario: En Phase 1 le holdout est à 0 donc tout le monde est en treatment
    Given un coupon actif avec holdoutPct 0
    When je résous le pricing produit pour 50 visitorKeys distincts
    Then chaque résolution donne coupon.bucket "treatment"

  Scenario: Un visiteur sans visitorKey est servi en treatment
    Given un coupon actif sélectionné avec holdoutPct 50
    And le visiteur n'a pas de visitorKey
    When je résous le pricing produit
    Then coupon.bucket vaut "treatment"

  # ── Robustesse / fallback silencieux ──────────────────────────
  Scenario: Une indisponibilité base de données retombe silencieusement sur la promo
    Given le chargement des coupons candidats a échoué et la liste est vide
    When je résous le pricing produit
    Then aucune exception n'est levée
    And le résultat est égal à computePromo(28900, 19900)
    And le champ coupon est null

  Scenario: Une remise supérieure au prix ne produit jamais un prix négatif
    Given un coupon actif de type amount -40000 appliqué en treatment
    When je résous le pricing produit
    Then le prix effectif est supérieur ou égal à 0

  # ── Invariant maître affichage == caisse ──────────────────────
  Scenario: Le même input et contexte donnent le même prix à l'affichage et au repricing
    Given un contexte coupon identique construit à l'affichage et au repricing
    When je résous le pricing produit aux deux points
    Then le prix effectif est identique aux deux appels
    # c'est exactement ce qui évite le PriceMismatchError 422

  # ── Opérateur : bascule promo -> coupon (lien CPN-17) ─────────
  Scenario: L'opérateur active le coupon, la source de la promo devient le coupon
    Given la promo /kit provenait de promoPriceCents 19900
    When un coupon welcome_auto -9000 devient actif et le visiteur est en treatment
    Then le prix effectif reste 19900 mais le champ coupon n'est plus null
    And la désactivation du coupon ramène coupon null avec le même prix 19900 (rollback trivial)
```
