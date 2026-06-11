# CPN-13 — Scénarios Gherkin : RBAC ressource `coupons` (opérateur)

> Ressource `coupons` ajoutée à `RBAC_RESOURCES` + matrice. Enforcement runtime
> calqué sur `lib/legal/permissions.ts` (`requireCouponPermission`). Ordre :
> auth → permission → existence → validation → mutation. Le serveur est l'autorité ;
> l'UI masque par confort. `resetMemoryStore()` entre scénarios.

```gherkin
Feature: Les droits sur les coupons sont appliqués serveur ET reflétés dans l'UI
  En tant que système de sécurité
  Je veux qu'une lecture seule ne puisse jamais muter un coupon
  Afin de protéger l'intégrité des offres et la traçabilité

  Background:
    Given la matrice RBAC définit la ressource "coupons" pour superadmin/admin/editor/viewer
    And la base de coupons est réinitialisée

  # ── Configuration de la matrice ───────────────────────────────
  Scenario: La ressource coupons est déclarée et complète
    Then "coupons" figure dans RBAC_RESOURCES
    And rbacResourceMatrix accepte une clé "coupons"
    And la matrice par défaut donne :
      | role       | actions                          |
      | superadmin | read, write, publish, delete     |
      | admin      | read, write, publish             |
      | editor     | read, write                      |
      | viewer     | read                             |
    And rbacSchema rejette toute config où superadmin n'a pas toutes les actions sur "coupons"

  # ── viewer (lecture seule) ────────────────────────────────────
  Scenario: Un viewer peut lire mais pas muter
    Given je suis authentifié avec le rôle "viewer"
    When j'appelle GET /api/admin/coupons
    Then la réponse est "200"
    When j'appelle POST /api/admin/coupons avec un payload valide
    Then la réponse est "403 forbidden"
    And aucun coupon n'est créé
    And revalidateTag("coupons") n'est PAS appelé
    And un audit "admin.coupon.permission_denied" {role:"viewer", action:"write"} est journalisé

  Scenario: Un viewer ne peut ni activer ni archiver
    Given je suis "viewer" et un coupon "draft" existe
    When j'appelle POST /api/admin/coupons/{id}/status to=active
    Then la réponse est "403" et le statut reste "draft"
    When j'appelle DELETE /api/admin/coupons/{id}
    Then la réponse est "403" et le coupon n'est pas archivé

  # ── editor ────────────────────────────────────────────────────
  Scenario: Un editor crée, édite et active mais n'archive pas
    Given je suis authentifié avec le rôle "editor"
    When je crée un coupon
    Then la réponse est "201"
    When j'édite ce coupon
    Then la réponse est "200"
    When j'active ce coupon
    Then la réponse est "200"
    When je tente de l'archiver (DELETE)
    Then la réponse est "403 forbidden" (pas de droit "delete")
    And le coupon n'est pas archivé

  # ── superadmin ────────────────────────────────────────────────
  Scenario: Un superadmin a le parcours complet
    Given je suis "superadmin"
    When je crée, édite, active puis archive un coupon
    Then aucune étape ne renvoie "403"
    And l'état final du coupon est "archived"

  # ── La sécurité prime sur la validation ───────────────────────
  Scenario: Permission vérifiée avant la validation Zod
    Given je suis "viewer"
    When j'appelle POST /api/admin/coupons avec un body invalide (vide)
    Then la réponse est "403" (et non "422")
    # l'autorisation est contrôlée avant toute lecture/validation du body

  # ── Ordre auth → perm → existence ─────────────────────────────
  Scenario: Id inconnu renvoie 404 pour un rôle autorisé
    Given je suis "superadmin"
    When j'appelle GET /api/admin/coupons/{idInexistant}
    Then la réponse est "404 not_found"
    # l'existence n'est vérifiée qu'après auth et permission

  # ── Non authentifié ───────────────────────────────────────────
  Scenario: Appel API non authentifié
    Given aucune session admin
    When j'appelle GET /api/admin/coupons
    Then la réponse est "401 unauthorized"
    When j'appelle POST /api/admin/coupons
    Then la réponse est "401" et aucune mutation n'a lieu

  Scenario: Navigation page non authentifiée
    Given aucune session admin
    When je navigue vers "/admin/coupons"
    Then je suis redirigé vers "/admin/login?next=/admin/coupons"

  # ── UI reflète les droits ─────────────────────────────────────
  Scenario: L'UI d'un viewer ne montre aucune action de mutation
    Given je suis "viewer" et j'ouvre "/admin/coupons"
    Then je vois la liste en lecture
    And aucun bouton "Nouveau coupon", "Enregistrer", "Activer" ou "Archiver" n'est cliquable
    When j'ouvre l'édition d'un coupon
    Then "Enregistrer" est absent ou en aria-disabled avec tooltip "Droits insuffisants"

  Scenario: L'UI d'un editor masque seulement l'archivage
    Given je suis "editor" et j'ouvre l'édition d'un coupon
    Then "Enregistrer" et "Activer" sont disponibles
    But "Archiver" est masqué (pas de droit "delete")

  # ── Attaque par appel direct ──────────────────────────────────
  Scenario: Le masquage UI n'est pas la sécurité
    Given je suis "viewer" et l'UI masque les boutons de mutation
    When j'appelle directement DELETE /api/admin/coupons/{id} (hors UI)
    Then la réponse est "403 forbidden"
    And le coupon n'est pas archivé
    And un audit "admin.coupon.permission_denied" est journalisé
```
