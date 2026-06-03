# CPN-20 — Scénarios métier (Gherkin)

> Seed du coupon `welcome_auto`. Point de vue **opérateur** (lance les seeders depuis l'admin) et **système** (boot/CI). Le seed doit être idempotent, reproductible, et produire 199 MAD en aval.

```gherkin
Feature: Seed idempotent du coupon welcome_auto (source de la promo /kit)

  Background:
    Given le seeder "coupons-welcome-auto" enregistré dans SEEDERS_REGISTRY
    And la variante kit avec priceCents=28900 et promoPriceCents=19900

  Scenario: L'opérateur seede un environnement neuf
    Given une base sans aucun coupon
    When l'opérateur lance le seeder "coupons-welcome-auto"
    Then exactement un coupon welcome_auto est créé
    And ce coupon a valueAmount=9000, mode=auto, code=null, currency=MAD
    And status=active, holdoutPct=0, eligibility={}, stackable=false
    And le résumé affiché évoque un "geste d'accueil" sans vocabulaire de promo

  Scenario: Le seeder est ré-entrant (pas de doublon)
    Given un coupon welcome_auto déjà seedé
    When l'opérateur relance le seeder
    Then aucun nouveau coupon n'est créé
    And le nombre de coupons welcome_auto reste 1

  Scenario: Trois exécutions laissent un état stable
    Given une base sans coupon
    When le seeder est exécuté trois fois de suite
    Then il reste exactement un coupon welcome_auto

  Scenario: Le seed remet les valeurs de référence si elles ont dérivé
    Given un coupon welcome_auto dont valueAmount a été altéré à 8000
    When l'opérateur relance le seeder
    Then le valueAmount est remis à 9000

  Scenario: Le seed respecte une mise en pause volontaire de l'opérateur
    Given un coupon welcome_auto que l'opérateur a mis en "paused" (rollback)
    When l'opérateur relance le seeder
    Then le statut reste "paused"
    And le coupon n'est pas réactivé de force

  Scenario: Le seed ne pose jamais de code sur un coupon auto
    Given une base sans coupon
    When le seeder est exécuté
    Then le coupon créé a code=null
    And il ne déclenche pas la contrainte unique partielle sur code

  Scenario: Cohérence aval — le moteur produit 199 MAD après seed
    Given le seeder "coupons-welcome-auto" appliqué
    When le système résout le prix de la variante kit
    Then le prix effectif est 19900 (199 MAD)
    And la source de prix est "coupon"
    And l'économie est de 9000 (90 MAD)

  Scenario: Seed lancé au boot sans acteur
    Given un démarrage applicatif sans utilisateur admin
    When le seed s'exécute avec actorId=null
    Then le coupon est créé avec createdBy=null

  Scenario: Idempotence garantie sur Postgres réel
    Given une base PGlite migrée 0080
    When le seeder est exécuté deux fois
    Then aucune violation de contrainte n'est levée
    And il reste exactement un coupon welcome_auto

  Scenario: Cohérence dual-driver
    Given le même seed exécuté via memoryStore() puis via Drizzle/PGlite
    When on compare l'état final
    Then les valeurs métier du coupon sont identiques (hors id et timestamps)

  Scenario: Exécution concurrente
    Given une base vide
    When deux exécutions du seed sont lancées en parallèle
    Then il ne reste qu'un seul coupon welcome_auto au final
```
