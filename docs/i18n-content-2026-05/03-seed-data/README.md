# Seed data — i18n FemiGlow (mai 2026)

> Dossier de seeds prêts à être injectés en DB et en code, dérivés des 3 fichiers de traduction `02-translations/messages-{fr,ar,en}.json` (766 keys canonicales).
>
> Date de production : 2026-05-27. Statut global : **draft** — aucune ligne n'est marquée `published`.
> Toutes les ressources sont à valider par le founder avant publication. Les drifts détectés dans `04-quality/review-notes.md` ont été préservés telles quelles (pas de correction silencieuse).

## Vue d'ensemble

| Destination | Format | Locales | Volume |
|---|---|---|---|
| CMS `component_field_bindings` | CSV | fr, ar, en | 510 rows / locale |
| DB `legal_pages` | Markdown + frontmatter | fr, ar, en | 9 slugs / locale |
| Mock data `src/data/mock/*.ts` | JSON | fr, ar, en | ~40 KB / locale |

## Fichiers produits

```
03-seed-data/
├── README.md                          (ce fichier)
├── component-bindings-fr.csv          (510 rows)
├── component-bindings-ar.csv          (510 rows)
├── component-bindings-en.csv          (510 rows)
├── legal-pages-fr/
│   ├── _index.csv                     (9 entrées)
│   ├── mentions-legales.md            (traduit depuis JSON)
│   ├── cgv.md                         (stub — pointe vers 60-content)
│   ├── cgu.md                         (stub)
│   ├── confidentialite.md             (stub)
│   ├── cookies.md                     (stub)
│   ├── retours-remboursements.md      (stub)
│   ├── livraison.md                   (stub)
│   ├── securite-produits.md           (stub)
│   └── faq.md                         (stub)
├── legal-pages-ar/                    (mêmes 9 slugs)
├── legal-pages-en/                    (mêmes 9 slugs)
├── mock-data-fr.json                  (~40 KB)
├── mock-data-ar.json                  (~47 KB)
└── mock-data-en.json                  (~38 KB)
```

## Destination 1 — `component_field_bindings`

### Format CSV

Colonnes : `component_slug, field_key, locale, value, status, notes`.

- `component_slug` : identifiant logique du composant CMS (kebab-case, ex. `home-hero`, `kit-composition`, `commerce-merci`).
- `field_key` : chemin JSON aplati avec `__` comme séparateur (ex. `hero__title`, `composition__paste__ingredient__cire__name`).
- `locale` : `fr` / `ar` / `en`.
- `value` : la chaîne traduite. CSV-quoting standard (guillemets si virgule, retour-ligne ou guillemet présent).
- `status` : `draft` partout — à passer en `published` après validation founder.
- `notes` :
  - `icu` : présence d'un marqueur d'interpolation `{var}` ou pattern plural (12 rows / locale).
  - `drift: …` : conserve telle quelle une valeur dérivante listée dans `04-quality/review-notes.md` §1.
  - `typo: …` / `anonymisation: …` : autres flags hérités du review-notes.

### Mapping clé i18n → component_slug

Le mapping suit la convention "1 namespace JSON = 1 composant CMS", avec quelques découpages plus fins pour les pages composites (kit, maison, commerce).

