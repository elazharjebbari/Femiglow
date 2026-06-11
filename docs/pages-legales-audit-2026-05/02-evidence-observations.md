# Évidence preview admin + DB

> **Setup** : Node v20.10.0, pnpm 9.15.9, dev server local sur port 3001, DB Postgres locale.
> **Auth** : `admin@femiglow.local`.
> **Date snapshot** : 27 mai 2026.

## 1. Inventaire pages (DB locale)

```sql
SELECT slug, title, status, length(body_md) AS body_size
FROM legal_pages ORDER BY title;
```

| slug | title | status | body_size |
|---|---|---|---|
| `cgu` | Conditions Générales d'Utilisation | draft | 6222 |
| `cgv` | Conditions Générales de Vente | **published** | 7823 |
| `faq` | FAQ — Service client | **published** | 7713 |
| `mentions-legales` | Mentions légales | **published** | 3220 |
| `e2e-test-1778730754041` | Page de test E2E | draft | 43 |
| `e2e-test-1778729926485` | Page de test E2E | draft | 43 |
| `e2e-test-1778730063625` | Page de test E2E | draft | 43 |
| `e2e-test-1778730444648` | Page de test E2E | draft | 43 |
| `e2e-test-1778730581104` | Page de test E2E | draft | 43 |
| `cookies` | Politique cookies | **published** | 4750 |
| `confidentialite` | Politique de confidentialité | **published** | 7223 |
| `livraison` | Politique de livraison | **published** | 5047 |
| `retours-remboursements` | Politique de retours et remboursements | draft | 6182 |
| `securite-produits` | Sécurité et avertissements produits cosmétiques | draft | 6931 |

**Total** : 14 pages — 6 publiées, 8 drafts (dont 5 orphelins E2E).

## 2. Inventaire variables DB

```sql
SELECT key, label, is_required, value IS NOT NULL AND value != '' AS filled
FROM legal_template_vars ORDER BY key;
```

| key | label | is_required | filled |
|---|---|---|---|
| `CNDP_DECLARATION` | CNDP — déclaration | ✅ | ✅ |
| `COMPANY_ADDRESS` | Adresse siège | ✅ | ✅ |
| `COMPANY_CAPITAL` | Capital social | ❌ | ❌ |
| `COMPANY_EMAIL` | Email contact | ✅ | ✅ |
| `COMPANY_FORM` | Forme juridique | ✅ | **❌ VIDE** |
| `COMPANY_NAME` | Nom légal | ❌ | ✅ |
| `COMPANY_PATENTE` | Numéro patente | ❌ | ❌ |
| `COMPANY_PHONE` | Téléphone | ✅ | ✅ |
| `COMPANY_RC` | RC (Registre Commerce) | ✅ | **❌ VIDE** |
| `COMPANY_TVA` | Numéro TVA | ❌ | ❌ |
| `DIRECTOR_NAME` | Directeur publication | ✅ | ✅ |
| `DPO_EMAIL` | Email DPO | ✅ | ✅ |
| `HOSTING_ADDRESS` | Hébergeur — adresse | ✅ | **❌ VIDE** |
| `HOSTING_NAME` | Hébergeur — nom | ✅ | **❌ VIDE** |
| `HOSTING_PHONE` | Hébergeur — téléphone | ❌ | ❌ |
| `ICE` | ICE | ✅ | **❌ VIDE** |
| `LAST_UPDATED` | Dernière mise à jour | ✅ | ✅ |

**5 vars `required` non remplies** : COMPANY_FORM, COMPANY_RC, HOSTING_ADDRESS, HOSTING_NAME, ICE.

## 3. Vars utilisées dans les templates (regex extraction)

```sql
WITH page_vars AS (
  SELECT slug, status,
         regexp_matches(body_md, '\{\{([A-Z][A-Z0-9_]*)\}\}', 'g') AS m
  FROM legal_pages WHERE slug NOT LIKE 'e2e%'
)
SELECT m[1] AS var_used, COUNT(DISTINCT slug) AS pages, array_agg(DISTINCT slug)
FROM page_vars GROUP BY m[1] ORDER BY var_used;
```

| Variable utilisée | # pages | Slugs concernés |
|---|---|---|
| `CNDP_DECLARATION_REF` | 2 | confidentialite, mentions-legales |
| `COMPANY_ADDRESS` | 4 | confidentialite, faq, mentions-legales, retours-remboursements |
| `COMPANY_CAPITAL` | 1 | mentions-legales |
| `COMPANY_FORM` | 2 | confidentialite, mentions-legales |
| `COMPANY_NAME` | 5 | cgu, cgv, confidentialite, mentions-legales, retours-remboursements |
| `COMPANY_RC` | 3 | cgv, confidentialite, mentions-legales |
| `CONTACT_EMAIL` | 9 | cgu, cgv, confidentialite, cookies, faq, livraison, mentions-legales, retours-remboursements, securite-produits |
| `CONTACT_PHONE` | 7 | cgv, confidentialite, faq, livraison, mentions-legales, retours-remboursements, securite-produits |
| `COOLING_OFF_DAYS` | 3 | cgv, faq, retours-remboursements |
| `CURRENCY` | 1 | cgv |
| `DATA_RETENTION_YEARS` | 1 | confidentialite |
| `DELIVERY_PARTNER` | 2 | confidentialite, livraison |
| `DIRECTOR_NAME` | 1 | mentions-legales |
| `HOST_ADDRESS` | 1 | mentions-legales |
| `HOST_CONTACT` | 1 | mentions-legales |
| `HOST_NAME` | 2 | confidentialite, mentions-legales |
| `ICE` | 3 | cgv, confidentialite, mentions-legales |
| `IF` | 1 | (false positive — syntaxe `{{IF…}}` ?) |
| `LAST_UPDATED` | 9 | toutes |
| `PAYMENT_PROVIDERS` | 3 | cgv, confidentialite, faq |
| `SITE_URL` | 4 | cgu, cgv, cookies, mentions-legales |
| `SUPPORT_HOURS` | 7 | cgv, confidentialite, faq, livraison, mentions-legales, retours-remboursements, securite-produits |
| `VERSION` | 9 | toutes |

