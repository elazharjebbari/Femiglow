# CPN-19 — Scénarios Gherkin : déterminisme du holdout

> Gate **G-HOLDOUT-DETERMINISM**. Bucketing pur :
> `bucket = hash(visitorKey + ':' + couponId) % 100 < holdoutPct ? 'holdout' : 'treatment'`.
> Pas d'horloge, pas de hasard. Le test cross-surface est l'acceptation centrale.

```gherkin
Feature: Le bucketing holdout est déterministe et stable affichage↔checkout
  En tant que système de mesure d'incrémentalité
  Je veux qu'un visiteur reçoive toujours le même bucket
  Afin que le prix affiché soit toujours le prix facturé

  # ── Bornes ────────────────────────────────────────────────────
  Scenario: holdoutPct à 0 ne met personne en contrôle
    Given un coupon avec holdoutPct 0
    When j'assigne le bucket de 1000 visiteurs distincts
    Then tous sont en "treatment"

  Scenario: holdoutPct à 100 met tout visiteur identifié en contrôle
    Given un coupon avec holdoutPct 100
    And 1000 visiteurs ayant chacun une visitorKey non vide
    When j'assigne leur bucket
    Then tous sont en "holdout"

  # ── visitorKey absent ─────────────────────────────────────────
  Scenario Outline: Sans clé stable, jamais de holdout
    Given un visiteur dont la visitorKey est <cle>
    And un coupon avec holdoutPct 100
    When j'assigne son bucket
    Then le bucket est "treatment"

    Examples:
      | cle          |
      | null         |
      | undefined    |
      | (vide)       |

  # ── Stabilité ─────────────────────────────────────────────────
  Scenario: Même visiteur, même coupon, 10000 appels, zéro variation
    Given la visitorKey "visitor-abc" et le coupon "welcome_auto" à holdoutPct 50
    When j'assigne le bucket 10000 fois
    Then je n'obtiens qu'une seule valeur de bucket

  Scenario: Visiteur cold puis returning sur la même session garde son bucket
    Given un visiteur "first" avec visitorKey "v-cold-42" exposé au coupon "welcome_auto" à holdoutPct 50
    And il devient "returning" en revenant plus tard avec la même visitorKey
    When j'assigne son bucket aux deux moments
    Then le bucket est identique
    # le bucket ne dépend que de (visitorKey, couponId, holdoutPct), pas du visitorType

  # ── Distribution ──────────────────────────────────────────────
  Scenario: holdoutPct 50 répartit ~moitié/moitié sur grand échantillon
    Given 10000 visitorKey distinctes et le coupon "welcome_auto" à holdoutPct 50
    When j'assigne tous les buckets
    Then la proportion en "holdout" est comprise entre 47% et 53%

  Scenario: holdoutPct 10 met ~10% en contrôle
    Given 10000 visitorKey distinctes et un coupon à holdoutPct 10
    When j'assigne tous les buckets
    Then la proportion en "holdout" est comprise entre 7% et 13%

  # ── Dépendance couponId ───────────────────────────────────────
  Scenario: Un visiteur peut être traité sur un coupon et contrôle sur un autre
    Given la visitorKey "v-multi" et holdoutPct 50
    When j'assigne son bucket pour le coupon "A" puis pour le coupon "B"
    Then les deux buckets peuvent différer
    # le hash inclut couponId : les splits ne sont pas corrélés entre campagnes

  # ── Robustesse ────────────────────────────────────────────────
  Scenario Outline: holdoutPct hors bornes est clampé sans erreur
    Given une visitorKey "k" et le coupon "c" à holdoutPct <pct>
    When j'assigne le bucket
    Then aucune exception n'est levée
    And le bucket est "<attendu>"

    Examples:
      | pct  | attendu   |
      | -5   | treatment |
      | 150  | holdout   |

  # ── Cross-surface (cœur du gate) ──────────────────────────────
  Scenario: Le bucket est identique à l'affichage et au checkout
    Given un coupon "welcome_auto" actif de -9000 centimes à holdoutPct 50
    And un visiteur de visitorKey "v-cross" classé "treatment"
    When resolveProductPricing est appelée côté affichage /kit
    And resolveProductPricing est appelée côté order-repo au repricing
    Then le bucket est "treatment" dans les deux cas
    And le prix effectif est 19900 dans les deux cas
    And aucune PriceMismatchError 422 n'est levée

  Scenario: Un visiteur en holdout paie le plein tarif des deux côtés
    Given un coupon "welcome_auto" actif de -9000 centimes à holdoutPct 50
    And un visiteur de visitorKey "v-hold" classé "holdout"
    When resolveProductPricing est appelée à l'affichage puis au checkout
    Then le bucket est "holdout" dans les deux cas
    And le prix effectif est 28900 dans les deux cas

  # ── Cache ─────────────────────────────────────────────────────
  Scenario: La décision de bucket n'est pas figée par le cache
    Given un coupon en cache via unstable_cache avec tag "coupons"
    When le tag "coupons" est invalidé puis le bucket recalculé pour la même visitorKey
    Then le bucket est inchangé pour les mêmes entrées
    And la valeur provient d'un recalcul déterministe, pas d'un bucket mis en cache par requête
```