| Préfixe JSON | component_slug | Rows FR |
|---|---|---|
| `marketing.home.hero` | `home-hero` | 6 |
| `marketing.home.gestes` | `home-gestes` | 11 |
| `marketing.home.manifeste` | `home-manifeste` | 4 |
| `marketing.home.avis` | `home-avis` | 12 |
| `marketing.home.metadata` (+ `fallback_og_alt`) | `home-metadata` | 5 |
| `marketing.kit.product` (+ `pack_image_alt`) | `kit-product` | 7 |
| `marketing.kit.composition` | `kit-composition` | 52 |
| `marketing.kit.comparatif` | `kit-comparatif` | 23 |
| `marketing.kit.faq` | `kit-faq` | 19 |
| `marketing.kit.hands_testimonials` | `kit-hands-testimonials` | 10 |
| `marketing.kit.hands` | `kit-hands` | 3 |
| `marketing.kit.reassurances` | `kit-reassurances` | 6 |
| `marketing.kit.ingredients` | `kit-ingredients` | 3 |
| `marketing.kit.hero` | `kit-hero` | 3 |
| `marketing.kit.commander` | `kit-commander` | 3 |
| `marketing.kit.pivot_final` | `kit-pivot-final` | 4 |
| `marketing.kit.product_feed` | `kit-product-feed` | 43 |
| `marketing.kit.pack_visual` | `kit-pack-visual` | 2 |
| `marketing.kit.metadata` | `kit-metadata` | 3 |
| `marketing.maison.hero` | `maison-hero` | 4 |
| `marketing.maison.origine` | `maison-origine` | 5 |
| `marketing.maison.fondatrice` | `maison-fondatrice` | 4 |
| `marketing.maison.atelier` | `maison-atelier` | 7 |
| `marketing.maison.matieres` | `maison-matieres` | 14 |
| `marketing.maison.engagements` | `maison-engagements` | 14 |
| `marketing.maison.crosslinks` | `maison-crosslinks` | 6 |
| `marketing.maison.metadata` | `maison-metadata` | 5 |
| `marketing.rituel.hero` | `rituel-hero` | 4 |
| `marketing.rituel.howto` | `rituel-howto` | 2 |
| `marketing.rituel.origine` | `rituel-origine` | 5 |
| `marketing.rituel.video` | `rituel-video` | 7 |
| `marketing.rituel.sciences` | `rituel-sciences` | 11 |
| `marketing.rituel.interview` | `rituel-interview` | 13 |
| `marketing.rituel.pivot` | `rituel-pivot` | 2 |
| `marketing.rituel.journal_cross` | `rituel-journal-cross` | 2 |
| `marketing.rituel.metadata` | `rituel-metadata` | 4 |
| `marketing.contact.hero` | `contact-hero` | 3 |
| `marketing.contact.form` | `contact-form` | 20 |
| `marketing.contact.faq` | `contact-faq` | 12 |
| `marketing.contact.crosslinks` | `contact-crosslinks` | 3 |
| `marketing.contact.direct` | `contact-direct` | 4 |
| `marketing.contact.metadata` | `contact-metadata` | 3 |
| `marketing.journal.hero` | `journal-hero` | 2 |
| `marketing.journal.cross` | `journal-cross` | 5 |
| `marketing.journal.grid` | `journal-grid` | 3 |
| `marketing.journal.categories` | `journal-categories` | 7 |
| `marketing.journal.article` | `journal-article` | 34 |
| `marketing.journal.breadcrumb` | `journal-breadcrumb` | 2 |
| `marketing.journal.metadata` | `journal-metadata` | 3 |
| `marketing.commerce.commander` | `commerce-commander` | 2 |
| `marketing.commerce.panier` | `commerce-panier` | 2 |
| `marketing.commerce.merci` | `commerce-merci` | 31 |
| `marketing.commerce.cart` | `commerce-cart` | 5 |
| `marketing.commerce.empty_cart` | `commerce-empty-cart` | 4 |
| `marketing.commerce.cart_summary` | `commerce-cart-summary` | 7 |
| `marketing.commerce.cart_contents` | `commerce-cart-contents` | 11 |
| `marketing.commerce.minicart` | `commerce-minicart` | 7 |
| `marketing.commerce.trust_signals` | `commerce-trust-signals` | 8 |
| `marketing.commerce.journal_cross_panier` | `commerce-journal-cross` | 3 |
| `marketing.commerce.sticky_cta` | `commerce-sticky-cta` | 1 |

**Total : 60 slugs distincts, 510 bindings par locale (1 530 toutes locales confondues).**

### Namespaces NON injectés dans les bindings

Volontairement exclus (gérés ailleurs) :

