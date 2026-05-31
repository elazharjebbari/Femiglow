# Audit module Pages légales — 2026-05

> **Symptômes signalés par la fondatrice (27 mai 2026)** :
> 1. *"Sur des documents on me demande des variables dont je n'ai pas besoin"*
> 2. *"Même quand je rempli tout, parfois ça ne passe pas"*
> 3. *"Cacher les infos sensibles (ICE, adresse, infos entreprise) — afficher en mode incomplet et dire que pour les recevoir il faut envoyer un email"*
> 4. *"Anonymiser le prénom de la fondatrice partout"*

Ce dossier consolide l'audit approfondi (preview admin live + lecture du code + queries DB) et propose un plan de remédiation chiffré.

## Sommaire

| Fichier | Contenu |
|---|---|
| [`01-audit-detail.md`](./01-audit-detail.md) | Audit complet — 5 dysfonctionnements identifiés + évidence |
| [`02-evidence-observations.md`](./02-evidence-observations.md) | Données preview + DB locale (counts, drift, content) |
| [`03-recommandations.md`](./03-recommandations.md) | Plan de fix en 3 niveaux + roadmap |

## TL;DR — 5 causes racines

| # | Cause | Impact | Sévérité |
|---|---|---|---|
| **D1** | **Drift naming massif** entre vars utilisées dans `body_md` et vars définies en `legal_template_vars` (ex. template utilise `{{CONTACT_EMAIL}}` mais DB définit `COMPANY_EMAIL`). 9+ paires divergent. | Le bug "rempli tout mais ça passe pas" : la fondatrice remplit `COMPANY_EMAIL` mais la page exige `CONTACT_EMAIL` qui n'existe pas → bloqué au publish. | 🔴 **Critique** |
| **D2** | **6 variables utilisées dans templates non définies en DB** (`COOLING_OFF_DAYS`, `CURRENCY`, `DATA_RETENTION_YEARS`, `DELIVERY_PARTNER`, `PAYMENT_PROVIDERS`, `SUPPORT_HOURS`, `VERSION`). Marquées "manquantes" mais impossibles à remplir car non répertoriées. | Pages bloquées au publish + console admin affiche "VARS MANQUANTES" sans solution. | 🔴 **Critique** |
| **D3** | **Vars sensibles exposées publiquement** dans les pages publiées (ICE, COMPANY_RC, COMPANY_ADDRESS, COMPANY_FORM, DIRECTOR_NAME). Ces données privées de l'entreprise apparaissent en clair sur `/legal/mentions-legales`, `/legal/cgv`, etc. | Confidentialité business compromise. Demande explicite fondatrice : "afficher en mode incomplet, contact email pour obtenir". | 🟠 **Haute** |
| **D4** | **5 pages test E2E orphelines** en brouillon (`e2e-test-1778730754041`…) jamais nettoyées par les tests. | Pollution console admin (28% des entrées sont du bruit). | 🟡 **Moyenne** |
| **D5** | **Prénom de la fondatrice présent dans 9 fichiers code marketing** (pas dans DB légale). Pages publiques `/maison`, `/contact`, `/kit`, `/rituel` + 3 fichiers admin internes. | Demande explicite fondatrice : anonymiser partout. | 🟡 **Moyenne** |

## Tableau état actuel (DB locale)

### Pages

| Slug | Statut | body_md | Vars utilisées |
|---|---|---|---|
| `mentions-legales` | published | 3220 ch | COMPANY_NAME, COMPANY_FORM, COMPANY_RC, COMPANY_ADDRESS, COMPANY_CAPITAL, ICE, DIRECTOR_NAME, CNDP_DECLARATION_REF, HOST_NAME, HOST_ADDRESS, HOST_CONTACT, IF, LAST_UPDATED, SITE_URL, VERSION |
| `cgv` | published | 7823 ch | COMPANY_NAME×10, COMPANY_RC, ICE, CONTACT_EMAIL×3, CONTACT_PHONE×2, COOLING_OFF_DAYS, CURRENCY×2, PAYMENT_PROVIDERS×2, SITE_URL×2, SUPPORT_HOURS, LAST_UPDATED, VERSION |
| `confidentialite` | published | 7223 ch | COMPANY_NAME, COMPANY_FORM, COMPANY_RC, COMPANY_ADDRESS, ICE, CNDP_DECLARATION_REF, DATA_RETENTION_YEARS, DELIVERY_PARTNER, HOST_NAME, PAYMENT_PROVIDERS, SUPPORT_HOURS, VERSION, LAST_UPDATED |
| `cookies` | published | 4750 ch | CONTACT_EMAIL, SITE_URL, VERSION, LAST_UPDATED |
| `faq` | published | 7713 ch | COMPANY_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE, COOLING_OFF_DAYS, PAYMENT_PROVIDERS, SUPPORT_HOURS, VERSION, LAST_UPDATED |
| `livraison` | published | 5047 ch | CONTACT_EMAIL, CONTACT_PHONE, DELIVERY_PARTNER, SUPPORT_HOURS, VERSION, LAST_UPDATED |
| `cgu` | draft | 6222 ch | COMPANY_NAME×12, CONTACT_EMAIL×4, SITE_URL×4, VERSION, LAST_UPDATED |
| `retours-remboursements` | draft | 6182 ch | COMPANY_NAME, COMPANY_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE, COOLING_OFF_DAYS, SUPPORT_HOURS, VERSION, LAST_UPDATED |
| `securite-produits` | draft | 6931 ch | CONTACT_EMAIL, CONTACT_PHONE, SUPPORT_HOURS, VERSION, LAST_UPDATED |
| `e2e-test-1778...` × 5 | draft | 43 ch | — (orphelins) |

