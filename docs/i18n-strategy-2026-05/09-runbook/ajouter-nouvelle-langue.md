# Ajouter une nouvelle langue après V1

> Procédure complète pour ajouter une **4ème langue** (ex : `es` espagnol, `de` allemand, `it` italien, `he` hébreu, `ja` japonais) à FemiGlow **après le V1** (FR + AR + EN déjà en prod).
>
> **Effort estimé** : **1-2 semaines** par langue (selon complexité : LTR → 1 sem, RTL → 1.5 sem, CJK → 2 sem).
>
> **Audience** : fondatrice (décision business), lead technique (exécution), translateur (traduction).

---

## Sommaire

- [Vue d'ensemble du process](#vue-densemble-du-process)
- [Étape 1 — Décision business](#étape-1--décision-business)
- [Étape 2 — Update config technique](#étape-2--update-config-technique)
- [Étape 3 — Créer messages/{xx}.json](#étape-3--créer-messagesxxjson)
- [Étape 4 — Brief translator + glossaire](#étape-4--brief-translator--glossaire)
- [Étape 5 — Réception traduction + QA](#étape-5--réception-traduction--qa)
- [Étape 6 — Import + staging + tests](#étape-6--import--staging--tests)
- [Étape 7 — Enable flag + canary 10%](#étape-7--enable-flag--canary-10)
- [Étape 8 — Monitor + ramp 50% → 100%](#étape-8--monitor--ramp-50--100)
- [Cas particuliers par script](#cas-particuliers-par-script)
- [Estimation effort détaillée](#estimation-effort-détaillée)
- [Checklist finale](#checklist-finale)
- [Anti-patterns](#anti-patterns)

---

## Vue d'ensemble du process

```
J0      Décision business (founder)
J1      Update DB + config technique (lead, 2h)
J2      Créer messages/xx.json (dev, 2h)
J3-J9   Brief + traduction externe (translator, 5-7j)
J10     Import + QA staging (dev + founder, 1j)
J11     Canary 10% prod (lead, observation 24h)
J12     Canary 50% (observation 48h)
J14     Canary 100% (observation 72h)
J17     Post-mortem + comm équipe
```

**Total** : ~17 jours calendaires (10 jours ouvrés).

**Acteurs** :

| Rôle | Charge |
|---|---|
| Fondatrice | 4h (décision + validation finale) |
| Lead technique | 12h (config + deploy + monitoring) |
| Dev | 8h (messages init + intégration) |
| Translateur | 5-7 jours (selon volume) |
| QA | 4h (tests + canary) |

---

## Étape 1 — Décision business

### Qui prend la décision

**Fondatrice** uniquement, sur la base d'un dossier préparé par lead/marketing.

### Critères de décision

| Critère | Question à se poser | Seuil GO |
|---|---|---|
| **Marché cible** | Combien d'utilisateurs potentiels parlent cette langue dans nos zones cibles ? | ≥ 10 000 prospects qualifiés |
| **Demande utilisateur** | Combien de requêtes support dans cette langue depuis 3 mois ? | ≥ 20 requêtes / mois |
| **Analytics existant** | % d'utilisateurs venant de pays parlant cette langue ? | ≥ 5% du trafic |
| **Concurrence** | Concurrents adressent-ils ce marché ? Comment ? | Différentiation possible |
| **Coût opérationnel** | Avons-nous un translateur fiable + support ? | Translateur identifié |
| **Devise / paiement** | Devise locale supportée ? (V2 multi-devise) | Soit MAD acceptable, soit V2 prêt |
| **Légal** | Pages légales compatibles juridiction ? | Compatibles ou adaptation faisable |

### Document de décision

Créer `docs/i18n-strategy-2026-05/00-context/decisions/add-locale-{xx}-{date}.md` :

```markdown
# Décision ajout locale {xx} — {YYYY-MM-DD}

## Contexte business

- **Marché** : {pays / zone}
- **Population cible** : {N}
- **Trafic actuel** : {Y%} (source GA4)
- **Demandes support** : {Z}/mois en cette langue

## Analyse

### Pour
- {raison 1}
- {raison 2}

### Contre
- {raison 1}
- {raison 2}

## Décision

GO — démarrage prévu : {date}
NO-GO — raison : {...}

## Plan

- Translateur identifié : @{nom}
- Budget : {N} EUR
- Délai cible : {date} pour prod 100%

## Validation

- [x] Fondatrice — {date}
- [x] Lead technique — {date}
```

### Anti-patterns

- ⚠️ **Décider d'ajouter une langue "parce que c'est mignon"** sans demande prouvée → 1-2 semaines d'effort gaspillé
- ⚠️ **Pas de translateur identifié avant GO** → on bloque dès J3
- ⚠️ **Sous-estimer le coût maintenance** : chaque langue ajoute ~30% à l'effort de chaque future modif (toutes les nouvelles strings doivent être traduites)

---

## Étape 2 — Update config technique

**Durée** : 2h. **Owner** : lead technique.

### Branche

```bash
git checkout master
git pull origin master
git checkout -b feat/i18n-add-{xx}
# ex: feat/i18n-add-es
```

### 2.1 — Update `apps/web/src/i18n/config.ts`

```typescript
// AVANT
export const locales = ['fr', 'ar', 'en'] as const;

// APRÈS
export const locales = ['fr', 'ar', 'en', 'es'] as const;
```

⚠️ Le placement dans le tableau est important pour l'ordre d'affichage du LocaleSwitcher. Convention : `fr` (default) en premier, puis par ordre alphabétique.

### 2.2 — Update `i18n_locales` table (si DB-driven)

Si le projet utilise une table DB pour les locales (cf. `06-data-strategy/translation-tables.sql`) :

```bash
cd apps/web
pnpm db:generate
# Drizzle propose une migration ; vérifier qu'elle ne contient QUE un INSERT
```

Migration SQL attendue :

```sql
-- apps/web/drizzle/migrations/00XX-add-locale-es.sql

INSERT INTO i18n_locales (code, name_native, name_en, direction, is_active, sort_order)
VALUES ('es', 'Español', 'Spanish', 'ltr', false, 10);
-- is_active = false : sera activé via flag I18N_LOCALES_ACTIVE plus tard
```

Pour locale RTL (ex: `he` hébreu) :

```sql
INSERT INTO i18n_locales (code, name_native, name_en, direction, is_active, sort_order)
VALUES ('he', 'עברית', 'Hebrew', 'rtl', false, 20);
```

Appliquer :

```bash
pnpm db:migrate
# Vérifier
psql $DATABASE_URL -c "SELECT * FROM i18n_locales;"
```

### 2.3 — Update font config (si CJK ou RTL exotique)

Pour locales nécessitant des fonts spécifiques :

| Locale | Font recommandée | Provider |
|---|---|---|
| `es`, `de`, `it`, `fr-FR` | Inter (déjà chargée) | Google Fonts |
| `ar`, `he` | Cairo (déjà chargée pour AR), Noto Sans Hebrew pour HE | Google Fonts |
| `ja` | Noto Sans JP | Google Fonts |
| `zh-Hans`, `zh-Hant` | Noto Sans SC / TC | Google Fonts |
| `ko` | Noto Sans KR | Google Fonts |
| `ru` | Inter (subset cyrillic) | Google Fonts |

Pour ajouter une nouvelle font :

```typescript
// apps/web/src/app/[locale]/layout.tsx
import { Noto_Sans_JP } from 'next/font/google';

const notoJP = Noto_Sans_JP({ subsets: ['latin'], variable: '--font-jp' });

const fontVariableByLocale = {
  fr: inter.variable,
  ar: cairo.variable,
  en: inter.variable,
  es: inter.variable,
  ja: notoJP.variable,
};
```

### 2.4 — Update Tailwind config

```typescript
// apps/web/tailwind.config.ts
fontFamily: {
  // ... existant
  jp: ['var(--font-jp)', 'sans-serif'],
  hebrew: ['var(--font-hebrew)', 'sans-serif'],
}
```

### 2.5 — Update next-intl routing

```typescript
// apps/web/src/i18n/routing.ts
export const routing = defineRouting({
  locales: ['fr', 'ar', 'en', 'es'],  // ajouter ici
  defaultLocale: 'fr',
  localePrefix: 'always',
});
```

### 2.6 — Update sitemap multilingue

```typescript
// apps/web/src/app/sitemap.ts
const locales = ['fr', 'ar', 'en', 'es'];  // ajouter

// Génération auto des URLs hreflang
```

### 2.7 — Update tests fixture

Voir tous les tests qui ont une matrice locale :

```bash
rg -t ts -t tsx "['fr', 'ar', 'en']" apps/web/src apps/web/e2e
# Pour chaque match, vérifier si la nouvelle locale doit être ajoutée
```

### Commit étape 2

```bash
git add apps/web/src/i18n/ apps/web/drizzle/migrations/ apps/web/src/app/sitemap.ts
git commit -m "I18N-{xx}-2-config-technique"
```

---

## Étape 3 — Créer messages/{xx}.json

**Durée** : 2h. **Owner** : dev.

### 3.1 — Copier le fichier FR

```bash
cd apps/web/messages
cp fr.json es.json
# Maintenant es.json contient le FR — sera traduit étape 5
```

### 3.2 — Vérifier l'intégrité structurelle

```bash
# Vérifier que les clés sont identiques
pnpm -F web exec tsx scripts/i18n/diff-keys.ts \
  --source messages/fr.json \
  --target messages/es.json
# Attendu : 0 différence (puisqu'on a copié)
```

### 3.3 — Marquer toutes les strings comme "à traduire"

Option A — Préfixe explicite (recommandé pour visualisation) :

```bash
pnpm -F web exec tsx scripts/i18n/mark-untranslated.ts \
  --file messages/es.json \
  --prefix "[TODO-ES] "
```

Résultat :

```json
{
  "contact": {
    "title": "[TODO-ES] Contactez-nous",
    "subtitle": "[TODO-ES] Nous répondons sous 24h"
  }
}
```

Avantage : si déployé par erreur, on voit immédiatement les manques.

### 3.4 — Mettre à jour le type IntlMessages

Pas de changement nécessaire si la structure est identique. Vérifier :

```bash
pnpm -F web typecheck
# Attendu : 0 erreur
```

### Commit étape 3

```bash
git add apps/web/messages/es.json
git commit -m "I18N-{xx}-3-messages-init-untranslated"
```

---

## Étape 4 — Brief translator + glossaire

**Durée** : 1h dev + 5-7 jours translateur (asynchrone).

### 4.1 — Préparer le CSV d'export

```bash
cd apps/web

pnpm -F web i18n:export \
  --source fr \
  --target es \
  --format csv \
  -o /tmp/femiglow-i18n-fr-to-es-$(date +%Y%m%d).csv
```

Format CSV attendu :

```csv
key,namespace,source_value_fr,current_value_es,priority,context,notes_for_translator
contact.title,contact,Contactez-nous,,P0,page /contact,Titre principal H1
contact.subtitle,contact,Nous répondons sous 24h,,P0,page /contact,Sous-titre rassurant
...
```

### 4.2 — Préparer le glossaire {xx}

Créer `docs/i18n-strategy-2026-05/06-data-strategy/glossaire-fr-es.csv` (ou équivalent par langue) :

```csv
fr,es,context,do_not_translate
FemiGlow,FemiGlow,Marque,oui
rituel,ritual,Concept produit,non
Maison,Maison,Nom de page (garder en FR),oui
Kit,Kit,Nom de produit (international),oui
peau,piel,Corpus médical,non
hyperpigmentation,hiperpigmentación,Corpus médical,non
ongle,uña,Corpus produit,non
sobre,sereno,Tonalité de marque,non
posé,calmado,Tonalité de marque,non
```

### 4.3 — Email de brief au translateur

Template :

```
À: {translator-email}
Objet: [FemiGlow] Mission traduction {xx} — Brief + fichiers

Bonjour {nom},

Merci d'avoir accepté cette mission de traduction FR → {Langue} pour FemiGlow.

== Contexte
FemiGlow est une marque marocaine de soins ongles. Notre site est actuellement en FR + AR + EN, nous ajoutons {Langue} pour le marché {pays}.

Ton de marque : sobre, posé, premium, méditerranéen. Pas d'urgence factice ni de hype. Cf. ton-style-guide attaché.

== Fichiers fournis
1. CSV à traduire : femiglow-i18n-fr-to-{xx}-{date}.csv ({N} lignes)
2. Glossaire FR-{xx} : glossaire-fr-{xx}.csv (termes à respecter)
3. Tone style guide : tone-style-guide.md
4. Runbook translateur : workflow-translateur.md (à lire en premier)

== Comment travailler
1. Lis le runbook translateur en premier (30 min)
2. Ouvre le CSV dans Google Sheets (ne pas modifier le format)
3. Pour chaque ligne, rempli la colonne `current_value_{xx}` en respectant :
   - Le glossaire (termes-marque, registre)
   - Les notes contextuelles
   - Le ton FemiGlow
4. Self-QA : relis avant retour (cf. checklist dans le runbook)
5. Renvoie le CSV complété : femiglow-i18n-fr-to-{xx}-{date}-COMPLETED.csv

== Délai
{N} jours ouvrés à partir de la réception. Retour attendu le {date}.

== Questions
Si doute sur un terme, marque-le `[?]` dans la cellule + commentaire Google Sheets, je réponds sous 24h.

Merci, on commence !
{Founder name}
```

### 4.4 — Tracking dans Notion / spreadsheet

Maintenir un tableau de suivi traduction :

| Locale | Translator | Date envoi | Délai | Date retour | Statut |
|---|---|---|---|---|---|
| es | @maria | 2026-06-15 | 7j | 2026-06-22 | En cours |

---

## Étape 5 — Réception traduction + QA

**Durée** : 1 jour. **Owner** : dev + fondatrice.

### 5.1 — Vérifier intégrité du CSV reçu

```bash
pnpm -F web exec tsx scripts/i18n/validate.ts \
  --file /tmp/femiglow-i18n-fr-to-es-{date}-COMPLETED.csv \
  --target es
```

Sortie attendue :

```
✓ 700 lines parsed
✓ 700 keys match source FR
✓ 700 target_value filled (0 empty)
✓ 0 mojibake detected
✓ 0 ICU format error
✓ 0 placeholder mismatch ({name}, etc.)
```

Si erreurs : retour translateur pour corrections.

### 5.2 — Spot-check qualitatif

Founder ou native speaker prend 50 strings random dans le CSV et relit :

- Ton correct (sobre, pas hype) ?
- Glossaire respecté ?
- Pas de mistranslation ?

```bash
pnpm -F web exec tsx scripts/i18n/sample.ts \
  --file /tmp/femiglow-i18n-fr-to-es-{date}-COMPLETED.csv \
  --sample 50 \
  -o /tmp/sample-50.csv
# Founder review en 30 min
```

### 5.3 — Si OK, importer

```bash
pnpm -F web i18n:import \
  --file /tmp/femiglow-i18n-fr-to-es-{date}-COMPLETED.csv \
  --target es

# Vérifier le diff
git diff apps/web/messages/es.json | head -50
```

### 5.4 — Si KO, demander révisions

Retour translateur avec liste des points à revoir :

```
Bonjour,

Merci pour le retour ! Quelques points à revoir avant intégration :

Ligne 23 (kit.cta) : "Empieza tu ritual" — préfère "Comienza tu ritual" (plus formel)
Ligne 145 (rituel.step1) : terme "limpieza" trop dur, peut-on essayer "preparación" ?
Ligne 230 (faq.delivery) : reformulation pour conserver la cadence ternaire FR

Reste OK ! Délai retour : {date}
```

---

## Étape 6 — Import + staging + tests

**Durée** : 4h. **Owner** : dev + QA.

### 6.1 — Lancer en local

```bash
# Mettre temporairement la locale dans I18N_LOCALES_ACTIVE local
echo "I18N_LOCALES_ACTIVE=fr,ar,en,es" >> apps/web/.env.local

pnpm -F web dev
# Ouvrir http://localhost:3000/es/
```

Tester manuellement :

- [ ] `/es/` rend en espagnol
- [ ] `/es/contact` rend
- [ ] `/es/kit` rend
- [ ] `/es/rituel` rend
- [ ] LocaleSwitcher montre `Español`
- [ ] Switch FR → ES → AR fonctionne
- [ ] Wizard checkout en ES OK (utilise fallback FR si pas dans WizardDictionary)
- [ ] Pas de `[TODO-ES]` visible

### 6.2 — Run tests

```bash
pnpm -F web typecheck
pnpm -F web test:unit
pnpm -F web test:e2e -- --grep="@es"
# Note : ajouter des specs locale ES si pas encore présents
```

### 6.3 — Visual regression

```bash
pnpm -F web exec playwright test e2e/visual/i18n/ --update-snapshots
# Vérifier les 6 routes en ES
git add apps/web/e2e/visual/i18n/__snapshots__/*-es-*.png
```

### 6.4 — A11y

```bash
pnpm -F web exec playwright test e2e/a11y/ --grep="es"
# Attendu : 0 violation critique
```

### 6.5 — Push staging

```bash
git push origin feat/i18n-add-{xx}

# Vercel auto-deploy preview
# Récupérer l'URL de preview
gh pr create --title "I18N — Add locale {xx}" --base master
```

### 6.6 — QA staging

Founder + QA testent sur l'URL preview :

- [ ] Toutes les pages rendent en ES
- [ ] Cookie persiste après refresh
- [ ] hreflang dans `<head>` correct
- [ ] Sitemap inclut les URLs ES
- [ ] Pas de console error
- [ ] Performance LCP < 2.5s sur ES (Lighthouse)

---

## Étape 7 — Enable flag + canary 10%

**Durée** : 2h. **Owner** : lead technique.

### 7.1 — Merger la PR

Une fois review approuvée et QA OK :

```bash
gh pr merge --squash
```

### 7.2 — Update Vercel env var

```bash
# Récupérer la valeur actuelle
vercel env ls production | grep I18N_LOCALES_ACTIVE
# Attendu : fr,ar,en

# Mettre à jour : ajouter es
vercel env rm I18N_LOCALES_ACTIVE production
vercel env add I18N_LOCALES_ACTIVE production
# Entrer : fr,ar,en,es

# Redeploy
vercel --prod
```

### 7.3 — Vérifier prod

```bash
# Tester l'URL prod
curl -I https://femiglow.ma/es/contact
# Attendu : 200 OK (pas 404)

# Vérifier hreflang
curl -s https://femiglow.ma/es/contact | grep hreflang
# Attendu : lien vers /fr, /ar, /en, /es

# Vérifier <html lang>
curl -s https://femiglow.ma/es/contact | grep '<html'
# Attendu : <html lang="es" dir="ltr">
```

### 7.4 — Canary 10% (24h observation)

Pour FemiGlow V1, le canary se fait via :
- Soit Vercel Edge Config (rollout %)
- Soit ne pas annoncer publiquement la locale et laisser uniquement les utilisateurs avec navigateur `Accept-Language: es` la découvrir naturellement

```bash
# Si Edge Config disponible :
vercel edge-config update --key="I18N_ES_ROLLOUT" --value=10
```

Pendant 24h, monitorer :

- [ ] Sentry : 0 erreur critique sur `/es/*`
- [ ] Vercel Analytics : taux conversion `/es/*` similaire à FR (±10%)
- [ ] Analytics : nb de sessions `/es/*` (cible : > 50 sessions / 24h)

---

## Étape 8 — Monitor + ramp 50% → 100%

**Durée** : 5 jours observation. **Owner** : lead + founder.

### 8.1 — Ramp à 50% après 24h sans incident

```bash
vercel edge-config update --key="I18N_ES_ROLLOUT" --value=50
```

Pendant 48h, monitorer mêmes KPIs.

### 8.2 — Ramp à 100% après 48h OK

```bash
vercel edge-config update --key="I18N_ES_ROLLOUT" --value=100
# Ou simplement retirer le rollout flag — la locale est ouverte à tous
```

Pendant 72h, surveillance accrue.

### 8.3 — Communication

Slack post équipe :

```
[I18N] Locale ES en prod 100%

Date : {YYYY-MM-DD}
Canary timeline : 24h@10% → 48h@50% → 72h@100% → live
Incidents : 0 critique
KPIs :
- Sessions ES sur 7j : {N}
- Conversion ES : {X}% (vs FR {Y}%)
- Erreurs Sentry : 0 critique, {M} mineures (typos)

Locales actives : fr, ar, en, es (4 locales)
Prochaine étape : monitoring 30 jours
```

Annonce publique optionnelle (LinkedIn / Instagram FemiGlow) :

```
Nuestro nuevo sitio web está disponible en Español. Descúbrelo en femiglow.ma/es 🇪🇸
```

### 8.4 — Post-mortem ajout langue

Créer `docs/i18n-strategy-2026-05/00-context/post-mortem-add-{xx}-{date}.md` :

```markdown
# Post-mortem ajout locale {xx}

## Résumé

- Date GO : {date}
- Date 100% prod : {date}
- Durée totale : {N} jours

## Ce qui a bien marché

- ...

## Ce qui a foiré

- ...

## Leçons pour la prochaine langue

- ...
```

---

## Cas particuliers par script

### Locale RTL (he, fa, ur)

**Effort supplémentaire** : +0.5 semaine pour vérifier que tous les composants RTL marchent encore.

Étapes additionnelles :

1. **Update direction dans i18n_locales** :
   ```sql
   INSERT INTO i18n_locales (code, ..., direction) VALUES ('he', ..., 'rtl');
   ```

2. **Tester chaque composant en RTL** :
   - LocaleSwitcher : ouverture dropdown correcte (right vs left)
   - WizardDictionary : déjà RTL-ready pour AR, vérifier HE
   - Carousel images : flip direction
   - Form inputs : alignement texte
   - Icônes directionnelles : flip pertinents

3. **Visual regression dédiée RTL** :
   ```bash
   pnpm -F web exec playwright test e2e/visual/rtl/ --update-snapshots
   ```

4. **Font dédiée** : Cairo OK pour HE en fallback, mais idéalement Noto Sans Hebrew.

5. **Glossaire spécifique** : termes RTL ne se traduisent pas pareil entre AR et HE.

### Locale cyrillique (ru, uk, bg, sr)

**Effort supplémentaire** : minimal (déjà LTR, juste subset font).

Étapes :

1. **Subset font cyrillic** :
   ```typescript
   const inter = Inter({ subsets: ['latin', 'cyrillic'] });
   ```

2. **Vérifier les caractères spéciaux** dans les form inputs (validation regex).

3. **SEO** : `lang="ru"` et `hreflang="ru-RU"` ou `ru`.

### Locale CJK (ja, zh-Hans, zh-Hant, ko)

**Effort supplémentaire** : +1 semaine (font + line-height + tests).

Considérations :

1. **Font** : Noto Sans CJK (sous-set par langue, JS 9MB sans subset, à optimiser).

2. **Line-height** : les caractères CJK demandent un line-height plus généreux :
   ```css
   :lang(ja) p, :lang(ja) h1 { line-height: 1.7; }
   ```

3. **Word break** : pas d'espaces entre mots en JA/ZH → `word-break: break-word; overflow-wrap: anywhere;` sur les containers étroits.

4. **Tone** : registre formel/informal très important en JA (keigo). Spécifier dans le glossaire.

5. **Date format** : JA utilise année-mois-jour (`2026年5月27日`), pas dd/mm/yyyy.

6. **Tests E2E** : les selectors par texte ne marchent plus pareil — préférer `data-testid`.

### Locale dialectales (ar-MA Darija vs ar standard, zh-Hans vs zh-Hant)

**Approche** : 2 locales distinctes même langue.

Exemple Darija :

```typescript
// apps/web/src/i18n/config.ts
export const locales = ['fr', 'ar', 'ar-MA', 'en'] as const;
// ar = MSA (standard), ar-MA = Darija (Maroc)
```

Glossaire séparé pour chaque variant.

⚠️ Effort : multiplie le travail de traduction par le nombre de variants.

---

## Estimation effort détaillée

### Locale LTR standard (es, de, it, pt)

| Étape | Charge dev | Charge translator | Charge founder |
|---|---|---|---|
| Décision business | — | — | 2h |
| Config technique | 2h | — | — |
| Init messages | 2h | — | — |
| Brief + glossaire | 1h | — | 1h |
| Traduction (700 strings) | — | 5j | — |
| QA reception | 1h | — | 1h |
| Tests + staging | 3h | — | — |
| Deploy canary | 2h | — | — |
| Monitoring 5j | 2h | — | — |
| Post-mortem | 1h | — | 30min |
| **Total** | **~14h** | **5j** | **~5h** |

**Calendrier** : 1 semaine.

### Locale RTL (he, fa, ur)

Ajouter :
- +4h dev (audit RTL spécifique)
- +1j translator (verification RTL termes)

**Total** : ~18h dev, 6j translator. **Calendrier** : 1.5 semaine.

### Locale CJK (ja, zh, ko)

Ajouter :
- +8h dev (font subset, line-height, tests dédiés)
- +2j translator (registre keigo, idiomatic)

**Total** : ~22h dev, 7j translator. **Calendrier** : 2 semaines.

### Locale cyrillique (ru, uk, bg)

Ajouter :
- +2h dev (font subset)

**Total** : ~16h dev, 5j translator. **Calendrier** : 1 semaine.

---

## Checklist finale

Avant de déclarer la locale "live" :

### Pré-deploy

- [ ] Décision business documentée
- [ ] Translateur identifié + briefé
- [ ] CSV exporté + envoyé
- [ ] Traduction reçue + validée
- [ ] Glossaire mis à jour
- [ ] messages/{xx}.json importé
- [ ] Config technique à jour (config.ts, i18n_locales, sitemap)
- [ ] Font configurée (si nécessaire)
- [ ] Tests E2E ajoutés
- [ ] Visual regression baselines créées
- [ ] PR mergée

### Deploy

- [ ] Vercel env var `I18N_LOCALES_ACTIVE` mis à jour
- [ ] Deploy prod fait
- [ ] hreflang vérifié curl
- [ ] `<html lang>` vérifié curl
- [ ] Sitemap mis à jour

### Canary

- [ ] 10% rollout — observation 24h OK
- [ ] 50% rollout — observation 48h OK
- [ ] 100% rollout — observation 72h OK
- [ ] 0 incident critique
- [ ] Conversion stable

### Post-deploy

- [ ] Comm équipe Slack
- [ ] Comm publique (si applicable)
- [ ] Post-mortem rédigé
- [ ] Monitoring 30j planifié
- [ ] Backlog typos / améliorations ouvert

---

## Anti-patterns

### Anti-pattern 1 — Ajouter une locale sans translateur dédié

**Symptôme** : on fait DeepL brut, on déploie, on attend les retours.

**Conséquence** : qualité translation faible, image marque dégradée, support flooded.

**Bonne pratique** : toujours avoir un humain natif en review au moins sur P0 (CTAs, titres, FAQ, légal).

### Anti-pattern 2 — Big bang deploy

**Symptôme** : tout activé d'un coup, pas de canary, pas de monitoring.

**Conséquence** : si bug, blast radius = 100% des nouveaux users.

**Bonne pratique** : canary 10% → 50% → 100% systématique, comme pour tout deploy V1.

### Anti-pattern 3 — Skip QA visuelle

**Symptôme** : on teste juste que les pages chargent, pas que ça a l'air pro.

**Conséquence** : overflow texte (mots espagnols + longs qu'en FR), boutons cassés, layouts choquants.

**Bonne pratique** : visual regression sur 6 routes principales × 2 viewports (desktop + mobile).

### Anti-pattern 4 — Oublier les pages légales

**Symptôme** : on traduit le marketing mais `/legal/cgv` reste en FR.

**Conséquence** : non-conformité légale dans le pays cible, RGPD penalty.

**Bonne pratique** : vérifier que **toutes** les pages publiques sont traduites, légales incluses.

### Anti-pattern 5 — Ne pas mettre à jour le glossaire

**Symptôme** : translateur ajouté n'a pas le glossaire des langues précédentes.

**Conséquence** : termes-marque variants (FemiGlow → "FemiBrillance"…), tonalité divergente.

**Bonne pratique** : maintenir un glossaire central par langue, partagé à tout translateur.

### Anti-pattern 6 — Confondre langue et locale

**Symptôme** : on active `en` sans préciser `en-US`, `en-GB`, ou `en-MA`.

**Conséquence** : format date/devise incohérent, tonalité ambiguë.

**Bonne pratique** : utiliser BCP-47 complet (`en-MA` pour anglais Maroc, `en-US` pour USA). Voir `00-context/marches-cibles.csv`.

### Anti-pattern 7 — Ne pas tester le wizard checkout

**Symptôme** : on déploie sans vérifier que le tunnel checkout marche en nouvelle locale.

**Conséquence** : conversion en chute libre dans la nouvelle locale.

**Bonne pratique** : wizard CHA-231 utilise `WizardDictionary` séparé. Si la nouvelle locale n'a pas de dictionary wizard, le fallback est FR (pas idéal mais ça marche). Soit ajouter le dictionary wizard, soit accepter ce fallback.

---

## Liens utiles

- [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) — Exécution générale i18n
- [`workflow-translateur.md`](./workflow-translateur.md) — Workflow translateur détaillé
- [`deploiement.md`](./deploiement.md) — Canary detail
- [`troubleshooting.md`](./troubleshooting.md) — Erreurs fréquentes
- [`../00-context/marches-cibles.csv`](../00-context/marches-cibles.csv) — Tableau langues prioritaires
- [`../06-data-strategy/workflow-translation.md`](../06-data-strategy/workflow-translation.md) — Workflow technique
- [`../05-ui-ux-design/tone-style-guide.md`](../05-ui-ux-design/tone-style-guide.md) — Ton FemiGlow

---

**Auteur** : Claude — 27 mai 2026
**Version** : 1.0
**À mettre à jour** : après chaque nouvelle locale ajoutée, avec retours terrain.