- `common.*`, `navigation.*`, `errors.*`, `seo.*` : à charger via `next-intl` (`apps/web/src/messages/*.json`), pas via le CMS.
- `legal.*` : voir Destination 2.
- `email.*` : à coller dans les templates email (`apps/web/src/lib/email/templates/*.tsx`) ou injecter via un module dédié, pas en CMS.
- `chat.*` : à intégrer dans la config du chat assistant (`apps/web/src/lib/chat/*`), pas en CMS.
- `mock-data.*` : voir Destination 3.

### Comment injecter (commande attendue)

Le script de seed n'est pas livré ici. Format de commande attendu :

```bash
pnpm tsx scripts/seed-component-bindings.ts \
  --csv docs/i18n-content-2026-05/03-seed-data/component-bindings-fr.csv \
  --locale fr
```

Le script doit :

1. Lire le CSV et grouper par `component_slug`.
2. Pour chaque slug, créer/récupérer la `components.id` (table existante).
3. Upserter dans `component_field_bindings` avec `(component_id, field_key, locale)` comme clé unique, en respectant `status = 'draft'`.
4. Idempotent : ré-exécution sans erreur, même valeurs.

## Destination 2 — `legal_pages`

### Format markdown + frontmatter

Chaque fichier `.md` contient :

```markdown
---
slug: <slug>
locale: <fr|ar|en>
title: <titre traduit>
status: draft
source: <provenance — JSON ou doc canonique>
---

# <titre>

<corps markdown>
```

### Slugs livrés (9 par locale)

Liste alignée avec `apps/web/scripts/seed-legal.ts` :

| Slug | FR | AR | EN | Source |
|---|---|---|---|---|
| `mentions-legales` | Mentions légales | الإشعارات القانونية | Legal notices | **Reconstruit depuis `legal.mentions_legales.*` JSON** (traduit pour AR + EN) |
| `cgv` | Conditions générales de vente | الشروط العامة للبيع | Terms and conditions of sale | Stub — pointe vers `docs/legal-pages/60-content/conditions-generales-vente.md` |
| `cgu` | Conditions générales d'utilisation | شروط استخدام الموقع | Terms of use | Stub — pointe vers `docs/legal-pages/60-content/conditions-generales-utilisation.md` |
| `confidentialite` | Politique de confidentialité | سياسة الخصوصية | Privacy policy | Stub |
| `cookies` | Politique cookies | سياسة ملفات تعريف الارتباط | Cookies policy | Stub |
| `retours-remboursements` | Politique de retours et remboursements | سياسة الإرجاع والاسترداد | Returns and refunds policy | Stub |
| `livraison` | Politique de livraison | سياسة التوصيل | Shipping policy | Stub |
| `securite-produits` | Sécurité produits cosmétiques | السلامة وتحذيرات منتجات التجميل | Cosmetic products safety | Stub |
| `faq` | FAQ Service client | الأسئلة الشائعة — خدمة العملاء | FAQ — Customer service | Stub |

**Statut détaillé :**

- `mentions-legales.md` : **publish-ready après revue founder** (corps complet traduit dans les 3 locales depuis le JSON).
- 8 autres slugs : **stubs (requires founder review)** — la traduction AR/EN n'a pas été produite dans `messages-{ar,en}.json` (le JSON ne contient que `legal.mentions_legales.*` côté contenu). Le contenu canonique FR vit dans `docs/legal-pages/60-content/<file>.md` et doit être traduit séparément (~8 longs documents de 80-220 lignes chacun).

### Comment injecter (commande attendue)

Le script `apps/web/scripts/seed-legal.ts` existe déjà et lit les MD depuis `docs/legal-pages/60-content/`. Pour ajouter le support multilocale :

