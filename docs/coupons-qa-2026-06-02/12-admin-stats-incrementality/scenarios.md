# CPN-12 — Scénarios Gherkin : stats & incrémentalité (opérateur)

> Route `GET /api/admin/coupons/[id]/stats`. Calcul d'uplift = fonction pure.
> Aucune PII dans la réponse. `resetMemoryStore()` entre scénarios.

```gherkin
Feature: L'opérateur évalue la performance et l'incrémentalité d'un coupon
  En tant qu'opérateur marketing
  Je veux voir les taux de conversion treatment vs holdout et l'uplift
  Afin de savoir si le coupon génère un vrai gain incrémental

  Background:
    Given je suis authentifié en admin avec le droit "read" sur "coupons"
    And la base de coupons et d'évènements est réinitialisée

  # ── Nominal ───────────────────────────────────────────────────
  Scenario: Consulter un uplift positif significatif
    Given un coupon "welcome_auto" exposé à 1000 visiteurs en treatment (130 conversions)
    And exposé à 200 visiteurs en holdout (18 conversions)
    When j'ouvre l'édition du coupon et le panneau "Performance"
    Then je vois un tableau treatment / holdout avec les taux 13% et 9%
    And l'encart Uplift indique "+4 points" en absolu
    And "+44%" en relatif
    And la mention "Échantillon suffisant"

  # ── 0 donnée ──────────────────────────────────────────────────
  Scenario: Un coupon jamais exposé n'affiche pas d'uplift
    Given un coupon sans aucun évènement
    When j'ouvre le panneau "Performance"
    Then je vois "Pas encore de données"
    And aucun encart d'uplift n'est affiché

  # ── Petit échantillon ─────────────────────────────────────────
  Scenario: Échantillon insuffisant affiche un avertissement
    Given un coupon avec 40 exposés treatment et 30 exposés holdout (seuil 100)
    When j'ouvre le panneau "Performance"
    Then je vois l'avertissement "Échantillon insuffisant (n < seuil) : uplift non significatif"
    And l'uplift est affiché en sourdine (non mis en avant)

  # ── holdout = 0 ───────────────────────────────────────────────
  Scenario: Sans groupe contrôle, l'incrémentalité ne peut pas être mesurée
    Given un coupon configuré avec holdoutPct 0 (aucun visiteur en holdout)
    And des conversions en treatment
    When j'ouvre le panneau "Performance"
    Then je vois "Pas de groupe contrôle (holdout 0 %) : l'incrémentalité ne peut pas être mesurée."
    And aucun chiffre d'uplift n'est présenté

  # ── Uplift négatif ────────────────────────────────────────────
  Scenario: Un uplift négatif est affiché honnêtement
    Given un coupon où le holdout convertit mieux que le treatment
    When j'ouvre le panneau "Performance"
    Then l'uplift négatif est affiché (en encre, non masqué)
    And aucune valeur n'est dissimulée pour flatter le coupon

  # ── Robustesse calcul ─────────────────────────────────────────
  Scenario: Aucun NaN quand il n'y a pas de conversion
    Given un coupon avec 500 exposés treatment et 0 conversion
    When j'ouvre le panneau "Performance"
    Then le taux de conversion affiché est "0%"
    And aucune valeur "NaN" n'apparaît

  # ── Confidentialité ───────────────────────────────────────────
  Scenario: La réponse stats ne contient aucune PII
    Given un coupon avec des évènements portant des visitorKey hashés
    When la route GET /api/admin/coupons/{id}/stats répond
    Then le corps ne contient que des compteurs agrégés
    And aucun "visitorKey" ni adresse e-mail n'est présent

  # ── Fenêtre temporelle ────────────────────────────────────────
  Scenario: Restreindre l'analyse à une fenêtre de 7 jours
    Given des évènements répartis sur deux semaines
    When je consulte les stats avec une fenêtre from/to de 7 jours
    Then les agrégats ne comptent que les évènements de cette fenêtre

  # ── Erreur réseau ─────────────────────────────────────────────
  Scenario: Erreur serveur sur le panneau stats
    Given la route stats répond "500"
    When j'ouvre le panneau "Performance"
    Then je vois "Impossible de charger les statistiques"
    And un bouton "Réessayer"

  # ── Parcours métier J+7 ───────────────────────────────────────
  Scenario: Suivi d'un coupon d'accueil à J+7
    Given j'ai activé un coupon d'accueil il y a 7 jours (CPN-11)
    And il a accumulé des expositions et conversions treatment/holdout
    When j'ouvre son panneau "Performance"
    Then je peux comparer le taux de conversion treatment au holdout
    And lire l'uplift incrémental
    And décider de poursuivre, ajuster le holdout, ou archiver le coupon
```
