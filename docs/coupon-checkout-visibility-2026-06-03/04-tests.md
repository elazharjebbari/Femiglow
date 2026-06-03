# 04 — Stratégie de test (Vitest · MSW · Playwright)

## Pyramide
- **Unit/Intégration (Vitest + RTL)** : `WizardCartRecap` — la ligne welcome (présentation pure, pas de réseau → pas de MSW nécessaire ici).
- **MSW** : non requis pour cette feature (résolution serveur, pas d'appel client). MSW reste pertinent pour les features coupon existantes ; ici on s'appuie sur le rendu serveur + props.
- **E2E (Playwright)** : présence de la mention dans le wizard (parcours visiteur).

## Cas de test

### Vitest — `WizardCartRecap.welcome.test.tsx`
| id | titre | oracle |
|---|---|---|
| W1 | coupon actif + compareAt → ligne visible | `getByTestId('wizard-welcome-coupon')` présent |
| W2 | économie absolue affichée (90 MAD) | contient `90 MAD` (compareAt 28900 − total 19900) |
| W3 | accent économie = terracotta (pas de rouge) | classe/texte « Économie » ; pas de `text-red` |
| W4 | coupon inactif → ligne absente (non-régression) | `queryByTestId('wizard-welcome-coupon')` null ; total inchangé |
| W5 | pas de compareAt → ligne absente | null |
| W6 | charte : pas de « ! », pas d'emoji, pas de « promo/réduction/% » | assertions sur textContent |
| W7 | cumul crédit fidélité : welcome + ligne crédit coexistent, total correct | les deux testids présents, total = 179 |
| W8 | i18n ar : libellé arabe + dir | `dir=rtl` hérité ; libellé ar |

### Vitest — non-régression
- `WizardCartRecap.coupon.test.tsx` (crédit) + tout test existant du récap restent **verts** (prop welcome défaut absente).

### Playwright — `e2e/coupon-checkout.spec.ts` (tag `@coupon-checkout`)
| id | titre | oracle |
|---|---|---|
| E1 | wizard rendu → mention geste d'accueil visible | `wizard-welcome-coupon` visible dans `wizard-cart-recap` |
| E2 | « Économie 90 MAD » présente, pas de countdown/rouge | texte présent ; absence sélecteurs interdits |
| E3 | (robuste) si coupon inactif en env → test.skip | conditionnel sur présence |

## Gates
- `tsc --noEmit` = 0 erreur.
- Tous W1–W8 verts + non-régression récap.
- E2E vert (ou skip propre si coupon non seedé en CI).
- Charte : 0 occurrence de rouge/`!`/emoji/`%` dans la mention.
- `/kit` 200, aucune régression SSR.