```bash
# Variante multi-locale (à implémenter, en s'inspirant de seed-legal.ts existant) :
pnpm tsx scripts/seed-legal-i18n.ts \
  --content-dir docs/i18n-content-2026-05/03-seed-data/legal-pages-fr \
  --locale fr

pnpm tsx scripts/seed-legal-i18n.ts \
  --content-dir docs/i18n-content-2026-05/03-seed-data/legal-pages-ar \
  --locale ar

pnpm tsx scripts/seed-legal-i18n.ts \
  --content-dir docs/i18n-content-2026-05/03-seed-data/legal-pages-en \
  --locale en
```

Le script doit upserter sur `(slug, locale)` dans `legal_pages` (la table actuelle a déjà la colonne `locale`).

### `_index.csv` par locale

Chaque sous-dossier contient un `_index.csv` listant tous les slugs avec :

```csv
slug,title,status,source,note
```

C'est le manifeste à utiliser pour driver le seed plutôt que de scanner le dossier.

## Destination 3 — Mock data

### Format JSON

Un fichier JSON par locale, structuré pour mapper directement aux fichiers `src/data/mock/*.ts`.

### Structure

```json
{
  "_meta": { "locale": "fr", "source": "messages-fr.json", "destinations": [...] },
  "articles": [ { "key": "hiver", "slug": "hiver-ongles-patience", "title": "...", "kicker": "...", "excerpt": "...", "body": "...", "author_name": "...", "author_bio": "..." }, ... ],
  "homepage": { "metadata": {...}, "hero": {...}, "gestes": {...}, "manifeste": {...}, "avis_kicker": "...", "avis_title": "...", "avis_items": [...] },
  "kit": { "product": {...}, "composition": { "section": {...}, "paste": {...}, "powder": {...}, "polissoir": {...} }, "comparatif": {...}, "faq": { "section": {...}, "items": [...] }, "hands_testimonials": [...], ... },
  "maison": { "metadata": {...}, "hero": {...}, "origine": {...}, "fondatrice": {...}, "atelier": {...}, "matieres": { "section": {...}, "items": [...] }, "engagements": { "section": {...}, "items": [...] }, "crosslinks": {...} },
  "rituel": { "metadata": {...}, "howto": {...}, "hero": {...}, "origine": {...}, "video": {...}, "sciences": {...}, "interview": { "section": {...}, "introduction": "...", "nom_interviewee": "...", "questions": [...] }, "pivot": {...}, "journal_cross": {...} },
  "contact": { "metadata": {...}, "hero": {...}, "form": {...}, "faq": { "kicker": "...", "title": "...", "items": [...] }, "crosslinks": {...}, "direct": {...} },
  "ritual_module": { "kicker": "...", "empty_title": "...", "empty_body": "...", "headline_one": "...", "headline_many": "...", "read_all": "..." }
}
```

### Volumes par locale

| Section | FR | AR | EN |
|---|---|---|---|
| `articles` | 15 | 15 | 15 |
| `homepage.avis_items` | 3 | 3 | 3 |
| `kit.faq.items` | 8 | 8 | 8 |
| `kit.hands_testimonials` | 3 | 3 | 3 |
| `maison.matieres.items` | 4 | 4 | 4 |
| `maison.engagements.items` | 6 | 6 | 6 |
| `rituel.interview.questions` | 5 | 5 | 5 |
| `contact.faq.items` | 5 | 5 | 5 |
| **Taille fichier** | 40 KB | 47 KB | 38 KB |

### Mapping `mock-data-*.json` → `src/data/mock/*.ts`

