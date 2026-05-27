# Workflow de traduction — du founder au traducteur

> Comment FemiGlow opère la traduction du contenu FR vers AR et EN avec un **traducteur externe**, sans TMS en V1. Process structuré en 5 phases, SLA, glossaire, instructions par locale, format de communication.

## 1. Vue d'ensemble du workflow

```
┌──────────────┐    Export CSV    ┌────────────────┐    Traduction     ┌──────────────┐
│ /admin/i18n  │ ────────────────▶│  Google Sheets │ ────────────────▶│ Translation  │
│   (founder)  │                  │   (traducteur) │                  │   complete   │
└──────────────┘                  └────────────────┘                  └──────┬───────┘
       ▲                                                                     │
       │                                                                     │
       │            Import CSV (review)                                      │
       │ ◀─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐    QA staging    ┌────────────────┐    Publish       ┌──────────────┐
│  Draft state │ ────────────────▶│  staging.fmg   │ ────────────────▶│ Production   │
└──────────────┘                  └────────────────┘                  └──────────────┘
```

Le workflow se déroule en **5 phases** :

| # | Phase | Acteur principal | Output |
|---|---|---|---|
| 1 | Export du contenu FR à traduire | Founder | CSV téléchargé |
| 2 | Traduction par le traducteur externe | Traducteur | CSV rempli |
| 3 | Import du CSV traduit dans l'admin | Founder | Drafts en DB / JSON |
| 4 | QA visuel sur staging | Founder + QA | Validation OK |
| 5 | Publish + monitoring | Founder | Production live |

Durée typique pour un cycle complet sur une vague de traduction (~200 clés) :

| Phase | Durée |
|---|---|
| Export | < 5 min |
| Traduction (par locale) | 3-5 jours ouvrés |
| Import | < 10 min |
| QA staging | 1 jour |
| Publish | < 5 min |
| **Total cycle** | **5-7 jours** |

## 2. Phase 1 — Export du contenu FR

### 2.1 Endpoint admin

`GET /api/admin/i18n/export` — protégée par auth admin (cf. `03-backend/api-routes.md`).

**Paramètres** :

| Param | Valeurs | Description |
|---|---|---|
| `scope` | `ui` | `cms` | `legal` | `email` | `all` | Quel contenu exporter |
| `source_locale` | `fr` (défaut) | Locale source |
| `target_locale` | `ar`, `en`, ... | Locale cible (vide pour template multi) |
| `priority` | `P0`, `P1`, `P2`, `all` | Filtre priorité |
| `status` | `pending`, `approved`, `translated` | Filtre statut |
| `format` | `csv` (défaut), `xlsx`, `json` | Format de sortie |

**Exemple call** :

```bash
curl -X GET 'https://femiglow.ma/api/admin/i18n/export?scope=ui&target_locale=ar&priority=P0&format=csv' \
  -H 'Authorization: Bearer <admin-token>' \
  -o femiglow-i18n-fr-to-ar-P0-2026-05-27.csv
```

### 2.2 Format CSV de l'export

```csv
key,namespace,source_value_fr,current_value_ar,priority,context,notes_for_translator,extraction_status
common.back,common,Retour,,P0,components/ui/back-button.tsx,Texte court d'action. Ton: neutre.,pending
common.continue,common,Continuer,,P0,components/ui/button.tsx,Bouton primaire CTA. Doit rester court.,pending
marketing.hero.title,marketing,"Le rituel ongles, en cinq minutes.",,P0,app/(marketing)/page.tsx,Titre H1 page d'accueil. Ton: posé, ancré. Garder le rythme.,pending
marketing.hero.subtitle,marketing,"Trois gestes, une saison.",,P0,app/(marketing)/page.tsx,Sous-titre. Métaphore botanique. Conserver la cadence ternaire.,pending
```

**Colonnes** :

| Colonne | Source | Rôle |
|---|---|---|
| `key` | i18n_translation_keys.key OU JSON path | Identifiant immuable |
| `namespace` | premier segment de la clé | Groupement |
| `source_value_fr` | messages/fr.json OU i18n_translation_values FR | Texte source |
| `current_value_ar` | (vide si pas encore traduit) | Champ à remplir par traducteur |
| `priority` | i18n_translation_keys.priority | P0/P1/P2 |
| `context` | i18n_translation_keys.context | Où la string apparaît |
| `notes_for_translator` | i18n_translation_keys.description | Hint pour le traducteur |
| `extraction_status` | i18n_translation_keys.extraction_status | pending / approved / translated |

