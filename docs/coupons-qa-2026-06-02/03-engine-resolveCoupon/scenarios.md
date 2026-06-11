# CPN-03 — Scénarios Gherkin : `resolveCoupon`

> server-only. Temps = `ctx.now` injecté. `resetMemoryStore()` entre scénarios.
> La sélection ne calcule aucun prix et n'applique aucun bucket holdout.

```gherkin
Feature: resolveCoupon sélectionne au plus un coupon applicable
  En tant que moteur de prix server-only
  Je veux filtrer puis trier les coupons candidats de façon déterministe
  Afin de choisir un seul gagnant ou aucun

  Background:
    Given le temps courant injecté est 2026-06-02T12:00:00.000Z
    And la devise du contexte est "MAD"

  # ── Statut ────────────────────────────────────────────────────
  Scenario: Seul un coupon actif est sélectionnable
    Given un coupon "c-active" en statut "active" éligible à tout le trafic
    And un coupon "c-draft" en statut "draft" mêmes critères
    When je résous le coupon
    Then le coupon retourné est "c-active"

  Scenario Outline: Les statuts non-actifs ne sont jamais sélectionnés
    Given un unique coupon en statut "<statut>" par ailleurs éligible
    When je résous le coupon
    Then le résultat est null

    Examples:
      | statut   |
      | draft    |
      | paused   |
      | archived |

  # ── Fenêtre de validité (bornes incluses) ─────────────────────
  Scenario: Avant l'ouverture la fenêtre exclut le coupon
    Given un coupon actif dont startsAt est 2026-06-03T00:00:00.000Z
    When je résous le coupon
    Then le résultat est null

  Scenario: La borne de début est inclusive
    Given un coupon actif dont startsAt est exactement 2026-06-02T12:00:00.000Z
    When je résous le coupon
    Then le coupon est retenu

  Scenario: La borne de fin est inclusive
    Given un coupon actif dont endsAt est exactement 2026-06-02T12:00:00.000Z
    When je résous le coupon
    Then le coupon est retenu

  Scenario: Après expiration le coupon est exclu
    Given un coupon actif dont endsAt est 2026-06-02T11:59:59.999Z
    When je résous le coupon
    Then le résultat est null

  Scenario: Fenêtre ouverte des deux côtés
    Given un coupon actif avec startsAt null et endsAt null
    When je résous le coupon
    Then le coupon est retenu quel que soit le temps courant

  # ── Éligibilité ───────────────────────────────────────────────
  Scenario: Éligibilité vide cible tout le trafic
    Given un coupon actif avec eligibility {}
    And un visiteur venant de "email"
    When je résous le coupon
    Then le coupon est retenu

  Scenario: Visiteur cold venant de paid_social, coupon ciblé paid_social
    Given un coupon actif avec eligibility {trafficSource:["paid_social"]}
    And un visiteur "first" venant de "paid_social"
    When je résous le coupon
    Then le coupon est retenu

  Scenario: Visiteur venant d'email, coupon ciblé paid_social
    Given un coupon actif avec eligibility {trafficSource:["paid_social"]}
    And un visiteur venant de "email"
    When je résous le coupon
    Then le résultat est null

  Scenario: Ciblage visiteur returning
    Given un coupon actif avec eligibility {visitorType:["returning"]}
    And un visiteur "returning"
    When je résous le coupon
    Then le coupon est retenu
    But un visiteur "first" donnerait null

  Scenario: Éligibilité multi-clés est un ET logique
    Given un coupon actif avec eligibility {trafficSource:["paid_social"], device:["mobile"]}
    And un visiteur venant de "paid_social" sur "desktop"
    When je résous le coupon
    Then le résultat est null

  Scenario: Clé non contrainte n'élimine pas
    Given un coupon actif avec eligibility {trafficSource:["paid_social"]}
    And un visiteur venant de "paid_social" sur "tablet"
    When je résous le coupon
    Then le coupon est retenu

  # ── Non-cumul & priorité ──────────────────────────────────────
  Scenario: Deux coupons actifs non-cumulables, la priorité départage
    Given un coupon "c-haut" actif non-stackable de priorité 10
    And un coupon "c-bas" actif non-stackable de priorité 5
    And les deux sont éligibles au visiteur
    When je résous le coupon
    Then un seul coupon est retourné
    And c'est "c-haut"

  Scenario: Priorités égales, le plus ancien gagne
    Given un coupon "c-mai01" actif priorité 10 créé le 2026-05-01
    And un coupon "c-mai02" actif priorité 10 créé le 2026-05-02
    When je résous le coupon
    Then le coupon retourné est "c-mai01"

  Scenario: Tie-break stable indépendant de l'ordre d'entrée
    Given deux coupons éligibles de priorité et createdAt identiques d'identifiants "c-a" et "c-b"
    When je résous le coupon avec l'ordre [c-b, c-a]
    And je résous le coupon avec l'ordre [c-a, c-b]
    Then les deux résolutions retournent "c-a"

  # ── Aucun candidat ────────────────────────────────────────────
  Scenario: Aucun coupon connu
    Given une liste de candidats vide
    When je résous le coupon
    Then le résultat est null

  # ── Robustesse ────────────────────────────────────────────────
  Scenario: Éligibilité corrompue ne fait pas planter
    Given un coupon actif dont eligibility n'est pas un objet valide
    When je résous le coupon
    Then aucune exception n'est levée
    And le coupon est ignoré

  # ── Neutralité vis-à-vis du holdout ───────────────────────────
  Scenario: La sélection ne dépend pas du holdoutPct
    Given un coupon actif éligible avec holdoutPct 0
    And le même coupon avec holdoutPct 100
    When je résous le coupon dans les deux cas avec le même visitorKey
    Then le même coupon gagnant est retourné
    # le bucketing treatment/holdout est appliqué en aval (CPN-04 / CPN-19)
```
