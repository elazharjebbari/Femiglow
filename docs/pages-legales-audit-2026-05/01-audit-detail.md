# Audit détaillé — pages légales FemiGlow

> **Période d'observation** : 27 mai 2026, env local Node 20 (preview admin sur port 3001), DB Postgres locale (Neon-compatible).
> **Périmètre** : `/admin/legal` + sous-pages (template-vars, placements, redirects, health, edit, new) + `/legal/[slug]` côté public + tables `legal_pages`, `legal_template_vars`.

## 1. Méthodologie

1. **Live preview admin** : login `admin@femiglow.local` → navigation complète `/admin/legal/*`. Snapshot accessibility-tree.
2. **DB inspection** : `psql` direct sur `legal_pages` et `legal_template_vars` pour vérifier le contenu réel et identifier les drifts.
3. **Lecture code (read-only)** : `src/lib/legal/{vars.ts, publish.ts, repository.ts}`, pages admin RSC, route public `/legal/[slug]`.
4. **Cross-référence templates ↔ DB** : extraction regex `{{[A-Z_]+}}` des `body_md` de chaque page, comparaison avec les `key` de `legal_template_vars`.
5. **Search prénom fondatrice** : grep `souheila`/`souheïla` sur tout le code + DB.

## 2. Vue d'ensemble du module

### 2.1 Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   ADMIN /admin/legal                        │
│  - liste pages (status, vars manquantes)                    │
│  - éditeur markdown avec live preview                       │
│  - publish workflow (draft → review → published)            │
│  - template-vars manager (CRUD vars + valeurs)              │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────┐
│              DB tables                                       │
│  legal_pages : id, slug, title, body_md, status, version    │
│  legal_template_vars : key, label, value, is_required, …    │
│  legal_pages_history : snapshots versions publiées          │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────┐
│                  PUBLIC /legal/[slug]                        │
│  - SSR markdown → HTML                                       │
│  - substituteVars({{KEY}} → value) — mode 'public'          │
│  - rehype plugin : highlight missing vars (admin uniquement)│
└────────────────────────────────────────────────────────────┘
```

### 2.2 Pipeline de substitution (vars.ts)

```
md template "{{COMPANY_NAME}}"
     │
     ▼
detectVarsInTemplate(md) → ['COMPANY_NAME']
     │
     ▼
buildVarMap(dbVars, opts) → Map { 'COMPANY_NAME' => 'FemiGlow', 'LAST_UPDATED' => '27 mai 2026', ... }
     │
     ▼
substituteVars(md, map, 'public')
     │  - Si var dans map : remplace
     │  - Si var manquante public : fallback [KEY]
     │  - Si var manquante admin-preview : marker ⦉KEY⦊
     ▼