### 2.3 Naming des exports

Convention : `femiglow-i18n-<scope>-<source>-to-<target>-<priority>-<YYYY-MM-DD>.csv`

Exemples :
- `femiglow-i18n-ui-fr-to-ar-P0-2026-05-27.csv`
- `femiglow-i18n-cms-fr-to-en-all-2026-06-03.csv`
- `femiglow-i18n-legal-fr-to-ar-P0-2026-06-10.csv`

### 2.4 Audit trail

Chaque export crée une entrée dans `audit_entries` :

```ts
{
  actor: 'founder@femiglow.local',
  action: 'i18n.export',
  target: 'ui:fr->ar:P0',
  metadata: {
    scope: 'ui',
    sourceLocale: 'fr',
    targetLocale: 'ar',
    priority: 'P0',
    keysCount: 142,
    fileHash: 'sha256:abc123...',
  },
  createdAt: ISO,
}
```

→ permet de tracker ce qui a été envoyé à qui et quand.

## 3. Phase 2 — Traduction par le traducteur externe

### 3.1 Onboarding du traducteur (one-shot)

Avant le premier cycle, le founder envoie au traducteur :

1. **Présentation FemiGlow** (1 page) : marque, valeurs, audience, voix.
2. **Glossaire** (cf. § 8) : terminologie spécifique à conserver intacte.
3. **Style guide par locale** (cf. § 9) : ton, formalité, longueur.
4. **Exemples de bonnes traductions** : 5-10 paires FR→AR et FR→EN modèles.
5. **Document workflow** : ce fichier ou un résumé.

Format de l'onboarding : 1 dossier Google Drive partagé en read.

### 3.2 Outils de traduction

| Outil | Usage | Notes |
|---|---|---|
| **Google Sheets** | Édition principale CSV | Free, collaboratif, formules, validation |
| **DeepL / OpenAI** | Aide à la première passe | Le traducteur peut s'aider, MAIS doit relire et adapter |
| **Linguee / Reverso** | Vérification idiomes | Pour expressions FemiGlow spécifiques |
| **Excel** | Alternative si pas Google | Compatible CSV également |

### 3.3 Process du traducteur

1. Reçoit le CSV depuis founder (via email ou Google Drive lien).
2. Ouvre dans Google Sheets (import CSV).
3. Pour chaque ligne :
   - Lit `source_value_fr`
   - Lit `notes_for_translator` (contexte, ton)
   - Lit `context` (fichier, hint sur où ça apparaît)
   - Vérifie `priority` (P0 = critique, priorité)
   - Saisit la traduction dans `current_value_<target>`
   - Marque `extraction_status = 'translated'`
4. Si doute :
   - Ajoute un commentaire Google Sheets sur la ligne
   - Bloc Slack `#i18n-translation` ou email récap
   - Founder répond sous 24h
5. Quand terminé :
   - Export CSV depuis Google Sheets (UTF-8 BOM)
   - Renomme avec convention : `femiglow-i18n-ui-fr-to-ar-P0-<date>-RETOUR.csv`
   - Envoi par email ou dépose dans Google Drive

### 3.4 Validation côté traducteur (auto-check)

Le traducteur doit auto-checker avant envoi :

- [ ] Toutes les lignes ont `current_value_<target>` rempli
- [ ] Les placeholders ICU `{count}`, `{name}`, `{price, number, ::currency/MAD}` sont préservés à l'identique (pas traduits)
- [ ] Les tags rich text `<bold>`, `<italic>` sont préservés
- [ ] Les emojis sont conservés (pas remplacés par leur description)
- [ ] La ponctuation suit les règles de la langue cible (ex: AR utilise `،` au lieu de `,`)
- [ ] Le glossaire FemiGlow est respecté (cf. § 8)

### 3.5 SLA traducteur

| Volume | SLA |
|---|---|
| < 50 clés | 24h |
| 50-200 clés | 3 jours ouvrés |
| 200-500 clés | 5 jours ouvrés |
| > 500 clés | À négocier (typiquement 7-10 j) |

Si dépassement : alerte automatique founder via cron `pnpm i18n:alert-stale-exports` (J+SLA).

## 4. Phase 3 — Import du CSV traduit

