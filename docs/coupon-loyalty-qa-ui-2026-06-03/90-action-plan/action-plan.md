# Plan d'action global — batterie QA UI coupon/fidélité

> Exécution **par vagues**, chaque vague close par une **porte de qualité** (`00-overview/quality-gates.yaml`).
> Centre de gravité UI : on remplit les strates composant + contrat + e2e qui manquaient.
> Toute commande depuis `apps/web/`. La **boucle de correction** (§3) s'applique à chaque vague.

## 1. Vue d'ensemble des vagues

| Vague | Objet | Features | Couche | Sortie (gate) |
|---|---|---|---|---|
| **W0** | Fondations | infra MSW + fixtures | M | `coupons-handlers.ts` + smoke vert ✅ |
| **W1** | Contrats API | F05, F06, F07, F14, F15 | I | tous verts |
| **W2** | Composants admin | F01, F02, F03, F04 | C+M | tous verts |
| **W3** | Composants client | F08, F09, F10, F11, F12, F13 | C+M+U | tous verts |
| **W4** | Intégration & règles métier | F19, F20 | I | tous verts |
| **W5** | E2E parcours | F16, F17, F18 | E+A | tous verts + a11y |
| **W6** | Durcissement | tous | — | anti-flaky 3x, lint+typecheck 0, traçabilité |

Ordre choisi : **de l'intérieur vers l'extérieur** (contrats → composants → e2e). On stabilise les
frontières réseau (W1) avant de tester les composants qui en dépendent (W2/W3), puis on couronne par
les parcours réels (W5). W4 (règles métier) peut tourner en parallèle de W2/W3 (aucune dépendance).

## 2. Détail par vague

### W0 — Fondations ✅
- `apps/web/src/test/msw/coupons-handlers.ts` : `couponsAdminHandlers` (stateful), `redeemHandlers`, `maskedGrant`, `draftCoupon`, `CouponFailMap`.
- `coupons-handlers.smoke.test.ts` : 5 cas (stateful create→refresh, 409 archivé, échec injecté, filtre grants masqué, redeem mappé). **Vert.**

