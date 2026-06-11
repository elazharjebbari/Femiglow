# CPN-01 — Scénarios métier (Gherkin)

> Modèle de données coupons + coupon_events. Point de vue **système/DBA** (migrations, intégrité) et indirectement **opérateur** (effets de l'archivage/suppression).

```gherkin
Feature: Intégrité du modèle de données coupons

  Background:
    Given une base PostgreSQL vierge
    And la migration 0080 (COUPONS) disponible dans drizzle/migrations

  Scenario: Le système applique la migration sur un environnement neuf
    When le runner de migration exécute 0080
    Then les tables "coupons" et "coupon_events" existent
    And les 7 enums coupon_* existent
    And l'index unique partiel "coupons_code_unique" existe avec la clause WHERE code IS NOT NULL
    And l'index unique partiel "coupon_events_order_converted_unique" existe avec WHERE phase='converted' AND order_id IS NOT NULL

  Scenario: Le système ré-applique une migration déjà passée
    Given la migration 0080 déjà appliquée
    When le runner de migration est relancé
    Then aucune table n'est recréée
    And le processus se termine sans erreur

  Scenario: L'opérateur crée un coupon auto-appliqué sans code
    Given un opérateur admin connecté
    When il enregistre un coupon type=welcome_auto mode=auto valueKind=fixed_amount valueAmount=9000 sans code
    Then la ligne est créée avec code=NULL
    And status vaut "draft" par défaut
    And eligibility vaut {} par défaut
    And currency vaut "MAD" par défaut

  Scenario: Le système refuse deux codes manuels identiques
    Given un coupon manual_code avec code="WELCOME" déjà actif
    When un second coupon est créé avec code="WELCOME"
    Then l'insertion est rejetée avec une unique_violation (23505)

  Scenario: Le système autorise plusieurs coupons auto sans code
    Given aucun coupon en base
    When trois coupons mode=auto sont créés avec code=NULL
    Then les trois lignes sont créées sans erreur

  Scenario: Le système garantit une seule conversion comptée par commande
    Given un coupon actif et une commande "o_1"
    And un coupon_event phase="converted" orderId="o_1" déjà enregistré
    When un second event phase="converted" orderId="o_1" est tenté
    Then l'insertion est rejetée avec une unique_violation (23505)
    And l'incrémentalité ne compte qu'une conversion pour "o_1"

  Scenario: Le système conserve l'historique quand l'opérateur supprime un coupon
    Given un coupon "cpn_1" avec 12 coupon_events liés
    When l'opérateur supprime le coupon "cpn_1"
    Then les 12 events sont conservés
    And leur couponId est mis à NULL (ON DELETE SET NULL)

  Scenario: Le système délie un event quand sa commande est supprimée
    Given un coupon_event converted lié à la commande "o_1"
    When la commande "o_1" est supprimée
    Then l'event est conservé avec orderId=NULL

  Scenario: Le système délie le créateur quand l'admin est supprimé
    Given un coupon créé par l'admin "admin_1"
    When l'admin "admin_1" est supprimé
    Then le coupon est conservé avec createdBy=NULL

  Scenario: Le système refuse une valeur d'enum inconnue
    When un coupon est créé avec type="flash"
    Then l'insertion est rejetée avec invalid_text_representation (22P02)

  Scenario: Le système n'enregistre jamais de PII dans les events
    Given un visiteur identifié par un hash anonyme
    When un coupon_event est enregistré
    Then visitorKey ne contient ni adresse email ni numéro de téléphone en clair

  Scenario: Cohérence dual-driver entre mémoire et Postgres
    Given le même payload d'insertion de coupon
    When il est inséré via memoryStore() puis via Drizzle/PGlite
    Then les deux lignes retournées ont les mêmes clés et les mêmes types JS
```