### 4.1 Endpoint admin

`POST /api/admin/i18n/import` — protégée admin.

**Body** : multipart form-data avec le fichier CSV.

**Validation côté serveur** :

1. Header CSV correct (`key, namespace, source_value_fr, current_value_<locale>, ...`)
2. Toutes les `key` existent en DB (ou dans `messages/fr.json`)
3. `current_value_<locale>` non vide pour les lignes attendues
4. ICU placeholders preserved (regex check)
5. Rich text tags preserved
6. UTF-8 encoding valide

**Response** :

```json
{
  "import_id": "imp_xyz789",
  "totalRows": 142,
  "successCount": 140,
  "warningCount": 2,
  "errorCount": 0,
  "warnings": [
    {
      "row": 87,
      "key": "marketing.kit.price_label",
      "issue": "ICU placeholder mismatch: expected {price, number, ::currency/MAD}, got {price}"
    },
    {
      "row": 102,
      "key": "marketing.maison.intro",
      "issue": "Source value changed since export — translator working on stale version"
    }
  ],
  "errors": []
}
```

### 4.2 Workflow d'import dans l'admin UI

```tsx
// apps/web/src/app/admin/i18n/import/page.tsx
1. Page upload CSV — drag & drop
2. Aperçu diff : pour chaque ligne, montre :
   - source_value (FR)
   - current_value (existing AR)
   - imported_value (new AR)
3. Sélection des lignes à importer (par défaut toutes)
4. Bouton "Importer comme drafts"
5. Confirmation modale : "X lignes seront créées en draft. Continuer ?"
6. Import → DB update → revalidate caches → success page
```

### 4.3 Status après import

Toutes les valeurs importées sont en **`status = 'draft'`** par défaut.

Pourquoi : forcer le founder à valider la qualité avant publish. Pas d'auto-publish.

Pour passer en `published`, voir Phase 4.

### 4.4 Diff visible avant commit

Avant de committer l'import, le founder voit :

```
Imported file: femiglow-i18n-ui-fr-to-ar-P0-2026-05-27-RETOUR.csv
- 142 keys imported
- 138 new translations
- 4 updates of existing (overrides)
- 0 ignored (deleted keys not in CSV)

Diff sample:
  key: marketing.hero.title
  current: (empty)
  imported: "طقوس الأظافر في خمس دقائق."
  → CREATE

  key: marketing.kit.price_label
  current: "ابتداءً من {price, number, ::currency/MAD}"
  imported: "بدءاً من {price, number, ::currency/MAD}"
  → UPDATE
```

Le founder peut :
- Accepter tout
- Accepter sélectivement (cocher les lignes)
- Annuler

### 4.5 Audit trail

```ts
{
  actor: 'founder@femiglow.local',
  action: 'i18n.import',
  target: 'ui:ar',
  metadata: {
    importId: 'imp_xyz789',
    fileName: 'femiglow-i18n-ui-fr-to-ar-P0-2026-05-27-RETOUR.csv',
    fileHash: 'sha256:def456...',
    relatedExportId: 'exp_abc123', // si lié à un export précédent
    keysCreated: 138,
    keysUpdated: 4,
    keysIgnored: 0,
  },
}
```

## 5. Phase 4 — QA visuel sur staging

### 5.1 Déclencher le deploy staging

Une fois import effectué (draft state), le founder déclenche :

```bash
# Build staging avec drafts inclus
ENV=staging INCLUDE_DRAFTS=true pnpm build
vercel deploy --target=staging
```

Le staging `staging.femiglow.ma` montre les drafts comme s'ils étaient publiés. Production reste inchangée.

### 5.2 Checklist QA par page

Pour chaque page critique (`/`, `/kit`, `/maison`, `/rituel`) × chaque locale traduite :

#### Checklist visuelle

- [ ] Hero title affiche correctement (pas tronqué, pas overflow)
- [ ] CTA boutons : labels courts, pas wrap mauvais
- [ ] Subtitle/body : lisibilité OK, longueur cohérente
- [ ] Plurals fonctionnent (essayer 0, 1, 5 dans cart)
- [ ] Number/currency : format correct (`1 200,00 MAD` FR, `1,200.00 MAD` EN)
- [ ] Dates : format respecté
- [ ] Emojis : conservés
- [ ] Direction RTL fonctionne (pour AR) : alignement, espacement
- [ ] Aucune string FR n'apparaît dans la version AR/EN (pas de fallback visible accidentel)
- [ ] Footer : copyright, mentions, social labels OK

