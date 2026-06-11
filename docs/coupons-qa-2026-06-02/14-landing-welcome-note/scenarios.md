# CPN-14 — Scénarios visiteur (Gherkin)

> Parcours **point de vue visiteur** sur `/kit`. Le coupon résolu est passé en props
> (rendu serveur). Aucune saisie n'est requise (auto-appliqué). Les oracles complets
> figurent dans `test-cases.csv` ; ici on décrit le **comportement observable**.

```gherkin
Feature: Note d'accueil coupon sur la landing /kit
  En tant que visiteuse de FemiGlow
  Je veux comprendre, sans friction, que 90 MAD sont déjà déduits comme geste d'accueil
  Afin de décider d'acheter avec confiance, sans sentiment de promo agressive

  Background:
    Given le pack /kit est affiché à 199 MAD (prix XXL) face à un prix barré
    And la preuve est présente (note 4,8/5, avis, livraison offerte, retour 30 j)

  # --- Visiteur mobile FR, coupon actif (treatment) ---
  Scenario: Mobile FR — la note d'accueil est affichée et calme
    Given je suis sur "/kit" sur un mobile (390x844) en français
    And le coupon résolu serveur est { type: "welcome_auto", bucket: "treatment", endsAt: "2026-06-30" }
    When la page s'affiche
    Then je vois "Votre geste d'accueil est appliqué."
    And je vois "90 MAD offerts sur votre première commande du pack."
    And je vois "Prix final aujourd'hui : 199 MAD"
    And je vois "Valable jusqu'au 30 juin 2026. Hors cumul."
    And la note apparaît APRÈS le bandeau économie et AVANT la décomposition de valeur
    And aucun compte à rebours, emoji ou point d'exclamation n'est présent
    And la note ne remplace pas le CTA principal (qui reste l'action dominante)

  Scenario: Mobile FR — aucun flash au chargement
    Given je suis sur "/kit" en français avec un coupon "welcome_auto" "treatment"
    When la page se charge
    Then "Prix final aujourd'hui : 199 MAD" est présent dès le premier rendu (HTML serveur)
    And aucune requête réseau n'est émise pour afficher la note
    And la note n'apparaît pas en différé après l'hydratation

  # --- Visiteur desktop AR (RTL), coupon actif ---
  Scenario: Desktop AR RTL — note traduite, devise درهم, date civile arabe
    Given je suis sur "/ar/kit" sur desktop (1280x800)
    And le coupon résolu est { type: "welcome_auto", bucket: "treatment", endsAt: "2026-06-30" }
    When la page s'affiche
    Then la note est rendue en arabe dans un contexte dir="rtl"
    And la devise affichée est "درهم" (jamais "MAD")
    And la date de validité est au format civil arabe (jamais une durée relative)
    And la mise en page RTL reste alignée au bloc prix sans débordement

  # --- Groupe contrôle (holdout) ---
  Scenario: Mobile FR — holdout, la note est totalement masquée
    Given je suis sur "/kit" en français
    And le coupon résolu est { type: "welcome_auto", bucket: "holdout" }
    When la page s'affiche
    Then la note d'accueil n'est PAS rendue
    And aucun wrapper vide ni filet orphelin ne subsiste
    And le prix affiché reste cohérent avec le reste de la page

  # --- Type non welcome_auto ---
  Scenario Outline: Type ineligible — note masquée
    Given le coupon résolu est { type: "<type>", bucket: "treatment" }
    When la page "/kit" s'affiche
    Then la note d'accueil n'est PAS rendue
    Examples:
      | type        |
      | rescue      |
      | manual_code |
      | email_unlock|
      | post_purchase|

  # --- Pas de coupon ---
  Scenario: Aucun coupon résolu — note masquée
    Given aucun coupon n'est résolu (coupon = null)
    When la page "/kit" s'affiche
    Then la note d'accueil n'est PAS rendue

  # --- Date ---
  Scenario: Date lointaine reste une date civile, pas une urgence
    Given le coupon a endsAt = "2026-12-31"
    When la note s'affiche en français
    Then je vois "Valable jusqu'au 31 décembre 2026."
    And aucun texte d'urgence relative ("plus que", "expire dans") n'est présent

  Scenario: endsAt absent — la condition de date est omise proprement
    Given le coupon a endsAt = null
    When la note s'affiche
    Then la ligne "Valable jusqu'au …" est omise
    And "Hors cumul." reste affiché

  # --- Charte / accessibilité ---
  Scenario: Charte — la note ressemble à une note éditoriale
    Given la note d'accueil est affichée
    Then le fond est crème et le texte encre
    And l'accent sauge/champagne reste un filet fin discret
    And aucune couleur rouge retail ni jaune discount n'est utilisée
    And le conteneur n'a pas d'angle arrondi massif (rounded-2xl/3xl/full)

  Scenario: Accessibilité — lecture d'écran et contraste
    Given un lecteur d'écran parcourt la note
    Then les 4 lignes sont lues dans l'ordre haut→bas
    And "199 MAD" n'est pas annoncé comme un titre (heading)
    And axe-core ne relève aucune violation serious/critical
    And le contraste texte/fond satisfait au moins AA
```