### W1 — Contrats API (couche I)
- **F14** `src/app/api/coupons/redeem/route.test.ts` — exhaustif des `reason` (valid/not_found/not_yet_active/expired/already_redeemed) + `invalid_input`→422 + `error`→200(catch). Setup memoryStore + `issueGrant`/`redeemGrant`, `now` injecté.
- **F05** `src/app/api/admin/coupons/[id]/status/route.test.ts` — RBAC `publish` (401/403), `archived`→active = 409, statut invalide 422, id inconnu 404, spies `revalidateTag` x2 + `logAuditEvent{from,to}`.
- **F06** `src/app/api/admin/coupons/[id]/stats/route.test.ts` — RBAC `read`, agrégation treatment/holdout, `noControl`, `lowSample` (borne <100), 404.
- **F07** `src/app/api/admin/coupons/grants/route.filters.test.ts` — filtre `status`, combiné phone+status, vide, tri desc, masquage (étend l'existant sans le rejouer).
- **F15** `src/app/api/coupons/rescue/route.test.ts` — étend : log non bloquant, exception engine → `show:false`, déterminisme bucket, fallback cookie.

### W2 — Composants admin (couche C+M)
- **F01** `CouponsManager.create.test.tsx` — happy (stateful refresh affiche la ligne), payload POST exact, erreurs 403/409/422/500/`network`(→« Erreur réseau. »), `busy` désactive, `role=alert`, charte.
- **F02** `CouponsManager.status.test.tsx` — matrice visibilité boutons par statut, chaque transition + refresh, lock archivé, erreurs, `busy`.
- **F03** `CouponsManager.stats.test.tsx` — span lazy `coupon-stats-{id}`, format `X.X pts` / `—` / `(pas de contrôle)`, échec silencieux (pas de `role=alert`).
- **F04** `CouponsManager.grants.test.tsx` — `Charger`→`Rafraîchir`, masquage PII (`/…/` & pas de 6 chiffres), dates fr-MA, vide, échec silencieux.

### W3 — Composants client (couche C+M+U)
- **F08** `InvitationCodeField.msw.test.tsx` — idle→checking→valid (onValid upper), invalid (`role=alert`), anti-stale (onClear), <3 chars = 0 requête, AR. (via `redeemHandlers`).
- **F09** `AddressStep.coupon.test.tsx` — disclosure fermée/ouverte selon store, `setCoupon`/`clearCoupon`, INV-422 (`expectedTotalCents`). Mock `useAddressMutation`/`CityAutocomplete`, seed store.
- **F10** `WizardCartRecap.credit.test.tsx` — clamp crédit négatif, crédit==total, floor 0, devise AR, coexistence welcome+crédit, terracotta.
- **F11** `ThankYouStep.loyalty.test.tsx` — rendu conditionnel `loyalty?.code`, copie clipboard, date civile, AR, INV-PII.
- **F12** `CouponWelcomeNote.test.tsx` — régression + `endsAtLabel`/charte/disclosure (étend l'existant).
- **F13** `wizard-store.loyalty.test.ts` — `setLoyalty`, clamp crédit, contrat `partialize` (persiste couponCode+loyalty, **pas** creditCents).

### W4 — Intégration & règles métier (couche I)
- **F19** `pricing-integration.test.ts` — parité tri-point `resolveProductPricing`, holdout (ref gardée, prix plein), déterminisme bucket, éligibilité en contexte, non-cumul + tie-break, garde anti-422.
- **F20** `coupon-grant-repo.activation.test.ts` — `maxDeliveryDays`, `computeActivatesAt` (+buffer), format code, idempotence order+phone, `expiresAt`+60j, bornes inclusives `validateGrant`.

### W5 — E2E parcours (couche E+A)
- **F16** `e2e/admin-coupons-loyalty.spec.ts` — opérateur : créer→activer→badge `Actif`→/kit parité 199 MAD→grants masqués.
- **F17** `e2e/loyalty-issuance.spec.ts` — cliente : wizard lead→address→order(COD)→`loyalty-code-card` `FG-…`, date civile, pas de téléphone en clair.
- **F18** `e2e/loyalty-redemption.spec.ts` — saisie d'un code **pré-activé** → `wizard-credit-line` → total 199→179 → POST order 201 (INV-422).
- A11y : `@a11y` axe sans violation critique/serious sur /kit + thank_you + /admin/coupons.

**⚠ Bloqueur F18 (résolu, cf. runbook §Préconditions)** : un code fraîchement émis est `not_yet_active`
(`activatesAt` futur). F18 exige un grant `activatesAt` passé → pré-activation via
`scripts/_loyalty-activate-now.ts <code>` exécuté dans le `globalSetup` Playwright **ou** seed dédié.
Décision : **seed dédié déterministe** `scripts/seed-e2e-loyalty.ts` (template post_purchase actif +
grant pré-activé sur un téléphone de test), invoqué avant la suite F18. Pas de hook HTTP en prod.

### W6 — Durcissement
- `--repeat-each 3` sur tous les fichiers C/E/A → 0 flaky.
- `pnpm typecheck` = 0, `pnpm lint` = 0.
- Mettre à jour `00-overview/traceability-matrix.csv` (statut_impl=fait) + `feature-inventory.csv` (statut=fait).
- Rapport final `90-action-plan/decision-log.md` (écarts, choix, dette résiduelle).

## 3. Boucle de correction (appliquée à chaque vague)

```
   ┌─────────────────────────────────────────────────────────────┐
   │ 1. ÉCRIRE le(s) fichier(s) de test de la feature (depuis le   │
   │    test-cases.csv du sous-dossier).                           │
   │ 2. RUN ciblé : pnpm test <fichier>  (ou playwright test …)    │
   │ 3. ROUGE ?                                                    │
   │    a. Échec d'ORACLE attendu d'un vrai bug produit            │
   │       → consigner dans decision-log.md (BUG-xx) + décider     │
   │         (corriger le produit si bug, sinon ajuster l'oracle). │
   │    b. Échec de SETUP (mock/MSW/store) → corriger le test.     │
   │ 4. VERT → run de NON-RÉGRESSION du périmètre coupon :         │
   │    pnpm test src/lib/coupons src/components/.../coupons …      │
   │ 5. ANTI-FLAKY (C/E/A) : --repeat-each 3.                      │
   │ 6. typecheck + lint sur le delta. Passer à la feature suiv.   │
   └─────────────────────────────────────────────────────────────┘
```

Règle d'or : **un test rouge n'est jamais « skippé »**. Soit il révèle un bug (→ ticket + decision-log),
soit le test/oracle est faux (→ corriger). Aucun `it.skip` non justifié ne survit à W6.

## 4. Critères de sortie globale (DoD dossier)
- 20 features : docs complètes + code de test vert.
- `quality-gates.yaml` toutes vertes.
- Traçabilité à jour, decision-log rempli.
- Aucune PII en clair, charte respectée, anti-flaky OK.