#### Checklist a11y

- [ ] `<html lang="ar">` correct
- [ ] `<html dir="rtl">` pour AR
- [ ] Screen reader : labels aria-label traduits
- [ ] Tab order OK avec RTL
- [ ] Lecture facile (pas de retours de ligne brisés)

#### Checklist SEO

- [ ] `<title>` traduit, < 70 chars
- [ ] `<meta name="description">` traduit, < 160 chars
- [ ] OG title / description traduits
- [ ] JSON-LD a la bonne `inLanguage`
- [ ] Sitemap inclut les URLs localisées

### 5.3 Outils de QA

| Outil | Usage | Fréquence |
|---|---|---|
| **Browser manual** | Click-through des pages clés | Chaque cycle |
| **Playwright visual** | `pnpm test:visual --locale=ar` | Chaque cycle CI |
| **axe-core a11y** | `pnpm test:a11y --locale=ar` | Chaque cycle CI |
| **Lighthouse** | Performance + SEO | Chaque cycle |
| **Mobile preview** | Chrome DevTools + real device | Chaque cycle |

### 5.4 Issues fréquemment détectées en QA

1. **Texte trop long** : "Continuer" (FR) → "متابعة" (AR) → "Continue" (EN) — l'EN est souvent plus court, l'AR peut être plus long. Tester sur mobile.

2. **RTL bugs** : un icône fléché ne miroir pas, padding asymétrique, line-break à droite mal géré. Audit avec `:dir(rtl)` CSS et `RTL-flipper` extension.

3. **Plurals incorrects** : oublier `=0`, `one`, `other`. Tester avec count=0, 1, 2, 5, 11, 21.

4. **Placeholder mal interpolé** : "Bonjour {name}" littéral au lieu de la valeur.

5. **Drift sémantique** : la traduction "marche" mais a perdu la voix FemiGlow (trop commercial, trop urgent).

### 5.5 Process de fix

Si QA détecte un issue :

1. Founder ajoute commentaire dans Google Sheets sur la ligne concernée.
2. Founder lance correction directe dans `/admin/i18n/edit?key=...&locale=...` si simple.
3. Pour drift sémantique : ping le traducteur pour reformulation.
4. Re-import si batch fix.
5. Re-deploy staging.
6. Re-QA.

## 6. Phase 5 — Publish + monitoring

### 6.1 Promotion drafts → published

Endpoint : `POST /api/admin/i18n/publish`

**Body** :
```json
{
  "scope": "ui",
  "locale": "ar",
  "filter": { "priority": "P0" }     // optionnel
}
```

Action :
- Pour chaque entry en `status='draft'` matchant : passe en `status='published'`
- Met à jour `publishedAt`, `publishedBy`
- `revalidateTag(`i18n-${locale}`)`
- `revalidatePath(`/${locale}/`)`

### 6.2 Audit trail

```ts
{
  actor: 'founder@femiglow.local',
  action: 'i18n.publish',
  target: 'ui:ar',
  metadata: {
    keysPublished: 142,
    filter: { priority: 'P0' },
    previousImportId: 'imp_xyz789',
  },
}
```

### 6.3 Smoke tests post-publish

Auto-déclenchés via GitHub Action :

```yaml
name: i18n smoke
on:
  workflow_dispatch:
    inputs:
      locale: { required: true }

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -f https://femiglow.ma/${{ inputs.locale }}/ || exit 1
          curl -f https://femiglow.ma/${{ inputs.locale }}/kit || exit 1
          curl -f https://femiglow.ma/${{ inputs.locale }}/maison || exit 1
      - run: pnpm test:e2e:smoke --grep "${{ inputs.locale }}"
```

### 6.4 Monitoring J+1 à J+7

| Métrique | Outil | Seuil alerte |
|---|---|---|
| Erreurs Sentry localisées (`tags.locale = 'ar'`) | Sentry dashboard | > 0.5% des sessions |
| Missing keys logs (`i18n.missing_key`) | Sentry / Datadog | > 10/jour |
| Fallbacks served (`i18n.fallback_used`) | idem | > 100/jour |
| Bounce rate par locale | Google Analytics | Drift > 20% vs FR |
| Time on page par locale | GA | Drift > 30% vs FR |
| Conversions par locale | GA / Stripe | Drift > 25% vs FR |