## 4. Cross-référence drift (cause D1)

### 4.1 Vars utilisées dans template MAIS non définies en DB

| Template uses | DB defines | Status |
|---|---|---|
| `CONTACT_EMAIL` | `COMPANY_EMAIL` | ⚠️ **DRIFT** |
| `CONTACT_PHONE` | `COMPANY_PHONE` | ⚠️ **DRIFT** |
| `HOST_ADDRESS` | `HOSTING_ADDRESS` | ⚠️ **DRIFT** |
| `HOST_NAME` | `HOSTING_NAME` | ⚠️ **DRIFT** |
| `HOST_CONTACT` | `HOSTING_PHONE` | ⚠️ **DRIFT** |
| `CNDP_DECLARATION_REF` | `CNDP_DECLARATION` | ⚠️ **DRIFT** |
| `COOLING_OFF_DAYS` | (rien) | ❌ **MANQUANTE** |
| `CURRENCY` | (rien) | ❌ **MANQUANTE** |
| `DATA_RETENTION_YEARS` | (rien) | ❌ **MANQUANTE** |
| `DELIVERY_PARTNER` | (rien) | ❌ **MANQUANTE** |
| `PAYMENT_PROVIDERS` | (rien) | ❌ **MANQUANTE** |
| `SUPPORT_HOURS` | (rien) | ❌ **MANQUANTE** |
| `VERSION` | (rien — devrait être preset) | ❌ **MANQUANTE** |

### 4.2 Vars définies en DB MAIS jamais utilisées

| DB key | Utilisée ? | Action |
|---|---|---|
| `COMPANY_PATENTE` | ❌ | Supprimer ou laisser optional |
| `COMPANY_TVA` | ❌ | Supprimer ou laisser optional |
| `DPO_EMAIL` | ❌ | Supprimer OU câbler dans la page confidentialité |

## 5. Console admin observée (preview)

`/admin/legal` :
- Header : "14 pages · 6 publiées · 8 en brouillon · 0 en revue"
- Colonne "VARS MANQUANTES" pour les drafts :
  - `securite-produits` : "4 : CONTACT_EMAIL, CONTACT_PHONE, SUPPORT_HOURS…"
  - `retours-remboursements` : "8 : COMPANY_NAME, COMPANY_ADDRESS, CONTACT_EMAIL…"
- → **D1 + D2 confirmés visuellement** : la fondatrice voit ces vars en "manquantes" mais l'éditeur `template-vars` ne lui propose pas de les remplir (drift naming + vars non répertoriées).

## 6. Search prénom fondatrice

```bash
grep -ri "souheila|souheïla" src/ docs/
```

9 occurrences trouvées, 0 en DB `legal_pages`. Liste exhaustive dans `01-audit-detail.md` §3.5.

## 7. Tests Playwright créant les orphelins

```bash
grep -rn "e2e-test-" e2e/ src/test/ 2>&1 | head -5
```

À investiguer : probablement une spec qui fait `POST /api/admin/legal` avec slug `e2e-test-${Date.now()}` mais sans hook `afterAll` pour cleanup.

## 8. Hypothèses non testées (à valider lors du fix)

1. **`IF` est-il vraiment utilisé comme variable ?** → Si oui, c'est un bug syntaxique (devrait être directive). Sinon, c'est un faux positif du regex.
2. **`VERSION` est-il censé être un preset comme `LAST_UPDATED`** ? Le code de `vars.ts:14-20` ne définit que 3 presets — `VERSION` devrait probablement être ajouté pour afficher la version de la page automatiquement.
3. **L'éditeur `template-vars` autorise-t-il l'ajout de nouvelles clés** ? Si oui, c'est utilisable comme workaround pour D2. Si non, c'est un blocker.
4. **Les pages CGU/retours/sécurité ont-elles été créées par le seed défaut** ou par un import manuel ? Si seed, le fichier source `docs/legal-pages/60-content` doit aussi être mis à jour pour éviter régression au prochain seed.

## 9. Repro du symptôme

```bash
# 1. Server dev
pnpm dev  # port 3001

# 2. Naviguer
# http://localhost:3001/admin/legal
# Cliquer sur "securite-produits" → "Éditer"

# 3. Tenter publish
# Le bouton "Publier" demande "PUBLIER" en confirmation
# Click → erreur "missing_required_vars: CONTACT_EMAIL, CONTACT_PHONE, SUPPORT_HOURS, ..."

# 4. Aller à /admin/legal/template-vars
# Constater : pas de champ "CONTACT_EMAIL" — il y a "COMPANY_EMAIL" qui est rempli mais pas utilisé
# La fondatrice ne peut PAS résoudre via cette page → blocage
```

## 10. Recommandation immédiate (avant fix)

En attendant le plan complet de `03-recommandations.md` :

- **NE PAS publier** les drafts (CGU, retours, sécurité) tant que le drift n'est pas résolu — sinon les pages publiques afficheront `[CONTACT_EMAIL]` au lieu de la vraie valeur.
- **Garder** les 6 pages publiées telles quelles (elles fonctionnent peut-être en partie grâce au fallback `[KEY]` qui n'est qu'un soft fallback).
- **Vérifier** sur `/legal/mentions-legales` en prod si les vars apparaissent en `[KEY]` (mauvais) ou avec la vraie valeur (drift seulement pour les drafts).
