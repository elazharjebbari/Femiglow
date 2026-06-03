# CPN-11 — Scénarios Gherkin : cycle de vie du statut (opérateur)

> Route `POST /api/admin/coupons/[id]/status`. Transitions validées côté serveur.
> Effet `/kit` après `revalidateTag('coupons')`. Unicité welcome_auto actif.
> `resetMemoryStore()` entre scénarios.

```gherkin
Feature: L'opérateur pilote le statut d'un coupon et son effet sur /kit
  En tant qu'opérateur marketing
  Je veux activer, pauser, reprendre et archiver un coupon
  Afin de contrôler quand une remise est visible sur le site

  Background:
    Given je suis authentifié en admin avec le droit "write" sur "coupons"
    And la base de coupons est réinitialisée

  # ── Activation & effet /kit ───────────────────────────────────
  Scenario: Activer un coupon d'accueil le rend visible sur /kit
    Given un coupon "welcome_auto" "Bienvenue -90 MAD" en statut "draft"
    When j'ouvre son édition et je clique "Activer"
    Then une confirmation "Activer ce coupon ? Il deviendra visible sur le site." s'affiche
    When je confirme
    Then la réponse est "200" avec statut "active"
    And je vois le badge "active" et le toast "Coupon activé"
    And un audit "admin.coupon.status_changed" {from:"draft", to:"active"} est journalisé
    And le cache "coupons" est revalidé
    When un visiteur ouvre "/kit"
    Then la remise -90 MAD est visible (prix barré + prix remisé)

  Scenario: Pauser un coupon retire la remise de /kit
    Given un coupon "welcome_auto" "active"
    When je clique "Mettre en pause" et je confirme
    Then la réponse est "200" avec statut "paused"
    And je vois le toast "Coupon mis en pause"
    When un visiteur recharge "/kit" après revalidation
    Then le plein tarif est affiché (aucune remise)

  Scenario: Reprendre un coupon en pause
    Given un coupon "welcome_auto" "paused"
    When je clique "Reprendre" et je confirme
    Then la réponse est "200" avec statut "active"
    And la remise redevient visible sur "/kit" après revalidation

  # ── Transitions interdites ────────────────────────────────────
  Scenario: Un coupon archivé ne peut pas être réactivé
    Given un coupon "archived"
    When je tente de le passer à "active"
    Then la réponse est "409 conflict"
    And je vois "Ce coupon est archivé. Dupliquez-le pour le réutiliser."
    And le statut reste "archived"

  Scenario: On ne peut pas pauser un brouillon
    Given un coupon "draft"
    When je tente de le passer à "paused"
    Then la réponse est "409 conflict"

  Scenario: Transition vers le même statut est idempotente
    Given un coupon "active"
    When je demande de nouveau le statut "active"
    Then la réponse est "200" (idempotente)
    And aucun audit "status_changed" supplémentaire n'est créé

  Scenario: Cible de statut invalide
    Given un coupon "active"
    When je poste un statut "banana"
    Then la réponse est "422 invalid_input"

  # ── Unicité welcome_auto ──────────────────────────────────────
  Scenario: Un seul coupon d'accueil actif à la fois
    Given le coupon d'accueil "Bienvenue A" est "active"
    And le coupon d'accueil "Bienvenue B" est "draft"
    When je tente d'activer "Bienvenue B"
    Then la réponse est "409 conflict" avec conflictingId de "Bienvenue A"
    And je vois "Un coupon d'accueil est déjà actif (Bienvenue A). Mettez-le en pause d'abord."
    And "Bienvenue B" reste en "draft"

  Scenario: Activer un coupon d'accueil quand aucun n'est actif
    Given aucun coupon "welcome_auto" n'est "active"
    And "Bienvenue B" est "draft"
    When j'active "Bienvenue B"
    Then la réponse est "200" avec statut "active"

  # ── Concurrence ───────────────────────────────────────────────
  Scenario: Deux opérateurs activent le même coupon
    Given un coupon "draft" en version 1
    And l'opérateur A et l'opérateur B l'ont chacun ouvert (version 1)
    When A active le coupon
    Then A obtient "200" et la version passe à 2
    When B active avec la version 1
    Then B obtient "409 version_conflict"
    And B est invité à recharger

  Scenario: Deux opérateurs activent deux coupons d'accueil différents
    Given "Bienvenue A" et "Bienvenue B" sont tous deux "draft"
    When A active "Bienvenue A" et B active "Bienvenue B" quasi simultanément
    Then exactement un des deux réussit (200)
    And l'autre reçoit "409 conflict" d'unicité welcome_auto

  # ── Robustesse UI ─────────────────────────────────────────────
  Scenario: Erreur serveur annule l'optimisme du badge
    Given un coupon "active" affiché avec son badge
    When je clique "Mettre en pause" et le serveur répond "500"
    Then je vois le toast "Une erreur est survenue"
    And le badge revient à "active" (rollback optimiste)

  Scenario: Double-clic sur Activer ne déclenche qu'une transition
    Given un coupon "draft"
    When je clique "Activer" et je confirme deux fois rapidement
    Then une seule requête de transition part
    And un seul audit "status_changed" est créé

  # ── Cas métier saisonnier ─────────────────────────────────────
  Scenario: Pause pour Ramadan puis reprise
    Given un coupon "welcome_auto" "active"
    When j'approche d'une période où je veux suspendre l'offre
    And je clique "Mettre en pause"
    Then "/kit" cesse d'afficher la remise après revalidation
    When la période est terminée et je clique "Reprendre"
    Then "/kit" réaffiche la remise
    And l'usageCount du coupon n'a pas été altéré par les transitions
```