| Clé JSON | Fichier mock cible | Notes |
|---|---|---|
| `articles[]` | `src/data/mock/articles.ts` (`mockArticles`) | 15 articles. Le mock TS porte aussi `publishedAt`, `featuredImage`, `category`, `readingTimeMinutes` — données structurelles, **pas dans le JSON**. |
| `homepage.{metadata,hero,gestes,manifeste}` | `src/data/mock/homepage.ts` | Sections H1 à H4. |
| `homepage.avis_items[]` | `src/data/mock/homepage.ts` (`testimonials`) | 3 témoignages (`salma`, `yasmine`, `ines`). |
| `kit.product` | `src/data/mock/product.ts` (+ `kit.ts`) | Nom, tagline, description, image alts. |
| `kit.composition.*` | `src/data/mock/kit.ts` | Paste, powder, polissoir + ingredients INCI. |
| `kit.comparatif` | `src/data/mock/kit.ts` | 6 lignes (préparation, tenue, récupération, coût, impact, temps). |
| `kit.faq.items[]` | `src/data/mock/kit.ts` | 8 Q/R. |
| `kit.hands_testimonials[]` | `src/data/mock/kit.ts` | 3 témoignages (`amal`, `lina`, `sara`). |
| `kit.{hero,commander,pivot_final,product_feed,pack_visual}` | `src/data/mock/kit.ts` + `src/lib/products/feed/kit-feed.ts` | Sections page kit + product feed. |
| `maison.*` | `src/data/mock/maison.ts` | Origine, fondatrice, atelier, matières, engagements, crosslinks. |
| `rituel.*` | `src/data/mock/rituel.ts` | Sections + interview Q/R + video chapters. |
| `contact.*` | (pas de fichier mock dédié — sections directement dans `app/(marketing)/contact/page.tsx`) | Form fields, FAQ, crosslinks, direct contact. |
| `ritual_module` | (utilisé par un composant chat/communauté) | Headlines `one`/`many` avec ICU plural. |

### Comment injecter

Trois options possibles :

1. **Conversion en fichiers `messages/{fr,ar,en}.json` pour `next-intl`** (recommandé) :
   ```bash
   pnpm tsx scripts/seed-i18n-messages.ts \
     --mock docs/i18n-content-2026-05/03-seed-data/mock-data-fr.json \
     --output apps/web/src/messages/fr.json
   ```

2. **Charger dans la DB CMS via mock-articles repository** (si on veut éditorialiser les articles en CMS) :
   ```bash
   pnpm tsx scripts/seed-mock-articles.ts \
     --json docs/i18n-content-2026-05/03-seed-data/mock-data-fr.json \
     --locale fr
   ```

3. **Garder en mock TypeScript** : convertir manuellement le JSON en mock TS typé (statu quo actuel pour `src/data/mock/*.ts`).

## Drifts et flags conservés

Les drifts détectés dans `04-quality/review-notes.md` sont **conservés tels quels** dans les seeds, avec un flag dans la colonne `notes` (CSV) ou en commentaire (MD). Aucune correction silencieuse.

### Drifts présents dans les bindings (12 lignes flagées par locale)

| Path | Composant | Drift | Référence |
|---|---|---|---|
| `marketing.home.gestes.title` | `home-gestes` | "Cinq gestes" mais liste 3 gestes | review-notes §1.2 |
| `marketing.kit.product_feed.steps.header.lead` | `kit-product-feed` | "Quatre gestes hebdo" — drift gestes + fréquence | §1.2 + §1.7 |
| `marketing.kit.product_feed.steps.header.total_duration` | `kit-product-feed` | "5 min le soir" vs "une fois par semaine" cohabite | §1.7 |
| `marketing.kit.product_feed.social_proof.count_label_geo` | `kit-product-feed` | "maisons en France" (devrait être Maroc) | §1.1 |
| `marketing.kit.composition.paste.ingredient.jojoba.function` | `kit-composition` | Typo "Hémisphage" (mot inexistant) | §1.6 |
| `marketing.kit.composition.paste.volume` | `kit-composition` | 15 g vs 30 ml selon source | §1.5 |
| `marketing.kit.composition.powder.volume` | `kit-composition` | 8 g vs 30 g selon source | §1.5 |
| `marketing.kit.pack_visual.label_avis_clientes` | `kit-pack-visual` | "clientes" vs voix "initiées" | §5.2 |
| `marketing.kit.product.name` | `kit-product` | "Pack" vs "Kit" — drift commercial | §1.3 |
| `marketing.rituel.interview.nom_interviewee` | `rituel-interview` | "Notre fondatrice" (anonymisation) | §1.4 |
| `marketing.commerce.merci.letter.kicker` | `commerce-merci` | "Un mot de notre fondatrice" | §1.4 |
| `marketing.commerce.merci.letter.signature` | `commerce-merci` | "notre fondatrice" anonymisée | §1.4 |