### 6.5 Rollback en cas de problème

**Cas A — Quelques clés cassent**

Edit direct admin → `/admin/i18n/edit?key=...&locale=ar`. Fix → republish.

**Cas B — Locale entière problématique**

```sql
-- Bascule en draft tout l'AR
UPDATE i18n_translation_values SET status='draft' WHERE locale='ar';

-- Désactive la locale temporairement
UPDATE i18n_locales SET enabled=false WHERE code='ar';
```

Visiteurs `/ar/` sont redirigés vers `/fr/` (cf. `02-design-conception/locale-detection.md`).

**Cas C — Régression catastrophique**

Feature flag global :
```bash
vercel env add I18N_ENABLED production false
vercel --prod
```

Cf. [`08-plan-action/rollback.md`](../08-plan-action/rollback.md).

## 7. Format de communication founder ↔ traducteur

### 7.1 Email de demande de traduction

Modèle template :

```
Objet : [FemiGlow i18n] Traduction FR→AR — Vague 2 (250 clés, SLA 5j)

Bonjour [Traducteur],

Voici la deuxième vague de traduction pour FemiGlow.

Volume : 250 clés (priorité mixte P0/P1)
Périmètre : pages marketing maison, rituel, contact
Source : FR
Cible : AR
SLA : 5 jours ouvrés (livraison attendue le 04/06)

Fichier joint : femiglow-i18n-ui-fr-to-ar-P0P1-2026-05-30.csv
Glossaire de référence : (lien Google Drive)
Style guide AR : (lien Google Drive)

Rappel des points de vigilance :
- Conserver les placeholders ICU à l'identique : {price, number, ::currency/MAD}
- Conserver les tags rich text : <bold>, <italic>
- "Maison FemiGlow" reste intraduit
- Ton sobre, posé — pas d'urgence factice

En cas de doute, ping moi sur Slack ou email avant J+SLA-1.

Merci !
[Founder]
```

### 7.2 Slack channel `#i18n-translation`

Channel dédié (founder + traducteur + lead tech) pour :
- Questions rapides du traducteur
- Validation de choix terminologiques
- Annonces des nouveaux exports
- Status des cycles en cours

Convention : threads par fichier CSV, mentions `@founder` ou `@traducteur` selon besoin.

### 7.3 Email de retour traducteur

```
Objet : [FemiGlow i18n] RETOUR Traduction FR→AR — Vague 2

Bonjour [Founder],

Voici le fichier traduit pour la Vague 2.

Fichier : femiglow-i18n-ui-fr-to-ar-P0P1-2026-05-30-RETOUR.csv
Total : 248 lignes (2 ignorées — voir notes)

Notes :
- Ligne 87 (marketing.kit.scarcity) : traduction libre — l'idiome "édition limitée" n'a pas d'équivalent direct
- Lignes 142-143 : doublons sémantiques dans le source FR — j'ai traduit identique
- Tous les placeholders ICU sont conservés

À faire de votre côté :
- Review staging.femiglow.ma/ar
- Particulièrement /kit pour validation tone

Cordialement,
[Traducteur]
```

## 8. Glossaire FemiGlow pour traducteur

À distribuer comme document partagé (Google Doc) au traducteur. Voici le contenu :

### 8.1 Termes marque (NE PAS traduire)

| Terme FR | Notes | AR | EN |
|---|---|---|---|
| FemiGlow | Nom de marque | FemiGlow | FemiGlow |
| Maison FemiGlow | Nom complet | Maison FemiGlow | Maison FemiGlow |
| Le kit | Concept produit | الكيت | The kit |

### 8.2 Termes signature à traduire avec cohérence

| FR | Tone | AR (suggestion) | EN (suggestion) |
|---|---|---|---|
| Le rituel | sobre, posé | الطقوس | The ritual |
| Le rituel ongles | spécifique | طقوس الأظافر | The nail ritual |
| Trois gestes | rythme ternaire | ثلاث حركات | Three gestures |
| Une saison | métaphore | موسم واحد | One season |
| Une beauté lente | posture marque | جمال بطيء | Slow beauty |
| Ancrée au Maroc | provenance | مرتكزة في المغرب | Anchored in Morocco |
| La maison | identité | البيت | The maison |

