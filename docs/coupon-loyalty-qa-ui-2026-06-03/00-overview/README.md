# 00 — Overview : vision, doctrine, invariants

## 1. Vision

Construire une **batterie de tests robuste, fiable, maintenable et non-régressive**, dont le centre
de gravité est l'**interface** (client et opérateur), pour le système coupon + crédit fidélité.

Principe directeur : **« un bug se vit dans l'UI »**. On modélise donc des **scénarios métier réels**
— un opérateur qui crée puis active une promo et vérifie son effet, une cliente qui reçoit un code,
le garde, revient et l'utilise — et on assert sur ce que l'humain **voit** (texte, montant, état du
bouton, ligne d'économie) et **subit** (erreur réseau, code expiré, permission refusée).

## 2. Doctrine de test (orientée UI / opérateur)

1. **Comportement observable d'abord.** Une fonctionnalité est « testée » quand son rendu et ses
   interactions sont vérifiés via Testing Library (composant) ou Playwright (parcours), pas seulement
   sa logique pure.
2. **Isolation réseau par MSW.** Tout composant qui parle à une API est testé avec un serveur MSW
   qui simule succès **et** échec (422/403/409/500, latence, payload malformé). On ne mocke jamais
   `fetch` à la main quand MSW peut le faire — c'est la couche de contrat partagée.
3. **Point de vue opérateur.** Pour l'admin, on teste les **gestes** : remplir, cliquer « Créer »,
   voir la ligne apparaître ; cliquer « Activer », voir le badge changer ; charger les grants, voir
   le téléphone **masqué**. On teste aussi les **droits** (viewer vs admin) et les **refus** (HTTP 403/409).
4. **Charte FemiGlow comme oracle.** Plusieurs tests assertent la conformité « voix maison » :
   pas de `%` exposé, pas de `!`, pas d'emoji, pas de compte à rebours, accent terracotta `#C28A6E`
   réservé à l'économie, montants absolus en `tabular-nums`, RTL correct en arabe.
5. **Robustesse > volume.** On privilégie des tests qui attrapent de vraies régressions (états
   d'erreur, frontières, idempotence, anti-stale, floor du crédit) plutôt que des tests tautologiques.
6. **Déterminisme.** Horloge injectée (`now`), pas de `Date.now()` dans les oracles, données semées
   via fixtures, MSW reset entre tests, storageState admin Playwright pré-calculé.

## 3. Audit de couverture (état avant ce dossier)

**Bien couvert** (~121 tests) :
- Moteur : `engine.test.ts` (~30), `context.test.ts` (~12), `bucketing` (dans engine), `stats.test.ts` (5), `delivery-delay.test.ts` (8)
- Repos : `coupon-repo.test.ts` (7), `coupon-grant-repo.test.ts` (11), `coupon-event-repo.test.ts` (6)
- Composants isolés : `LoyaltyCodeCard.test.tsx` (5), `CouponWelcomeNote.test.tsx` (5), `InvitationCodeField.test.tsx` (4), `WizardCartRecap.*.test.tsx` (12), `wizard-store.coupon.test.ts` (4)
- Contrats : `admin/coupons/route.test.ts` (6), `admin/coupons/grants/route.test.ts` (3), `coupons/rescue/route.test.ts` (3)
- E2E : `admin-coupons.spec.ts` (3), `coupon-welcome.spec.ts` (3)

**Angles morts (cibles de ce dossier)** :
- 🔴 `CouponsManager.tsx` : **0 test composant** (création, transitions, stats, grants, masquage, erreurs réseau, états boutons).
- 🔴 **MSW** : aucun handler coupon/fidélité → impossible d'isoler proprement les composants admin.
- 🔴 Routes `[id]/status` & `[id]/stats` : **0 contrat** (RBAC `publish`, lock `archived`→409, agrégation uplift).
- 🔴 `redeem` route : pas de test de contrat couvrant **tous** les `reason` (`not_found`, `not_yet_active`, `expired`, `already_redeemed`, `invalid_input`, `error`).
- 🔴 E2E redemption client + parcours fidélité complet : **0**.
- 🟠 AddressStep disclosure, ThankYouStep wiring loyalty, filtres grants (`phone`/`status`), rescue côté opérateur, éligibilité en contexte, audit log, invalidation cache, mobile/RTL admin.

## 4. Invariants maîtres (oracles transverses)

- **INV-PRICE** : le prix affiché = le prix débité. `resolveProductPricing` est la source unique
  (affichage, snapshot, order). Tout test de parcours vérifie la **parité 199 MAD** entre `/kit` et la commande.
- **INV-422** : `expectedTotalCents` envoyé = prix d'affichage (après crédit, plancher 0). Mismatch ⇒ `PriceMismatchError`.
- **INV-BUCKET** : `(visitorKey, couponId)` ⇒ bucket déterministe et stable entre Server Component et API.
- **INV-IDEMP-ORDER** : un `sourceOrderId` ⇒ au plus un grant (réémission renvoie l'existant).
- **INV-IDEMP-PHONE** : un téléphone ⇒ au plus un grant `issued` actif (anti-farming).
- **INV-ACTIVATION** : `activatesAt = orderDate + maxDeliveryDays(eta) + 1j` ; avant ⇒ `not_yet_active`.
- **INV-VALIDITY** : `expiresAt = activatesAt + 60j` ; après ⇒ `expired`.
- **INV-PII** : le téléphone n'apparaît **jamais** en clair côté admin (masqué `06…78`) ni dans les logs.
- **INV-PERM** : `read` (lister), `write` (créer), `publish` (transition statut), `delete` (archiver) — RBAC strict.
- **INV-NONCUMUL** : un seul coupon prix à la fois ; welcome (auto) + crédit fidélité (manuel) peuvent coexister sur des lignes distinctes.

## 5. Définition de « fini » (DoD) par fonctionnalité

- `spec.md` rédigée (contrat I/O + cas limites + critères d'acceptation + invariants couverts).
- `test-cases.csv` dense (happy + non-happy + frontières + a11y/charte si UI).
- `scenarios.md` (Gherkin, ≥1 happy + ≥2 edges, persona réaliste).
- `fixtures.json` (données minimales valides + variantes d'erreur).
- `flow.puml` si état/séquence non triviale.
- Code de test **implémenté et vert**, lint + typecheck OK, anti-flaky (3 runs) pour l'UI/E2E.
- Entrée dans `traceability-matrix.csv`.