### Variables (17 en DB)

| Key | Required | Filled | Drift template |
|---|---|---|---|
| `CNDP_DECLARATION` | ✅ | ✅ | ⚠️ Template utilise `CNDP_DECLARATION_REF` |
| `COMPANY_ADDRESS` | ✅ | ✅ | OK |
| `COMPANY_CAPITAL` | ❌ | ❌ | OK |
| `COMPANY_EMAIL` | ✅ | ✅ | ⚠️ Template utilise `CONTACT_EMAIL` |
| `COMPANY_FORM` | ✅ | **❌ vide** | OK |
| `COMPANY_NAME` | ❌ | ✅ | OK |
| `COMPANY_PATENTE` | ❌ | ❌ | Inutilisée |
| `COMPANY_PHONE` | ✅ | ✅ | ⚠️ Template utilise `CONTACT_PHONE` |
| `COMPANY_RC` | ✅ | **❌ vide** | OK |
| `COMPANY_TVA` | ❌ | ❌ | Inutilisée |
| `DIRECTOR_NAME` | ✅ | ✅ | OK |
| `DPO_EMAIL` | ✅ | ✅ | Inutilisée |
| `HOSTING_ADDRESS` | ✅ | **❌ vide** | ⚠️ Template utilise `HOST_ADDRESS` |
| `HOSTING_NAME` | ✅ | **❌ vide** | ⚠️ Template utilise `HOST_NAME` |
| `HOSTING_PHONE` | ❌ | ❌ | ⚠️ Template utilise `HOST_CONTACT` |
| `ICE` | ✅ | **❌ vide** | OK |
| `LAST_UPDATED` | ✅ | ✅ | OK |

**Vars utilisées dans templates mais NON définies en DB** (sources des "vars manquantes" sans solution UI) :
- `CNDP_DECLARATION_REF` (vs DB `CNDP_DECLARATION`)
- `CONTACT_EMAIL` (vs DB `COMPANY_EMAIL`)
- `CONTACT_PHONE` (vs DB `COMPANY_PHONE`)
- `HOST_ADDRESS` (vs DB `HOSTING_ADDRESS`)
- `HOST_NAME` (vs DB `HOSTING_NAME`)
- `HOST_CONTACT` (vs DB `HOSTING_PHONE`)
- `COOLING_OFF_DAYS` (pas en DB)
- `CURRENCY` (pas en DB)
- `DATA_RETENTION_YEARS` (pas en DB)
- `DELIVERY_PARTNER` (pas en DB)
- `PAYMENT_PROVIDERS` (pas en DB)
- `SUPPORT_HOURS` (pas en DB)
- `VERSION` (pas en DB — devrait être un preset comme `LAST_UPDATED`)

## Liens rapides

- 🛠 **Plan de remédiation détaillé** : [`03-recommandations.md`](./03-recommandations.md)
- 📊 **Évidence brute** : [`02-evidence-observations.md`](./02-evidence-observations.md)
- 📋 **Audit complet** : [`01-audit-detail.md`](./01-audit-detail.md)

## Notes

- Cet audit est observationnel — aucun fix appliqué. Les recommandations sont dans `03-recommandations.md`.
- Cohérent avec pattern audit `docs/chat-conversations-leads-audit-2026-05/`.
- Memory rappelle : ne jamais mentionner le prénom de la fondatrice (cf. D5).