### 8.3 Termes commerciaux

| FR | AR | EN |
|---|---|---|
| Commander | اطلب | Order |
| Découvrir | اكتشف | Discover |
| Payer | ادفع | Pay |
| Livraison | التوصيل | Delivery |
| Carte bancaire | البطاقة البنكية | Credit card |
| Paiement à la livraison | الدفع عند التسليم | Cash on delivery |
| En stock | متوفر | In stock |
| Rupture de stock | نفد المخزون | Out of stock |

### 8.4 Termes interdits (ne JAMAIS utiliser dans la traduction)

- Urgence factice : "Vite !", "Plus que X heures !", "Achetez maintenant !"
- Buzzwords génériques : "amazing", "incredible", "the best"
- Cliché esthétique : "magic", "transform"
- Pression : "Don't miss out", "Last chance"

Tone FemiGlow = **sobre, posé, ancré**. Si une string fait "vente flash" en FR, c'est une erreur de la source — flag au founder.

## 9. Instructions par locale

### 9.1 Arabe (ar) — RTL

- **Direction** : RTL (de droite à gauche). Les CSS sont déjà adaptés ; le traducteur n'a pas à se soucier.
- **Variante** : utiliser **arabe standard moderne** (MSA), PAS la darija marocaine. Sauf cas spécifique chat (relation directe consommateur).
- **Ponctuation** : `،` (comma arabe), `؟` (question arabe), `؛` (semicolon).
- **Numbers** : utiliser les chiffres occidentaux (1, 2, 3) car la UI utilise `Intl.NumberFormat('ar-MA')` qui peut alterner.
- **Genre** : préférer formes neutres ou pluriel. FemiGlow s'adresse aux femmes en V1, mais éviter les marqueurs explicites.
- **Longueur** : AR peut être 10-20% plus long que FR. Vérifier que les CTA tiennent dans les boutons.

### 9.2 Anglais (en)

- **Variante** : **British English** (preferred) ou neutral. Pas US-only.
- **Ton** : conserver la sobriété FR. Éviter le "you" trop direct ou les exclamations.
- **Currency** : reste MAD en V1 (marché Maroc). Ne pas convertir en GBP/USD.
- **Mesures** : si présent (peu probable), utiliser système métrique.
- **Apostrophes** : `'` typographiques préférées (`it's`, pas `it 's`).
- **Longueur** : EN est généralement plus court. Bonus.

### 9.3 Si extension future (es, it, de)

À documenter dans `09-runbook/ajouter-nouvelle-langue.md` au moment venu.

## 10. Cas particuliers

### 10.1 Plurals ICU

```
FR: "{count, plural, =0 {Aucun article} one {1 article} other {# articles}}"
AR: "{count, plural, =0 {لا توجد سلعة} one {سلعة واحدة} two {سلعتان} few {# سلع} many {# سلعة} other {# سلعة}}"
EN: "{count, plural, =0 {No items} one {1 item} other {# items}}"
```

L'arabe a 6 catégories de pluriel (one, two, few, many, other, zero). Tous doivent être présents pour les langues qui les supportent.

→ Validé par `formatjs/cli`.

### 10.2 Genres ICU

```
FR: "Bienvenue, {gender, select, female {chère cliente} male {cher client} other {visiteur}}"
AR: "أهلاً بك، {gender, select, female {عميلتنا العزيزة} male {عميلنا العزيز} other {زائر}}"
```

→ Le traducteur doit gérer les 3 variantes minimum.

### 10.3 Rich text (markdown-like dans messages)

```
FR: "Notre <bold>kit</bold> est <italic>limité</italic>."
AR: "كيتنا <bold>محدود</bold> <italic>وفريد</italic>."
EN: "Our <bold>kit</bold> is <italic>limited</italic>."
```

Les tags doivent être préservés sans espace autour.

### 10.4 Currency formatting

`messages/[locale].json` :
```json
{ "marketing.kit.price_label": "À partir de {price, number, ::currency/MAD}" }
```

Le format `::currency/MAD` est géré par `Intl.NumberFormat`. Le traducteur garde le `{price, number, ::currency/MAD}` intact, traduit "À partir de" en équivalent local.

### 10.5 Dates

`messages/[locale].json` :
```json
{ "marketing.journal.published_on": "Publié le {date, date, medium}" }
```

`date, medium` est formaté par Intl selon la locale. Traduire uniquement "Publié le".

