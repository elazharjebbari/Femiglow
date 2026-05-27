# Recap audit — synthèse des 5 dysfonctionnements

> Source complète : [`docs/pages-legales-audit-2026-05/01-audit-detail.md`](../../pages-legales-audit-2026-05/01-audit-detail.md).

## Symptômes constatés

1. *"On me demande des variables dont je n'ai pas besoin"* — la fondatrice voit des "VARS MANQUANTES" qu'elle ne peut pas remplir depuis l'admin.
2. *"Même quand je rempli tout, parfois ça ne passe pas"* — publish bloqué par `missing_required_vars` malgré template-vars rempli.
3. *"Cacher les infos sensibles (ICE, adresse, infos entreprise)"* — ces données apparaissent en clair sur les pages publiées.
4. *"Anonymiser le prénom de la fondatrice partout"* — présent dans 9 fichiers code marketing.

## Les 5 causes racines

### D1 — Drift naming massif templates ↔ DB 🔴

Les templates utilisent un naming différent de la DB `legal_template_vars` :

| Template | DB | Drift |
|---|---|---|
| `{{CONTACT_EMAIL}}` (9 pages) | `COMPANY_EMAIL` | ⚠️ |
| `{{CONTACT_PHONE}}` (7 pages) | `COMPANY_PHONE` | ⚠️ |
| `{{HOST_ADDRESS}}` (1 page) | `HOSTING_ADDRESS` | ⚠️ |
| `{{HOST_NAME}}` (2 pages) | `HOSTING_NAME` | ⚠️ |
| `{{HOST_CONTACT}}` (1 page) | `HOSTING_PHONE` | ⚠️ |
| `{{CNDP_DECLARATION_REF}}` (2 pages) | `CNDP_DECLARATION` | ⚠️ |

→ La fondatrice remplit `COMPANY_EMAIL`, mais le markdown demande `CONTACT_EMAIL` qui n'est pas en DB → publish bloqué.

### D2 — Variables utilisées sans définition DB 🔴

7 vars référencées dans `body_md` mais **absentes** de `legal_template_vars` :

- `COOLING_OFF_DAYS` (3 pages — devrait valoir `7`)
- `CURRENCY` (1 page — devrait valoir `MAD`)
- `DATA_RETENTION_YEARS` (1 page — devrait valoir `3`)
- `DELIVERY_PARTNER` (2 pages — à remplir)
- `PAYMENT_PROVIDERS` (3 pages — `CMI` etc.)
- `SUPPORT_HOURS` (7 pages — `Lun-Ven 9h-18h`)
- `VERSION` (9 pages — devrait être un preset auto)

→ Console admin affiche "VARS MANQUANTES" mais aucun champ pour y remplir.

### D3 — Vars sensibles exposées publiquement 🟠

`/legal/mentions-legales` et `/legal/cgv` exposent (ou exposeraient) :

- ICE (15 chiffres)
- COMPANY_RC (Registre Commerce)
- COMPANY_ADDRESS (adresse siège)
- COMPANY_FORM (SARL AU / EI / SA)
- DIRECTOR_NAME
- COMPANY_CAPITAL
- HOST_ADDRESS

→ Demande fondatrice : remplacer par *"info sur demande à legal@femiglow-maroc.com"*.

### D4 — 5 pages test E2E orphelines 🟡

Slugs `e2e-test-1778730xxx` créés par un test Playwright sans cleanup. 36% des entrées admin sont du bruit.

### D5 — Prénom fondatrice dans 9 fichiers code 🟡

Pages marketing (`/maison`, `/contact`, `/kit`, `/rituel`) + 3 fichiers admin internes. 0 en DB légale ✅.

## Pourquoi maintenant ?

- Les 3 drafts critiques (CGU, retours, sécurité-produits) sont bloqués au publish → non-conformité juridique.
- Risque amende ANRT/CNDP si T&C absents.
- Données sensibles (ICE) potentiellement scrappables.
- Demande explicite fondatrice anonymisation.

## Ce que ce sprint VA faire

- ✅ Migration SQL `0075_legal_vars_rename_and_add` : rename 6 vars + ajout 7 manquantes
- ✅ Refonte 4 templates : ICE/RC/adresse → "info sur demande email"
- ✅ Cleanup 5 pages E2E orphelines + fix test Playwright fautif
- ✅ Anonymisation prénom dans 9 fichiers marketing
- ✅ `VERSION` ajouté en preset auto (`presetVarsForPage`)
- ✅ UI : bouton "+ Nouvelle variable" sur `/admin/legal/template-vars`
- ✅ Feature flag `LEGAL_VARS_V2` pour rollback safe

## Ce qu'on NE fera PAS

- ❌ DELETE des données historiques (uniquement UPDATE/INSERT)
- ❌ Modification du schéma `legal_pages` (table inchangée)
- ❌ Suppression de pages publiées (refonte = nouvelle version via republish)
- ❌ Modification du flow approval/review (4-eyes preservé)
