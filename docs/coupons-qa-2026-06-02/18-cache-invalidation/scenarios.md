# CPN-18 — Scénarios Gherkin : cache & invalidation des coupons

> Couche cache (`unstable_cache` tag `'coupons'`) + invalidation
> (`revalidateTag('coupons')`) + interaction ISR (`/kit revalidate=1800`) +
> bucket NON caché. Temps = `ctx.now` injecté. `resetMemoryStore()` entre
> scénarios. Prix : plein 28900, promo classique 19900, coupon -9000.

```gherkin
Feature: Le cache sert des définitions fraîches et n'expose jamais le bucket
  En tant que système de prix
  Je veux cacher la définition des coupons mais ré-évaluer la validité et le bucket
  Afin de servir un prix correct, isolé par visiteur, sans coupon périmé

  Background:
    Given le temps courant injecté est 2026-06-02T12:00:00.000Z
    And le prix plein est 28900 centimes et la promo classique 19900 centimes

  # ── Mise en cache de la définition ────────────────────────────
  Scenario: Deux lectures rapprochées ne touchent la base qu'une fois
    Given un coupon actif en base
    When je lis les candidats deux fois sans mutation entre les deux
    Then la base n'est interrogée qu'une seule fois
    And les deux lectures renvoient la même définition

  # ── Validité ré-évaluée malgré le cache ───────────────────────
  Scenario: Un coupon expiré n'est jamais servi même si sa définition est en cache
    Given un coupon dont endsAt est 2026-06-01T00:00:00.000Z et dont la définition est en cache
    When je résous le coupon à 2026-06-02T12:00:00.000Z
    Then aucun coupon n'est sélectionné
    And le prix retombe sur la promo classique 19900

  Scenario: La validité suit le temps sans nécessiter d'invalidation
    Given un coupon dont endsAt est 2026-06-02T12:00:00.000Z et dont la définition est en cache
    When je résous à 11:00 puis à 13:00 sans invalider le cache
    Then la résolution de 11:00 sélectionne le coupon
    But la résolution de 13:00 ne le sélectionne plus

  # ── Invalidation sur mutation admin ───────────────────────────
  Scenario: Une mutation admin réussie émet exactement une invalidation
    Given un opérateur admin authentifié
    When il crée, édite, active, met en pause ou archive un coupon avec succès
    Then revalidateTag est appelé exactement une fois avec "coupons"

  Scenario: Une mutation admin échouée n'invalide pas le cache
    Given une mutation admin dont la persistance échoue
    When la mutation se termine en erreur
    Then revalidateTag n'est pas appelé

  Scenario: Activer un coupon le rend visible sous le délai d'invalidation
    Given un coupon en statut "draft" dont la définition est en cache
    When l'opérateur l'active puis revalidateTag("coupons") est appelé
    And je résous à nouveau
    Then le coupon est sélectionné
    And /kit reflète le geste d'accueil sans attendre la fenêtre ISR de 1800 s

  Scenario: Mettre en pause fait retomber le prix sur la promo immédiatement
    Given un coupon "active" servi en treatment et sa définition en cache
    When l'opérateur le met en pause puis revalidateTag("coupons") est appelé
    And je résous le pricing produit
    Then aucun coupon n'est sélectionné
    And le prix effectif est 19900 et le champ coupon est null

  # ── Bucket jamais caché / isolation visiteurs ─────────────────
  Scenario: Deux visiteurs sur la même définition cachée ont des buckets indépendants
    Given une définition de coupon en cache avec holdoutPct 50
    And deux visiteurs avec des visitorKey distincts
    When je décide le bucket de chacun
    Then chaque bucket est calculé par requête à partir du visitorKey courant
    And aucun bucket n'est stocké dans le cache partagé

  Scenario: L'entrée de cache des coupons ne contient aucune donnée visiteur
    Given une définition de coupon en cache
    When j'inspecte le contenu sérialisé de l'entrée "coupons"
    Then il ne contient ni visitorKey, ni bucket, ni donnée personnelle

  # ── Tags indépendants ─────────────────────────────────────────
  Scenario: Invalider les coupons ne purge pas les produits ni la config
    Given des caches actifs taggés "coupons", "products" et "app-config"
    When revalidateTag("coupons") est appelé
    Then seuls les coupons sont invalidés
    And "products" et "app-config" restent intacts

  # ── ISR vs invalidation ───────────────────────────────────────
  Scenario: Une invalidation ciblée prime sur la fenêtre ISR de 1800 s
    Given la page /kit servie depuis le cache ISR
    When revalidateTag("coupons") est appelé suite à une activation
    Then le prochain rendu reflète la nouvelle définition sans attendre 1800 s

  # ── Robustesse ────────────────────────────────────────────────
  Scenario: Un échec de lecture lors d'un cache miss retombe silencieusement
    Given un cache miss et une base de données indisponible
    When je résous le pricing produit
    Then aucune exception n'est levée
    And le prix retombe sur la promo classique 19900 avec coupon null

  # ── Sécurité ──────────────────────────────────────────────────
  Scenario: Un parcours visiteur ne peut pas déclencher d'invalidation
    Given un visiteur sur /kit ou sur /api/checkout/order
    When la requête est traitée
    Then revalidateTag n'est jamais appelé sur ce parcours
```