## 11. Anti-patterns workflow

1. **Skip phase QA staging** : tentation pour aller vite, mais des bugs visuels peuvent passer en prod.
2. **Email CSV au lieu de Drive** : risque versionning, pas de trace. Toujours via lien partagé Drive.
3. **Auto-publish à l'import** : interdire. Toujours forcer draft → review → publish.
4. **Pas de glossaire à jour** : le traducteur improvise → drift sémantique. Le founder maintient un Google Doc partagé.
5. **Pas d'audit log** : impossible de débugger "qui a changé quoi". Toujours logger `i18n.export`, `i18n.import`, `i18n.publish`.
6. **Mélanger UI et CMS dans le même CSV** : confus. 2 scopes séparés (`scope=ui` vs `scope=cms`).
7. **Pas de versioning des exports** : si on re-exporte un mois après, on perd l'historique. Toujours timestamp.
8. **Skip ICU placeholder validation à l'import** : risque de plurals cassés en prod. Validation regex au moment du POST /import.

## 12. KPIs workflow

| KPI | Cible V1 | Mesure |
|---|---|---|
| Temps moyen export → import (lead time traducteur) | < 5 j ouvrés | `audit_entries` diff |
| % de cycles sans QA issue | > 80% | Tracking manuel |
| Nombre d'allers-retours fix par cycle | < 2 | idem |
| % d'auto-checks réussis (ICU, rich text) à l'import | 100% | `import.warnings` |
| Volume traduit / mois | ~ 200 clés | Audit log |
| Coût traducteur / mot | À benchmarker | Facturation |

## 13. Outils complémentaires (V2 / V3)

| Outil | Bénéfice | Coût V2 |
|---|---|---|
| **Lokalise** | TM + glossaire + collab + API | $90-300/mois |
| **Crowdin** | Communautaire possible | $40-200/mois |
| **POEditor** | Simple, focus pro | $14-79/mois |
| **GitHub-based PR** (translator) | 0 coût, dev-oriented | 0 |
| **DeepL Pro API** | Pré-traduction qualité | $20+ utilisation |

Décision V2 : à statuer après 3 mois de V1 (juin → août). Si volume > 500 clés/mois et > 3 locales → Lokalise. Sinon CSV manuel reste OK.

## 14. Checklist par cycle de traduction

### Pré-cycle
- [ ] Liste des clés à traduire identifiée (filtrage P0/P1)
- [ ] Export généré et téléchargé
- [ ] Email envoyé au traducteur avec SLA explicite
- [ ] Fichier déposé dans Google Drive

### Pendant cycle
- [ ] Traducteur a confirmé réception
- [ ] Channel Slack ouvert pour questions
- [ ] Founder vérifie progression à J+SLA-2

### Post-cycle traduction
- [ ] CSV de retour reçu
- [ ] Naming respecté (suffix `-RETOUR`)
- [ ] Quick check : fichier valide (UTF-8, header correct)

### Import
- [ ] Upload via `/admin/i18n/import`
- [ ] Aucun error bloquant
- [ ] Diff review avant commit
- [ ] Import audité

### QA staging
- [ ] Build staging déclenché
- [ ] Toutes les pages clés vérifiées dans la locale
- [ ] Tests Playwright relancés
- [ ] Axe-core a11y validé
- [ ] Aucun fallback FR visible

### Publish
- [ ] Promotion drafts → published
- [ ] Smoke tests prod verts
- [ ] Audit log entry créée
- [ ] Annonce dans Slack `#i18n-translation`

### Post-publish
- [ ] Sentry monitoré 7 jours
- [ ] Métriques business comparées (bounce, conversion)
- [ ] Rétrospective avec traducteur si issues

## 15. Référence — fichiers liés

- API admin export/import : [`../03-backend/api-routes.md`](../03-backend/api-routes.md) § "i18n endpoints"
- CMS workflow : [`../03-backend/content-translation.md`](../03-backend/content-translation.md) § 8
- Inventory CSV : [`./translation-keys-inventory.csv`](./translation-keys-inventory.csv)
- Plan global : [`../08-plan-action/phases.md`](../08-plan-action/phases.md)
- Runbook ajout langue : [`../09-runbook/ajouter-nouvelle-langue.md`](../09-runbook/ajouter-nouvelle-langue.md)
- Rollback : [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md)
