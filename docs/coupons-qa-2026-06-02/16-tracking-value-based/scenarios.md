# CPN-16 — Scénarios Gherkin : non-régression du tracking value-based

> Gate **G-TRACKING-VALUE** (impact ROAS Meta/Google). La `value` envoyée aux
> providers = prix effectivement payé, en unité majeure (MAD). Coupon actif →
> 199 ; jamais 289 (barré) ni 19900 (centimes). La bascule promo→coupon ne doit
> RIEN changer à la value. Point de vue : visiteur réel + pipeline analytics.

```gherkin
Feature: La valeur de conversion suit le prix payé, jamais le prix barré
  En tant qu'équipe acquisition optimisant le bidding value-based
  Je veux que chaque conversion porte la vraie valeur payée (199 MAD)
  Afin que Meta et Google enchérissent sur des valeurs justes

  Background:
    Given le coupon "welcome_auto" est actif (-90 MAD, holdout 0)
    And le prix régulier est 289 MAD et le prix effectif 199 MAD

  # ── view_item ──────────────────────────────────────────────────
  Scenario: La page /kit envoie une value de 199
    Given je visite "/fr/kit"
    When l'événement "view_item" est poussé dans le dataLayer
    Then sa "value" vaut 199
    And sa "currency" vaut "MAD"
    And elle ne vaut ni 289 ni 19900

  # ── generate_lead ──────────────────────────────────────────────
  Scenario: Un lead chat porte la valeur du kit remisé
    Given je soumets mes coordonnées via le chat
    When l'événement "generate_lead" est émis
    Then sa "value" vaut 199 (server-authoritative via getKitLeadValue)

  # ── purchase ───────────────────────────────────────────────────
  Scenario: L'achat porte exactement le total payé
    Given je commande 1 kit au prix de 199 MAD
    When la commande est confirmée
    Then l'événement "purchase" porte "value" 199
    And cette value égale le total facturé divisé par 100

  Scenario: Un achat de 2 kits porte une value de 398
    Given je commande 2 kits avec le coupon actif
    When la commande est confirmée
    Then l'événement "purchase" porte "value" 398

  # ── Cohérence funnel ───────────────────────────────────────────
  Scenario: Tous les événements du funnel portent la même valeur
    Given je parcours "/kit" puis le checkout avec le coupon actif
    When les événements view_item, add_to_cart, begin_checkout et purchase sont émis
    Then ils portent tous "value" 199
    And aucun d'eux ne porte 289 ni 19900

  # ── Invariance à la source de la promo ─────────────────────────
  Scenario: La bascule promo statique vers coupon ne change pas la value
    Given la promo de 199 vient d'abord d'une valeur statique
    And ensuite du coupon "welcome_auto"
    When je mesure la value de "view_item" dans les deux cas
    Then elle vaut 199 dans les deux cas

  # ── Cohérence avec le holdout ──────────────────────────────────
  Scenario: Un visiteur en contrôle porte la value du plein tarif
    Given un visiteur classé "holdout" qui paie 289 MAD
    When les événements de conversion sont émis pour ce visiteur
    Then leur "value" vaut 289 (cohérente avec le prix réellement payé)

  Scenario: Un visiteur traité porte la value remisée
    Given un visiteur classé "treatment" qui paie 199 MAD
    When les événements de conversion sont émis
    Then leur "value" vaut 199

  # ── Désactivation totale ───────────────────────────────────────
  Scenario: Sans aucune promo, la value reste cohérente avec le plein tarif
    Given le coupon et toute promo sont désactivés
    When je visite "/fr/kit"
    Then l'événement "view_item" porte "value" 289

  # ── i18n ───────────────────────────────────────────────────────
  Scenario: La value est identique en français et en arabe
    Given le coupon est actif
    When je compare la value de "view_item" sur "/fr/kit" et "/ar/kit"
    Then elle vaut 199 dans les deux locales
    And seul l'affichage de la devise diffère, pas le montant tracké
```