output HTML
```

### 2.3 Validation publish (publish.ts)

```ts
const missing = detectMissingVars(page.bodyMd, dbVars);
if (missing.length > 0) {
  return { ok: false, code: 'missing_required_vars', missing };
}
```

`detectMissingVars` retourne une var comme manquante si :
- (a) elle est utilisée dans le markdown ET non définie en DB, OU
- (b) elle est utilisée dans le markdown ET `is_required=true` ET valeur vide

→ Ces 2 conditions expliquent les 2 bugs signalés.

## 3. Causes racines, en détail

### 3.1 D1 — Drift naming massif templates ↔ DB

**Mécanique exacte** :

Templates (présents dans `body_md` en DB) utilisent ces noms :
- `{{CONTACT_EMAIL}}` — utilisé dans 9 pages
- `{{CONTACT_PHONE}}` — utilisé dans 7 pages
- `{{HOST_ADDRESS}}` — utilisé dans mentions-legales
- `{{HOST_NAME}}` — utilisé dans 2 pages
- `{{HOST_CONTACT}}` — utilisé dans mentions-legales
- `{{CNDP_DECLARATION_REF}}` — utilisé dans 2 pages

DB `legal_template_vars` définit ces clés :
- `COMPANY_EMAIL` (devrait matcher `CONTACT_EMAIL`)
- `COMPANY_PHONE` (devrait matcher `CONTACT_PHONE`)
- `HOSTING_ADDRESS` (devrait matcher `HOST_ADDRESS`)
- `HOSTING_NAME` (devrait matcher `HOST_NAME`)
- `HOSTING_PHONE` (devrait matcher `HOST_CONTACT`)
- `CNDP_DECLARATION` (devrait matcher `CNDP_DECLARATION_REF`)

**Impact** : `detectMissingVars` retourne `CONTACT_EMAIL` (et tous les autres) comme manquantes car non définies en DB. Côté admin, la fondatrice voit dans `template-vars` les champs `COMPANY_EMAIL/COMPANY_PHONE/HOSTING_*` qu'elle remplit consciencieusement, mais le publish reste bloqué car le markdown référence `CONTACT_*/HOST_*`.

**Origine probable** : refactor partiel entre deux conventions de naming (probablement migration `COMPANY_*` → `CONTACT_*` jamais finie côté DB, ou inverse).

### 3.2 D2 — Variables utilisées sans définition DB

**7 vars utilisées dans templates mais inexistantes en DB** :

| Var | Pages | Solution attendue |
|---|---|---|
| `COOLING_OFF_DAYS` | cgv, faq, retours-remboursements | Constante `7` (loi marocaine) |
| `CURRENCY` | cgv | Constante `MAD` |
| `DATA_RETENTION_YEARS` | confidentialite | Constante `3` ou `5` |
| `DELIVERY_PARTNER` | confidentialite, livraison | Variable à définir |
| `PAYMENT_PROVIDERS` | cgv, confidentialite, faq | Liste : `CMI`, `Inwi Money`… |
| `SUPPORT_HOURS` | 7 pages | `Lun-Ven 9h-18h` |
| `VERSION` | 9 pages | Préset auto (numéro de la page) |

→ Côté UI, la fondatrice voit "VARS MANQUANTES : SUPPORT_HOURS, COOLING_OFF_DAYS…" sans aucun moyen de les définir (template-vars ne les liste pas).

**Note `IF` détectée** : faux match — c'est probablement une syntaxe `{{IF ...}}` (conditionnelle) interprétée à tort comme une var. À vérifier.

### 3.3 D3 — Vars sensibles exposées publiquement

Sur `/legal/mentions-legales` (publié) et `/legal/cgv` (publié), le HTML public expose actuellement (ou exposerait si les vars étaient remplies) :

- **ICE** (Identifiant Commun Entreprise, 15 chiffres)
- **COMPANY_RC** (Registre Commerce)
- **COMPANY_ADDRESS** (adresse siège)
- **COMPANY_FORM** (SARL AU / EI / SA)
- **DIRECTOR_NAME** (personne responsable publication)
- **COMPANY_CAPITAL** (capital social en MAD)
- **HOST_ADDRESS** (adresse hébergeur)

**Demande fondatrice** : *"Pour les recevoir, il suffit de nous envoyer un email"* — donc remplacer ces valeurs par un placeholder type :

> *"Information disponible sur demande à legal@femiglow-maroc.com"*

**Conformité juridique** : la loi marocaine sur les mentions légales (Loi 04-99 + Code de Commerce) exige certaines mentions sur le SITE des sociétés commerçantes. Toutefois :
- Auto-entrepreneur / EI : exigences allégées
- Possibilité de présenter une page "Contact pour mentions complètes" si l'entreprise est petite et fournit l'info sur demande
- → À valider par juriste avant retrait pur

### 3.4 D4 — Pages test E2E orphelines

5 pages avec slug `e2e-test-1778730xxx` (body_md de 43 caractères, status `draft`, créées 14/05/2026). Probablement créées par un test Playwright qui ne nettoie pas après run.

```
e2e-test-1778729926485
e2e-test-1778730063625
e2e-test-1778730444648
e2e-test-1778730581104
e2e-test-1778730754041
```

Impact :
- Pollue la liste admin (5/14 = 36% des entrées sont du bruit)
- Encombre la table `legal_pages`
- Si publiées par erreur, des URLs `/legal/e2e-test-*` deviendraient indexables

### 3.5 D5 — Prénom fondatrice présent dans code

Recherche `souheila|souheïla` (case-insensitive) :

| Fichier | Contexte | Action |
|---|---|---|
| `apps/web/src/app/(marketing)/maison/page.tsx` | Meta description "édité à Rabat par Souheila, biologiste…" | Anonymiser → "édité à Rabat par notre fondatrice" |
| `apps/web/src/app/(marketing)/contact/page.tsx` × 2 | FAQ "Comment suivre une formation avec Souheila ?" | Anonymiser → "formation avec notre équipe" |
| `apps/web/src/app/(marketing)/kit/page.tsx` | Meta "Pensé à Rabat par Souheila" | Anonymiser → "Pensé à Rabat par notre équipe" |
| `apps/web/src/app/(marketing)/rituel/page.tsx` | Description "interview de Souheila à Rabat" | Anonymiser → "interview de la fondatrice" |
| `apps/web/src/app/admin/rituals/best-practices/page.tsx` × 3 | Notes internes admin | Garder OU anonymiser selon préf |
| `apps/web/src/app/api/rituals/policy/route.ts` | Signature "Souheila · FemiGlow" | Anonymiser → "L'équipe FemiGlow" |

**0 occurrence en DB `legal_pages.body_md`** ✅.

## 4. Impact business par dysfonctionnement

| # | Impact direct | Impact business | Risque si non corrigé |
|---|---|---|---|
| D1 (drift) | Impossible de publier les drafts (CGU, retours, sécurité-produits) | 3 pages obligatoires bloquées → non-conformité juridique | Amende ANRT/CNDP, blocage paiement Stripe (T&C absents) |
| D2 (vars non définies) | Vars `SUPPORT_HOURS`, `COOLING_OFF_DAYS`, etc. impossibles à remplir | Pages publiées affichent `[SUPPORT_HOURS]` au lieu de `Lun-Ven 9h-18h` → unprofessional | Perte confiance utilisateur |
| D3 (exposition sensible) | ICE, adresse, RC publiquement visibles | Risque scraping, démarchage, vol identité entreprise | Privacy/conformité GDPR (PII) |
| D4 (orphelins) | Liste admin polluée | Friction UX admin, confusion fondatrice | Risque publish accidentel d'une page test |
| D5 (prénom) | Identification publique non souhaitée | Privacy fondatrice + image marque (envie de présenter "l'équipe") | Difficulté à scaler la marque sans visage personnel |

## 5. Évidence — citations code

| Constat | Fichier:ligne | Citation |
|---|---|---|
| Drift `CONTACT_EMAIL` vs `COMPANY_EMAIL` | DB query | 9 pages utilisent `{{CONTACT_EMAIL}}`, DB définit `COMPANY_EMAIL` |
| Drift `HOST_*` vs `HOSTING_*` | DB query | mentions-legales utilise `{{HOST_NAME}}`, DB définit `HOSTING_NAME` |
| Vars sans définition | DB query | 7 vars utilisées sans entrée `legal_template_vars` |
| Détection missing vars | `src/lib/legal/vars.ts:78-97` | `detectMissingVars(md, dbVars)` |
| Blocage publish | `src/lib/legal/publish.ts:46-49` | `if (missing.length > 0) return { ok: false, code: 'missing_required_vars', missing }` |
| Prénom dans pages marketing | `(marketing)/maison/page.tsx` etc. | 9 occurrences total |

## 6. Conclusion

L'audit identifie **5 dysfonctionnements distincts** dont **2 critiques** (D1 drift, D2 vars manquantes) qui bloquent réellement la publication des pages légales.

Le fix nécessite :
1. **Action data** : réconcilier le naming des vars (template ↔ DB) + ajouter les 7 vars manquantes
2. **Action template** : retirer les vars sensibles ou les remplacer par "contact email"
3. **Action UI** : permettre de définir toutes les vars depuis admin (pas juste celles seedées initialement)
4. **Action cleanup** : supprimer/archiver les 5 pages test E2E orphelines + script test fixt
5. **Action code marketing** : anonymiser le prénom dans 9 fichiers

Cf. [`03-recommandations.md`](./03-recommandations.md) pour le plan complet.
