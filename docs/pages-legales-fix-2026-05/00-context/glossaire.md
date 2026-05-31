# Glossaire technique

Vocabulaire utilisé tout au long du dossier.

| Terme | Définition |
|---|---|
| **Page légale** | Row dans `legal_pages` avec un `slug`, `body_md`, `status`, `version`. Servie sur `/legal/<slug>`. |
| **Template var** | Placeholder `{{KEY}}` dans le `body_md` d'une page. Substitué à la lecture par `substituteVars`. |
| **`legal_template_vars`** | Table DB qui stocke les valeurs des variables : `key`, `label`, `value`, `is_required`, etc. |
| **Drift naming** | Désynchronisation entre les `{{KEY}}` utilisées dans `body_md` et les `key` définies en `legal_template_vars`. Cause racine D1. |
| **Preset var** | Variable calculée automatiquement à l'exécution (pas stockée en DB). Aujourd'hui : `LAST_UPDATED`, `CURRENT_YEAR`, `SITE_URL`. Sera étendu à `VERSION`. |
| **`substituteVars(md, map, mode)`** | Helper qui remplace `{{KEY}}` par la valeur. Mode `public` → fallback `[KEY]`, mode `admin-preview` → marker `⦉KEY⦊`. |
| **`detectMissingVars(md, dbVars)`** | Retourne les vars utilisées dans le markdown qui sont (a) non définies en DB OU (b) requises et vides. |
| **Publish workflow** | `draft` → `review` (optionnel) → `published`. Validation : confirm text "PUBLIER", 4-eyes (si `requireLegalReview=true`), pas de vars manquantes. |
| **4-eyes** | L'admin qui soumet en review ne peut pas publier elle-même (sauf si `requireLegalReview=false`). |
| **Page orpheline** | Row `legal_pages` avec slug `e2e-test-*`, status=draft, body_md trivial. Créée par test Playwright sans cleanup. |
| **`presetVarsForPage`** | Nouveau helper (post-fix) : `presetVars()` + `VERSION` + `LAST_UPDATED` dérivés de la page courante. |
| **Anonymisation** | Remplacer `{{ICE}}`, `{{COMPANY_RC}}`, etc. par un bloc "info sur demande email". |
| **LEGAL_VARS_V2** | Feature flag env var. Si `true`, helper publish accepte les nouveaux noms de vars (CONTACT_EMAIL, etc.). |
| **Seed défauts** | Bouton admin qui INSERT les 9 pages source depuis `docs/legal-pages/60-content/*.md`. Préserve les édits admin (UPDATE sélectif). |

## Préfixes d'ID

| Préfixe | Origine | Table |
|---|---|---|
| `lp_<chars>` | `createId('lp')` | `legal_pages.id` |
| `lph_<chars>` | `createId('lph')` | `legal_pages_history.id` |
| `ltv_<chars>` | `createId('ltv')` | `legal_template_vars.id` |
| `lpe_<chars>` | `createId('lpe')` | `legal_placements.id` |
| `lpr_<chars>` | `createId('lpr')` | `legal_redirects.id` |

## Sigles juridiques marocains

- **ICE** : Identifiant Commun de l'Entreprise (15 chiffres)
- **RC** : Registre du Commerce (format `Ville-NNNNN`)
- **CNDP** : Commission Nationale de contrôle de la Protection des Données à caractère Personnel
- **ANRT** : Agence Nationale de Réglementation des Télécommunications
- **CGV** : Conditions Générales de Vente
- **CGU** : Conditions Générales d'Utilisation
- **DPO** : Délégué à la Protection des Données
- **DGSN** : Direction Générale de la Sûreté Nationale

## Sigles techniques

- **DoD** — Definition of Done
- **ADR** — Architecture Decision Record
- **MSW** — Mock Service Worker
- **SSR** — Server-Side Rendering
- **RSC** — React Server Components
- **PII** — Personally Identifiable Information
- **GDPR / RGPD** — Règlement européen / loi marocaine 09-08 équivalente