### Drift hors bindings (non flagué — dans seo/email/chat)

À traiter séparément lors de l'injection des autres namespaces :

- `seo.json_ld.organization.address_locality = "Casablanca"` (devrait être Rabat — §1.1)
- `seo.json_ld.organization.founder_name = "Yasmine Jebbari"` (anonymisation incomplète — §1.4)
- `seo.json_ld.organization.description` : mentionne "quatre gestes" (drift §1.2)
- `seo.settings.default_description` : Casablanca + quatre gestes (§1.1 + §1.2)
- `legal.mentions_legales.editor.director = "Salma Jebbari, fondatrice de FemiGlow"` (anonymisation incomplète — §1.4)

## Gaps signalés au founder

Items que je n'ai pas pu extraire ou produire entièrement :

1. **Contenu légal complet AR/EN (8 slugs sur 9)** : seules `mentions-legales.md` (3 locales) sont prêtes. Les 8 autres slugs (`cgv`, `cgu`, `confidentialite`, `cookies`, `retours-remboursements`, `livraison`, `securite-produits`, `faq`) sont des stubs pointant vers la source canonique FR (`docs/legal-pages/60-content/`). Volume manquant : ~1 500 lignes de markdown à traduire en AR et EN.
2. **Mock article bodies AR/EN** : seuls `marketing.journal.article.body.hiver` est présent dans `messages-fr.json` (et donc traduit en AR/EN). Les 14 autres articles n'ont **pas de body** dans le JSON (uniquement title + excerpt). Le body complet des 14 autres articles vit dans `apps/web/src/data/mock/articles.ts` (FR-only) et reste à traduire.
3. **Métadonnées structurelles non i18n** : `articles[].publishedAt`, `articles[].featuredImage.src`, `articles[].category`, `articles[].readingTimeMinutes` n'apparaissent pas dans les seeds — ils restent dans le code TS (justifié : ce sont des données techniques, pas du texte traduisible).
4. **Drift gestes/Pack/Rabat** : non corrigé dans les seeds, conservé pour décision founder.
5. **Adresse, email, téléphone dans `mentions-legales`** : les placeholders `{email}` du JSON n'ont pas été remplacés. Le markdown généré contient `25 bis avenue Patrice Lumumba, Rabat`, `info@femiglow-maroc.com`, `+212 (0)5 37 00 00 00` en dur — à confirmer ou à remplacer par une interpolation de variables côté seed.
6. **Pages déclarées dans `seo.known_pages` mais inexistantes** (`/manifeste`, `/fondatrice`, `/temoignages`, `/faq`) : voir review-notes §1.9.

## Validation

- Tous les fichiers JSON sont **JSON valide** (testé avec `json.load`).
- Tous les fichiers CSV ont **6 colonnes** et utilisent `csv.QUOTE_MINIMAL` (échappement standard, pas de trailing comma).
- Les **clés component_slug et slug sont cohérentes entre les 3 locales** (même structure FR ↔ AR ↔ EN).
- Les **marqueurs ICU sont préservés** : 12 rows par locale flaguées `icu` dans la colonne `notes`.
- **Aucun fichier écrit dans `apps/web/`** — uniquement dans `docs/i18n-content-2026-05/03-seed-data/`.

## Provenance et reproductibilité

Scripts d'extraction (non versionnés, à conserver pour traçabilité) :

- `/tmp/extract_bindings.py` — produit les 3 CSV.
- `/tmp/extract_legal.py` — produit les MD + index.csv pour les 3 locales légales.
- `/tmp/extract_mockdata.py` — produit les 3 JSON mock-data.

Tous les scripts sont déterministes (sort stable par `component_slug`, `field_key`) — ré-exécuter le pipeline produit byte-for-byte le même résultat.
