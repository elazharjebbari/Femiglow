# CPN-15 — Scénarios visiteur (Gherkin)

> Parcours **point de vue visiteur** autour de la porte « J'ai un code d'invitation »,
> sous-élément de la note d'accueil. En Phase 1 la porte est **inerte** : elle s'ouvre,
> mais ne soumet rien. Oracles complets dans `test-cases.csv`.

```gherkin
Feature: Porte discrète "J'ai un code d'invitation" sur /kit
  En tant que visiteuse
  Je veux pouvoir, si j'ai un code, trouver une porte discrète
  Sans que cette porte ne m'invite à interrompre ma décision (anti-friction)

  Background:
    Given la note d'accueil est affichée (coupon welcome_auto, treatment) sur "/kit"
    And la porte "J'ai un code d'invitation" est rendue en bas du module

  # --- État initial (anti-friction) ---
  Scenario: Mobile FR — la porte est repliée au chargement
    Given je suis sur "/kit" sur mobile en français
    When la page s'affiche
    Then je vois le texte discret "J'ai un code d'invitation"
    But aucun champ de saisie n'est ouvert ni visible
    And le contenu de la porte n'est pas affiché
    And la porte ressemble à un lien discret, pas à un bouton concurrent du CTA

  # --- Ouverture ---
  Scenario: Desktop FR — j'ouvre la porte
    Given je suis sur "/kit" en français
    When je clique sur "J'ai un code d'invitation"
    Then la porte s'ouvre
    And aria-expanded passe à "true"
    And le contenu (Phase 1 : explicatif et inerte) devient visible

  Scenario: Desktop FR — j'ouvre puis je referme
    When je clique deux fois sur "J'ai un code d'invitation"
    Then la porte se referme
    And aria-expanded repasse à "false"

  # --- Clavier / accessibilité ---
  Scenario Outline: Ouverture au clavier
    Given le focus est sur "J'ai un code d'invitation"
    When j'appuie sur "<touche>"
    Then la porte s'ouvre
    And le focus n'est jamais piégé
    Examples:
      | touche |
      | Enter  |
      | Espace |

  Scenario: Accessibilité — disclosure conforme
    Given la porte est dans le DOM
    Then le déclencheur est focusable au clavier avec un focus visible
    And aria-expanded reflète l'état (false fermé / true ouvert)
    And axe-core ne relève aucune violation serious/critical, porte fermée ET ouverte

  # --- Inertie Phase 1 ---
  Scenario: Phase 1 — la porte est inerte (aucune soumission)
    Given j'ouvre la porte
    When je tente d'interagir avec son contenu
    Then aucune requête réseau n'est émise
    And aucun coupon manuel n'est appliqué
    # Option A : aucun champ n'est présent (texte explicatif seulement)
    # Option B : un champ + bouton sont présents mais désactivés et hors tab order

  # --- Non-perturbation du CTA ---
  Scenario: Le CTA principal reste intact
    Given le CTA primaire "Commander" est présent
    When j'ouvre puis referme la porte d'invitation
    Then le CTA primaire est toujours présent, avec le même libellé et le même état
    And il reste atteignable et cliquable

  # --- i18n / RTL ---
  Scenario: AR RTL — la porte est traduite et orientée RTL
    Given je suis sur "/ar/kit"
    When la page s'affiche
    Then la porte affiche "لدي رمز دعوة" dans un contexte dir="rtl"
    And l'indicateur d'expansion est du bon côté, sans troncature
    When je l'ouvre
    Then le contenu arabe est lisible

  # --- Réduction de mouvement ---
  Scenario: Reduced motion — pas d'animation agressive
    Given mon système demande "prefers-reduced-motion: reduce"
    When j'ouvre la porte
    Then aucune animation d'ouverture agressive ne se produit
```
