# CPN-05 — Scénarios Gherkin : `buildCouponContext`

> server-only. Extraction du `CouponContext` depuis en-têtes/cookies, côté
> Server Component (`headers()/cookies()`) et côté API checkout (`req.headers`).
> Temps = `opts.now` injecté. `resetMemoryStore()` entre scénarios.
> Le scénario pivot est l'**équivalence SC ↔ API** (garant de l'invariant prix).

```gherkin
Feature: buildCouponContext extrait un contexte coupon stable et anonyme
  En tant que pipeline de prix server-only
  Je veux construire un visitorKey identique à l'affichage et au checkout
  Afin que le bucket — donc le prix — soit le même aux deux points

  Background:
    Given le temps courant injecté est 2026-06-02T12:00:00.000Z
    And la devise est "MAD"

  # ── Équivalence SC ↔ API (cœur) ───────────────────────────────
  Scenario: Le même visiteur produit le même visitorKey côté page et côté API
    Given un visiteur avec le cookie _fbp "fb.1.1700000000.555"
    And le même cookie est présent à l'affichage /kit et au POST /api/checkout/order
    When je construis le contexte via l'adaptateur Server Component
    And je construis le contexte via l'adaptateur API checkout
    Then les deux visitorKey sont identiques

  Scenario: L'équivalence tient même si le referer manque côté API
    Given un visiteur avec le cookie _fbp "fb.1.1700000000.555"
    And le referer est présent à l'affichage mais absent au checkout
    When je construis les deux contextes
    Then les deux visitorKey restent identiques
    # le bucket ne dépend que de visitorKey + couponId, donc le prix reste stable
    But le trafficSource peut différer sans casser l'invariant prix

  # ── visitorKey : stabilité, anonymat ──────────────────────────
  Scenario: Le visitorKey est stable dans le temps
    Given un visiteur avec le cookie _fbp "fb.1.1700000000.555"
    When je construis le contexte à 12:00 puis à 18:00
    Then le visitorKey est identique aux deux instants

  Scenario: Le visitorKey ne contient aucune PII ni la valeur _fbp en clair
    Given un visiteur avec le cookie _fbp "fb.1.1700000000.987654321"
    When je construis le contexte
    Then le visitorKey ne contient pas "987654321"
    And le visitorKey ne contient ni email, ni numéro de téléphone, ni IP brute

  Scenario: Sans cookie d'identité le visitorKey est null
    Given un visiteur sans cookie _fbp ni cookie de session
    When je construis le contexte
    Then le visitorKey est null
    # en aval (CPN-04) un visitorKey null est servi en treatment

  # ── trafficSource ─────────────────────────────────────────────
  Scenario Outline: Le trafficSource est dérivé par priorité utm puis referer
    Given le paramètre utm_source vaut "<utm>" et le referer vaut "<referer>"
    When je construis le contexte
    Then le trafficSource vaut "<source>"

    Examples:
      | utm       | referer                       | source         |
      | facebook  |                               | paid_social    |
      | klaviyo   |                               | email          |
      |           | https://www.instagram.com/    | social_organic |
      | newsletter| https://facebook.com/         | email          |
      | zzz-unkn  |                               | direct         |
      |           |                               | direct         |

  # ── device ────────────────────────────────────────────────────
  Scenario Outline: Le device est dérivé du user-agent
    Given le user-agent est "<ua>"
    When je construis le contexte
    Then le device vaut "<device>"

    Examples:
      | ua                                              | device  |
      | Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari | mobile  |
      | Mozilla/5.0 (iPad; CPU OS 17_0) Safari          | tablet  |
      | Mozilla/5.0 (Windows NT 10.0; Win64; x64)       | desktop |
      |                                                 | desktop |

  # ── visitorType ───────────────────────────────────────────────
  Scenario: Un cookie de récurrence marque le visiteur returning
    Given un visiteur avec le cookie de récurrence présent
    When je construis le contexte
    Then le visitorType vaut "returning"

  Scenario: Sans cookie de récurrence le visiteur est first
    Given un visiteur sans cookie de récurrence
    When je construis le contexte
    Then le visitorType vaut "first"

  # ── Robustesse ────────────────────────────────────────────────
  Scenario: Des en-têtes manquants ou malformés ne lèvent jamais d'exception
    Given un user-agent vide et un _fbp malformé et aucun referer
    When je construis le contexte
    Then aucune exception n'est levée
    And le device vaut "desktop"
    And le trafficSource vaut "direct"
    And le visitorType vaut "first"

  Scenario: La langue ne change pas le visitorKey
    Given un visiteur avec le cookie _fbp "fb.1.1700000000.555"
    When je construis le contexte avec accept-language "fr" puis "ar"
    Then le visitorKey est identique dans les deux cas

  # ── Opérateur / observabilité ─────────────────────────────────
  Scenario: Le contexte est journalisable sans fuite de données personnelles
    Given un contexte construit pour un visiteur identifié par _fbp
    When l'observabilité journalise le contexte
    Then le log contient visitorKey, trafficSource, device, visitorType
    But ne contient aucune PII ni la valeur brute du cookie Meta
```
