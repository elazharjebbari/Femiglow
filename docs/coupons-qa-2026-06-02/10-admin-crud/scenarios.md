# CPN-10 — Scénarios Gherkin : CRUD admin coupons (opérateur)

> Vue opérateur. Toutes les routes sont sous `/api/admin/coupons`. Toute mutation
> réussie déclenche `logAuditEvent` + `revalidateTag('coupons')`. Validation Zod
> en échec → `422`, code dupliqué → `409 conflict`, version stale → `409
> version_conflict`. `resetMemoryStore()` entre scénarios.

```gherkin
Feature: L'opérateur gère le cycle CRUD des coupons depuis l'admin
  En tant qu'opérateur marketing FemiGlow
  Je veux créer, lister, éditer et archiver des coupons
  Afin de piloter les offres sans toucher au code

  Background:
    Given je suis authentifié en admin avec le droit "write" sur "coupons"
    And la base de coupons est réinitialisée

  # ── Création nominale ─────────────────────────────────────────
  Scenario: Créer un coupon d'accueil auto-appliqué
    Given j'ouvre la page "/admin/coupons/new"
    When je saisis le libellé "Bienvenue -90 MAD"
    And je choisis le type "welcome_auto" et le mode "auto"
    And je choisis la nature "montant fixe" et le montant "90 MAD"
    And la cible "prix produit"
    And je clique sur "Enregistrer"
    Then une requête POST /api/admin/coupons part une seule fois
    And je vois le toast "Coupon créé"
    And je suis redirigé vers "/admin/coupons/{id}"
    And le coupon a le statut "draft"
    And un évènement d'audit "admin.coupon.created" est journalisé
    And le cache "coupons" est revalidé

  # ── Mode code ─────────────────────────────────────────────────
  Scenario: Le champ Code n'apparaît qu'en mode code et devient requis
    Given j'ouvre "/admin/coupons/new" en mode "auto"
    Then le champ "Code" est absent
    When je bascule le mode sur "code"
    Then le champ "Code" apparaît et est requis
    When je clique sur "Enregistrer" sans saisir de code
    Then je vois l'erreur inline "Code requis"
    And aucune requête réseau n'est envoyée

  # ── Validations de saisie ─────────────────────────────────────
  Scenario Outline: Validations inline bloquantes
    Given j'ouvre "/admin/coupons/new"
    When je saisis <champ> avec <valeur>
    And je quitte le champ
    Then je vois l'erreur inline "<message>"

    Examples:
      | champ            | valeur | message                                      |
      | pourcentage      | 120    | Le pourcentage doit être entre 1 et 100      |
      | pourcentage      | 0      | Le pourcentage doit être entre 1 et 100      |
      | montant fixe     | -10    | Le montant doit être positif                 |
      | date de fin      | avant la date de début | La fin doit suivre le début  |

  Scenario: Avertissement non bloquant si le montant dépasse le prix produit
    Given j'ouvre "/admin/coupons/new" et le prix produit est 28900 centimes
    When je saisis un montant fixe de "300 MAD"
    Then je vois l'avertissement "Le montant dépasse le prix : le panier sera plafonné à 0"
    But le bouton "Enregistrer" reste actif
    And la soumission est autorisée

  # ── Conflit de code ───────────────────────────────────────────
  Scenario: Code déjà utilisé renvoie un conflit
    Given un coupon existe déjà avec le code "VIP10"
    And j'ouvre "/admin/coupons/new" en mode "code"
    When je saisis le code "VIP10" et un payload par ailleurs valide
    And je clique sur "Enregistrer"
    Then le serveur répond "409 conflict"
    And je vois l'erreur "Code déjà utilisé" sous le champ Code
    And aucun coupon n'est créé

  # ── Anti double-soumission ────────────────────────────────────
  Scenario: Double-clic sur Enregistrer ne crée qu'un seul coupon
    Given j'ouvre "/admin/coupons/new" avec un payload valide
    When je clique deux fois rapidement sur "Enregistrer"
    Then le bouton se désactive immédiatement et affiche "Enregistrement…"
    And une seule requête POST est envoyée
    And un seul coupon est créé

  # ── Liste, filtres, vide ──────────────────────────────────────
  Scenario: Liste vide propose de créer le premier coupon
    Given aucun coupon n'existe
    When j'ouvre "/admin/coupons"
    Then je vois "Aucun coupon"
    And je vois le lien "Créer le premier coupon"

  Scenario: Filtrer par statut actif met à jour l'URL et la liste
    Given 3 coupons "active" et 2 coupons "draft" existent
    When j'ouvre "/admin/coupons" et je sélectionne le filtre statut "active"
    Then l'URL contient "?status=active"
    And seuls les coupons "active" sont listés
    When je sélectionne un statut qui n'a aucun coupon
    Then je vois "Aucun coupon ne correspond à ces filtres"
    And un bouton "Réinitialiser les filtres"

  Scenario: Pagination de la liste
    Given 25 coupons existent
    When j'ouvre "/admin/coupons" page 2 avec pageSize 20
    Then 5 coupons sont affichés
    And le compteur indique "25 coupons"

  # ── Édition & concurrence ─────────────────────────────────────
  Scenario: Édition concurrente — la seconde sauvegarde est refusée
    Given un coupon "Bienvenue" en version 1
    And l'opérateur A et l'opérateur B ont chacun ouvert l'édition (version 1)
    When l'opérateur A enregistre une modification
    Then la version du coupon passe à 2
    When l'opérateur B enregistre à son tour avec la version 1
    Then le serveur répond "409 version_conflict"
    And B voit la bannière "Ce coupon a été modifié par un autre utilisateur. Rechargez pour voir la dernière version."
    And la modification de B n'est PAS écrite
    And B peut cliquer "Recharger"

  # ── Archivage ─────────────────────────────────────────────────
  Scenario: Archiver un coupon (soft delete) avec confirmation
    Given un coupon "active" existe
    When j'ouvre son édition et je clique "Archiver"
    Then une modale "Archiver ce coupon ? Il ne sera plus appliqué." s'ouvre
    When je confirme
    Then DELETE /api/admin/coupons/{id} est appelé
    And le statut passe à "archived"
    And le coupon reste en base (historique des stats préservé)
    And un audit "admin.coupon.archived" est journalisé
    When je ré-archive le même coupon
    Then la réponse reste "200" avec statut "archived" (idempotent)

  # ── Chemins d'erreur réseau ───────────────────────────────────
  Scenario: Erreur 500 à la création conserve le formulaire
    Given j'ai rempli un coupon valide
    When le serveur répond "500" à la soumission
    Then je vois le toast "Une erreur est survenue"
    And les valeurs saisies sont conservées
    And le bouton "Enregistrer" est de nouveau actif

  Scenario: Timeout réseau à la création
    Given j'ai rempli un coupon valide
    When la requête n'aboutit pas dans le délai imparti
    Then je vois le toast "Délai dépassé, réessayez"
    And le bouton "Enregistrer" est réactivé

  Scenario: Lecture seule tente une création
    Given je n'ai que le droit "read" sur "coupons"
    When je soumets le formulaire de création
    Then le serveur répond "403 forbidden"
    And je vois le toast "Action non autorisée"
    # le détail RBAC est couvert en CPN-13
```
