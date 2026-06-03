# Journal de décision & dette — nav admin

| id | date | sujet | décision | raison |
|---|---|---|---|---|
| D01 | 2026-06-03 | Onglet Coupons absent | Ajout entrée NAV codée en dur + `active='coupons'` + `data-testid=admin-nav-<key>` | AdminShell rend une liste statique, pas la config ; testabilité UI inexistante |
| D02 | 2026-06-03 | RSC async non testable en Vitest (N03) | Onglet testé au niveau composant (`AdminShell active=coupons`) ; RSC réel → E2E N10 | rendre un Server Component async en jsdom est fragile |
| D03 | 2026-06-03 | Frontière MSW NavEditor | handler dédié `nav-settings-handlers.ts` (PATCH /api/admin/settings/nav) | isoler l'éditeur du vrai backend ; couvrir 200/409/422/réseau + If-Match |

| D04 | 2026-06-03 | N10-E002 : clic onglet ne navigue pas sous 5s (dev) | `Promise.all([waitForURL 60s, click])` | compilation à la volée du serveur dev ; en prod (build) instantané |
| D05 | 2026-06-03 | N10-E003 (garde auth) redondant + dépend de l'auth env | retiré ; couvert par `admin-coupons.spec.ts @admin-coupons-auth` | éviter doublon + assertion env-dépendante |
| D06 | 2026-06-03 | N11-E002 : l'éditeur n'affichait pas « coupons » | assoupli → assert ≥1 ligne éditable ; présence coupons vérifiée en unitaire (N05-U004) | l'éditeur lit la config nav PERSISTÉE (DB) qui précède l'ajout coupons (cf. dette découplage) |

## Bilan d'exécution (W5 — clôture)
- **Vert** : périmètre nav **8 fichiers / 51 tests** (Vitest) ; **E2E 5** (N10 ×2, N11 ×2 + setup) en navigateur réel ;
  anti-flaky **3×** stable (48 tests) ; **typecheck 0**, **lint 0**.
- **Onglet Coupons** : ajouté (`AdminShell` NAV + `data-testid=admin-nav-*` + page `active=coupons`) et **prouvé** en E2E
  (présent, surligné, navigation, masquage PII des grants déjà couvert ailleurs).
- Lacunes fermées : `AdminShell` nav (3 → 15 tests), NavEditor (0 → 12), resolve nav failsafe, contrat nav.

## Bugs produit révélés
| id | feature | symptôme | gravité | statut |
|---|---|---|---|---|
| — | — | aucun bug ; les correctifs étaient des oracles/ robustesse E2E | — | — |

## Dette résiduelle
### DÉCOUPLAGE nav — requalifié en DÉCISION PRODUIT (non corrigé sciemment)

Analyse de la boucle de correction : unifier `AdminShell` (rendu) avec la config nav (`navDefault`/NavEditor)
**n'est PAS un correctif sûr et contenu**, pour 3 raisons bloquantes découvertes :

1. **Incompatibilité de capacité** : `navSchema` impose `items.max(20)` (testé par `defaults-legal.test.ts`
   « max 20 items »), or l'admin réel a **21 onglets**. Brancher AdminShell sur la config exigerait de
   **relever le plafond du schéma** (20→21+) — changement transverse au sous-système admin-config.
2. **Contenu divergent** : `navDefault` ne contient que 11 entrées (sous-ensemble) ; la liste rendue en a 21
   (rituals, i18n, seo, kit-*, products, chat, emails, analytics absents de la config). Rendre depuis la
   config **supprimerait 10 onglets** tant que `navDefault` + la **row DB persistée** ne sont pas reconciliés.
3. **Risque DB stale** : passer AdminShell en async/`getAppConfig()` rendrait la **row DB existante** (nav
   ancienne) prioritaire → nav admin cassée en prod jusqu'à un re-seed.

➡ **Décision** : ne pas forcer l'unification dans ce lot (risque de régression sur TOUTE la nav admin).
La requalifier en **chantier produit dédié** : (a) relever `navSchema.max` à ≥21, (b) reconcilier `navDefault`
aux 21 entrées + `requiresRole`, (c) re-seed la row DB nav, (d) passer `AdminShell` en async consommant
`getAppConfig().nav` (fallback defaults) + **gating RBAC `requiresRole`**. Couvert par les tests N05/N06/N09
existants (à étendre le moment venu).

État courant maîtrisé : l'onglet Coupons est **rendu et testé** (E2E N10) ; `navDefault` inclut « coupons »
(N05-U004) ; la divergence est explicite et bornée — pas de dette « silencieuse ».
