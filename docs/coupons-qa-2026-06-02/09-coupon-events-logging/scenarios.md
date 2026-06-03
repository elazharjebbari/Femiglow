# CPN-09 — Scénarios Gherkin : journalisation des événements coupon

> Le funnel d'incrémentalité : `exposed` (vu) → `applied` (remise affichée) →
> `converted` (commande aboutie). L'invariant d'idempotence : **un seul
> `converted` par commande**, et **jamais** d'event qui bloque la commande.
> Coupon welcome_auto −90 MAD → `amountCents` (remise) = `9000`.

```gherkin
Feature: Journaliser les événements coupon sans double compter ni bloquer
  En tant que système de mesure d'incrémentalité
  Je veux un journal append-only fiable et anonyme
  Afin de mesurer treatment vs holdout sans fausser le ROAS ni perdre de commande

  Background:
    Given un coupon "welcome_auto" actif, mode auto, -90 MAD, holdout 0
    And la table coupon_events est vide (resetMemoryStore)

  # ── Exposition / application à l'affichage ────────────────────
  Scenario: Affichage /kit avec coupon candidat émet exposed
    Given un visiteur "vk1" charge /kit
    When le coupon est sélectionné comme candidat
    Then au moins un événement "exposed" est journalisé pour "vk1"
    And l'événement porte un bucket cohérent (treatment en Phase 1)

  Scenario: Le prix coupon affiché émet applied
    Given le visiteur "vk1" est en bucket treatment
    When le prix -90 MAD est effectivement affiché
    Then un événement "applied" est journalisé
    And son bucket est "treatment"

  # ── Conversion ────────────────────────────────────────────────
  Scenario: Commande réussie émet exactement un converted
    Given le visiteur "vk1" a vu le coupon
    When sa commande aboutit en 201 (orderId "o1")
    Then exactement un événement "converted" est journalisé pour "o1"
    And amountCents vaut 9000 (la remise, pas le total payé)
    And bucket vaut "treatment"
    And orderId vaut "o1"

  Scenario: Double soumission idempotente n'émet pas de second converted
    Given une première commande 201 (Idempotency-Key "k1") a émis un converted
    When le client renvoie la même requête avec "k1" (replay)
    Then aucun second "converted" n'est journalisé
    And il n'existe qu'un seul converted pour cet orderId

  Scenario: Double appel direct record converted même orderId
    Given un converted existe déjà pour orderId "o1"
    When record('converted', orderId "o1") est rappelé
    Then le second appel retourne inserted false
    And il n'existe toujours qu'une ligne converted pour "o1"

  # ── Aucun converted sur échec ─────────────────────────────────
  Scenario: Échec 422 price_mismatch n'émet pas de converted
    When une commande est rejetée en 422 price_mismatch
    Then aucun événement "converted" n'est journalisé

  Scenario: Échec 409 stock n'émet pas de converted
    When une commande est rejetée en 409 stock_insufficient
    Then aucun événement "converted" n'est journalisé

  Scenario: Échec 400 SKU inconnu n'émet pas de converted
    When une commande est rejetée en 400 invalid_input
    Then aucun événement "converted" n'est journalisé

  # ── Fire-and-forget : jamais bloquant ─────────────────────────
  Scenario: L'insert de l'événement échoue mais la commande réussit
    Given le repo coupon_events est en panne (insert rejette)
    When une commande valide est postée
    Then la réponse reste 201 avec un orderId
    And l'erreur est loggée "coupon.event.converted.failed"
    And aucune exception n'est remontée au client

  # ── Holdout ───────────────────────────────────────────────────
  Scenario: Conversion en holdout garde l'attribution sans remise
    Given un visiteur en bucket holdout (Phase >= 2) a commandé
    When la commande aboutit en 201
    Then un converted est journalisé avec bucket "holdout"
    And amountCents vaut 0 (la remise coupon n'a pas été servie)
    And couponId reste renseigné (attribution conservée)

  # ── Cohérence & anonymat ──────────────────────────────────────
  Scenario: Le bucket est cohérent entre exposed et converted
    Given un visiteur "vk1" voit le coupon puis convertit
    Then le bucket de l'exposed égale le bucket du converted

  Scenario: Aucune donnée personnelle dans le journal
    Given un lead avec email "sara@example.com" et téléphone "+212600000001"
    When sa commande émet un converted
    Then la ligne ne contient ni email, ni téléphone, ni nom
    And visitorKey est un hash anonyme

  Scenario: Visiteur anonyme sans cookie
    Given aucun visitorKey n'est disponible
    When un événement est émis
    Then il est journalisé avec visitorKey null sans erreur

  # ── Agrégation ────────────────────────────────────────────────
  Scenario: Le comptage par phase et bucket est exact
    Given 2 exposed, 1 applied et 1 converted en treatment
    When on agrège countByPhaseAndBucket(coupon)
    Then exposed.treatment vaut 2
    And applied.treatment vaut 1
    And converted.treatment vaut 1
    And un replay de commande ne modifie pas converted.treatment

  # ── Parcours abandonné ────────────────────────────────────────
  Scenario: Abandon avant commande
    Given un visiteur "vk1" voit le coupon sur /kit
    When il quitte sans commander
    Then il existe au moins un exposed pour "vk1"
    And aucun converted pour "vk1"
```
