# CPN-06 — Scénarios Gherkin : affichage du prix public coupon-aware

> Gates **G-PRICE-PARITY** + **G-TRACKING-VALUE**. Point de vue : visiteur réel
> sur `/kit` (mobile + desktop, fr + ar). Prix de référence : 289 MAD barré,
> 199 MAD effectif (coupon `welcome_auto` -90 MAD, holdout=0). Charte : pas de
> rouge, pas de countdown, pas d'emoji.

```gherkin
Feature: La page /kit affiche le prix effectif du coupon, jamais le prix barré
  En tant que visiteuse arrivant sur la page du Kit
  Je veux voir le bon prix remisé et un prix barré crédible
  Afin de comprendre l'offre sans être trompée et payer ce que je vois

  Background:
    Given le coupon "welcome_auto" est actif (-90 MAD, AUTO, holdout 0)
    And le kit est publié au prix régulier de 289 MAD

  # ── Nominal desktop fr ─────────────────────────────────────────
  Scenario: Le prix remisé et le prix barré s'affichent sur /kit
    Given je visite "/fr/kit" sur desktop
    When la section "Le Pack" est rendue
    Then je vois le prix actif "199 MAD"
    And je vois le prix barré "289 MAD"
    And je vois la mention "Économisez 90 MAD"
    And aucun compte à rebours ni badge "SOLDE" n'apparaît
    And le prix barré n'utilise aucune couleur rouge

  # ── Nominal mobile fr ──────────────────────────────────────────
  Scenario: Le bloc prix reste lisible sur mobile
    Given je visite "/fr/kit" sur un viewport mobile 375px
    Then le prix actif "199 MAD" domine visuellement le prix barré "289 MAD"
    And la mention "Économisez 90 MAD" reste lisible sous le prix

  # ── Tracking value-based ───────────────────────────────────────
  Scenario: L'événement view_item porte la valeur effective 199
    Given je visite "/fr/kit"
    When l'événement "view_item" est émis
    Then son champ "value" vaut 199
    And sa devise est "MAD"
    And il ne vaut jamais 289

  # ── Accessibilité ──────────────────────────────────────────────
  Scenario: Le lecteur d'écran annonce un seul prix clair
    Given j'utilise un lecteur d'écran sur "/fr/kit"
    When le bloc prix reçoit le focus
    Then l'étiquette annoncée est "Prix : 199 MAD, prix initial 289 MAD"
    And le prix barré "289 MAD" est marqué aria-hidden

  # ── i18n arabe ─────────────────────────────────────────────────
  Scenario: La version arabe affiche درهم en RTL
    Given je visite "/ar/kit"
    Then je vois le prix actif "199 درهم"
    And je vois le prix barré "289 درهم"
    And la mise en page est en direction RTL
    And le montant numérique reste 199 et 289 comme en français

  # ── Coupon désactivé ───────────────────────────────────────────
  Scenario: Sans coupon actif, seul le prix plein s'affiche
    Given le coupon "welcome_auto" est mis en pause
    When je visite "/fr/kit"
    Then je vois "289 MAD" sans prix barré
    And aucune mention "Économisez" n'apparaît
    And l'événement "view_item" porte la valeur 289

  # ── Donnée incohérente (garde) ─────────────────────────────────
  Scenario Outline: Une promo incohérente est ignorée, prix plein affiché
    Given la valeur de promo résolue est <raw> centimes sur un prix de 28900
    When je visite "/fr/kit"
    Then je vois "289 MAD" sans prix barré
    And la page ne plante pas

    Examples:
      | raw    |
      | 28900  |
      | 30000  |
      | 0      |
      | -100   |

  # ── Résilience ─────────────────────────────────────────────────
  Scenario: La base est indisponible, la page reste servie
    Given le produit n'est pas trouvable en base (ou n'est pas publié)
    When je visite "/fr/kit"
    Then la page s'affiche avec les données mock
    And aucune erreur 500 n'est renvoyée

  Scenario: Une devise non supportée retombe sur la devise mock
    Given la variante porte une devise "XYZ" hors liste blanche
    When je visite "/fr/kit"
    Then la devise affichée est celle du mock
    And le format du prix reste correct

  # ── Parité affiché == facturé (cœur du gate) ───────────────────
  Scenario: Le prix affiché est exactement le prix facturé
    Given je vois "199 MAD" sur "/fr/kit"
    When je passe commande pour 1 kit
    Then le total facturé est 19900 centimes
    And aucune erreur 422 PriceMismatch n'est levée
```
