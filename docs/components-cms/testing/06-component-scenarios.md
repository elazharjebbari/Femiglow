# T6 — Matrice scénarios par composant

> Pour **chaque composant du registre** (cf. `apps/web/src/lib/components/registry.ts`),
> liste les champs prévus, les scénarios MSW, la couverture RTL et le
> parcours E2E associé. Sert de checklist d'avancement migration
> (cf. R4 rollout).

## Convention

- **Champs** ci-dessous : projection éditoriale **prévue** une fois la
  phase 2 du rollout exécutée pour le composant. Tant que la migration
  d'un composant n'est pas faite, ses champs vivent encore en dur dans
  le RSC ; mais la cible est listée ici dès maintenant pour cadrer le
  travail.
- **MSW scénarios** : `S=success`, `V=validation 422`, `C=conflit 409`,
  `N=network error`, `D=slow response`. Codes par champ. Une suite
  par champ × scénario aboutit au calcul `n_fields × 5` mentionné dans
  le brief.
- **RTL** : éditeurs unitaires + panneau (cf. T4).
- **E2E** : `@nominal`, `@error`, `@visual`. Renvoie au fichier
  Playwright (cf. T5).

## Pyramide par page-group

| Page-group | Composants | Fields totaux | MSW cases | RTL specs | E2E specs |
|---|---|---|---|---|---|
| Home | 3 | 11 | 55 | 9 | 1 nominal + 1 erreur |
| Rituel | 5 | 17 | 85 | 9 | 1 nominal |
| Kit | 5 | 18 | 90 | 9 | 1 nominal |
| Maison | 5 | 16 | 80 | 9 | 1 nominal + scheduling |
| Journal — shared | 3 | 10 | 50 | 5 | — |
| Journal — articles (×15) | 15 | 75 | 375 | 0 (template) | 1 restore |
| OG (× page-group) | inclus ci-dessus | — | — | — | — |
| **Total** | **36** | **147** | **735** | **41** | **5 nominaux + 3 erreurs + visual** |

> ~735 cas MSW = 147 fields × 5 scénarios. La majorité est générée
> par paramétrage Vitest (`describe.each`), pas écrite ligne par ligne.

## Home

### `home-hero` — Hero Accueil

| Field | Type | MSW scénarios | RTL coverage | E2E parcours |
|---|---|---|---|---|
| `kicker` | kicker (text) | S, V (min/max), C, N, D | TextEditor.test, panneau | `@nominal Home` |
| `title` | text | S, V (required), C, N, D | TextEditor.test, panneau | `@nominal Home`, `@error 422` |
| `subtitle` | multiline | S, V, C, N, D | MultilineEditor.test | `@nominal Home` |
| `cta` | cta | S, V (href), C, N, D | CtaEditor.test | `@nominal Home` |

Fixtures : `src/test/fixtures/components-cms/home-hero.ts`. 4 fields × 5 = **20 cas MSW**.

### `home-avis-strip` — Bandeau Avis

| Field | Type | MSW scénarios | RTL | E2E |
|---|---|---|---|---|
| `heading` | text | S, V, C, N, D | TextEditor.test | — |
| `avisYasmineQuote` | quote ({text,author}) | S, V, C, N, D | QuoteEditor.test | — |
| `avisSalmaQuote` | quote | S, V, C, N, D | QuoteEditor.test | — |
| `avisInesQuote` | quote | S, V, C, N, D | QuoteEditor.test | — |

4 fields × 5 = **20 cas MSW**.

### `home-og` — OG Accueil

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `ogTitle` | text | S, V, C, N, D | TextEditor.test | — |
| `ogDescription` | multiline | S, V, C, N, D | MultilineEditor.test | — |
| `ogAlt` | text | S, V, C, N, D | TextEditor.test | — |

3 fields × 5 = **15 cas MSW**.

## Rituel

### `rituel-hero-lifestyle`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `kicker` | kicker | S, V, C, N, D | TextEditor.test | `@nominal Rituel` |
| `title` | text | S, V, C, N, D | TextEditor.test | `@nominal Rituel` |
| `intro` | multiline | S, V, C, N, D | MultilineEditor.test | — |
| `cta` | cta | S, V, C, N, D | CtaEditor.test | — |

### `rituel-portrait-salma`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `legend` | text | S, V, C, N, D | TextEditor.test | — |
| `bodyMd` | rich-text | S, V (sanitize), C, N, D | RichTextEditor.test | — |
| `signature` | text | S, V, C, N, D | TextEditor.test | — |

### `rituel-origine-sepia`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `kicker` | kicker | S, V, C, N, D | TextEditor.test | — |
| `title` | text | S, V, C, N, D | TextEditor.test | — |
| `bodyMd` | rich-text | S, V, C, N, D | RichTextEditor.test | — |

### `rituel-video-4-gestes`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `gesteList` | list(record) | S, V (min 4 max 4), C, N, D | ListEditor + RecordEditor | — |
| `caption` | text | S, V, C, N, D | TextEditor.test | — |

`gesteList` shape : `{ icon, label, durationSec }` × 4 entrées.

### `rituel-og`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `ogTitle` | text | S, V, C, N, D | TextEditor.test | — |
| `ogDescription` | multiline | S, V, C, N, D | MultilineEditor.test | — |

## Kit

### `kit-hero-produit`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `kicker` | kicker | S, V, C, N, D | TextEditor.test | `@nominal Kit` |
| `productName` | text | S, V, C, N, D | TextEditor.test | `@nominal Kit` |
| `priceLabel` | text | S, V, C, N, D | TextEditor.test | — |
| `ctaPrimary` | cta | S, V (href), C, N, D | CtaEditor.test | — |
| `ctaSecondary` | cta | S, V, C, N, D | CtaEditor.test | — |

### `kit-detail-mains`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `kicker` | kicker | S, V, C, N, D | TextEditor.test | — |
| `title` | text | S, V, C, N, D | TextEditor.test | — |
| `bulletPoints` | list(text) | S, V (min 3 max 6), C, N, D | ListEditor.test | — |

### `kit-comparatif`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `heading` | text | S, V, C, N, D | TextEditor.test | — |
| `productCards` | list(record) | S, V, C, N, D | ListEditor + RecordEditor | — |

`productCards` shape : `{ name, price, highlights: list(text), cta }` × 3.

### `kit-hands-testimonials`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `heading` | text | S, V, C, N, D | TextEditor.test | — |
| `testimonials` | list(record) | S, V, C, N, D | ListEditor + RecordEditor | — |

`testimonials` shape : `{ name, before, after, quote }` × 3.

### `kit-og`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `ogTitle` | text | S, V, C, N, D | TextEditor.test | — |
| `ogDescription` | multiline | S, V, C, N, D | MultilineEditor.test | — |

## Maison

### `maison-hero`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `kicker` | kicker | S, V, C, N, D | TextEditor.test | `@nominal Maison` |
| `title` | text | S, V, C, N, D | TextEditor.test | `@nominal Maison` |
| `lead` | multiline | S, V, C, N, D | MultilineEditor.test | — |

### `maison-fondatrice-mains`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `name` | text | S, V, C, N, D | TextEditor.test | — |
| `role` | text | S, V, C, N, D | TextEditor.test | — |
| `manifestoMd` | rich-text | S, V (sanitize), C, N, D | RichTextEditor.test | — |

### `maison-atelier-gallery`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `heading` | text | S, V, C, N, D | TextEditor.test | — |
| `captions` | list(text) | S, V (length=3), C, N, D | ListEditor.test | — |

### `maison-cross-links`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `crossRituelLabel` | text | S, V, C, N, D | TextEditor.test | `@nominal Maison schedule` |
| `crossRituelHref` | link | S, V (href), C, N, D | LinkEditor.test | — |
| `crossKitLabel` | text | S, V, C, N, D | TextEditor.test | — |
| `crossKitHref` | link | S, V, C, N, D | LinkEditor.test | — |
| `crossJournalLabel` | text | S, V, C, N, D | TextEditor.test | — |
| `crossJournalHref` | link | S, V, C, N, D | LinkEditor.test | — |

### `maison-og`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `ogTitle` | text | S, V, C, N, D | TextEditor.test | — |
| `ogDescription` | multiline | S, V, C, N, D | MultilineEditor.test | — |

## Journal — shared

### `journal-hero`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `kicker` | kicker | S, V, C, N, D | TextEditor.test | — |
| `title` | text | S, V, C, N, D | TextEditor.test | — |
| `intro` | multiline | S, V, C, N, D | MultilineEditor.test | — |

### `journal-featured`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `articleSlug` | enum (slugs registre) | S, V, C, N, D | EnumEditor.test | — |
| `overrideKicker` | text (optionnel) | S, V, C, N, D | TextEditor.test | — |
| `cta` | cta | S, V, C, N, D | CtaEditor.test | — |

### `journal-og`

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `ogTitle` | text | S, V, C, N, D | TextEditor.test | — |
| `ogDescription` | multiline | S, V, C, N, D | MultilineEditor.test | — |

## Journal — articles individuels

> 15 composants `journal-article-<slug>` (cf. `registry.ts`). Tous
> partagent le même schéma de fields. **Une seule suite RTL**
> paramétrée par `describe.each(SLUGS)`.

### Schéma commun

| Field | Type | MSW | RTL | E2E |
|---|---|---|---|---|
| `kicker` | kicker | S, V, C, N, D | template `journal-article.test.tsx` | `@nominal Journal restore` (sur `cinq-minutes-le-soir`) |
| `title` | text | S, V (required), C, N, D | template | `@nominal Journal restore` |
| `excerpt` | multiline | S, V, C, N, D | template | — |
| `bodyMd` | rich-text | S, V (sanitize), C, N, D | template (test sanitize spécifique) | — |
| `publishedDate` | text (ISO) | S, V (format), C, N, D | template | — |

### Liste des 15 slugs

| Slug | Spec E2E ? |
|---|---|
| `cinq-minutes-le-soir` | ✅ `@nominal Journal restore` |
| `ranger-son-rituel` | — |
| `voix-de-lina` | — |
| `voix-de-sara` | — |
| `voix-d-amal` | — |
| `la-poudre-de-kaolin` | — |
| `hiver-ongles-patience` | — |
| `avril-soleil-bas` | — |
| `pluie-de-mars` | — |
| `huile-d-argan-vraie` | — |
| `matieres-d-ailleurs` | — |
| `la-cuisine-comme-laboratoire` | — |
| `la-table-comme-atelier` | — |
| `la-maison-au-printemps` | — |
| `visiter-l-atelier` | — |

15 articles × 5 fields × 5 scénarios = **375 cas MSW**. Implémentés
par `describe.each(JOURNAL_SLUGS)` dans un fichier unique :

```ts
describe.each(JOURNAL_SLUGS)('journal-article-%s', (slug) => {
  describe.each(['kicker', 'title', 'excerpt', 'bodyMd', 'publishedDate'] as const)(
    'field=%s',
    (field) => {
      it.each(['S', 'V', 'C', 'N', 'D'] as const)('scénario %s', async (kind) => {
        // Arrange handler selon kind, render panneau, assert
      });
    },
  );
});
```

Fixture commune : `src/test/fixtures/components-cms/journal-article.ts`,
avec un `buildJournalArticleFields(slug)` qui produit le state stable.

## Composants Footer / Layout (à venir)

> Hors registre actuel mais prévus pour la phase 2 du rollout.
> On réserve les clés ici pour anticiper les fixtures.

| Composant | Page-group | Champs prévus |
|---|---|---|
| `shared-footer` | shared | `tagline`, `legalLinks`(list), `socialLinks`(list), `copyrightText` |
| `shared-header` | shared | `navItems`(list of link), `ctaHeader`(cta) |
| `shared-newsletter-strip` | shared | `heading`, `bodyMd`, `placeholderEmail`, `ctaLabel`, `consentText` |

À ajouter à la matrice quand le registre les intègrera (cf. R3 add-component).

## Ce que la matrice n'inclut PAS

- Les **medias** (images, vidéos) — couverts par le système
  Component-Media existant et ses propres tests.
- Les **animations** — couvertes par les tests
  `animations-registry.test.ts` existants.
- Les **slots** (key, label, accept) — schéma dans `siteComponents`
  inchangé (cf. A2 §extension).

Cette matrice est limitée à la **dimension fields** ajoutée par
Components-CMS.

## Cross-références

- `apps/web/src/lib/components/registry.ts` — source des composants.
- A2 §Encodage value (jsonb par type), A3 §EC2 (champ ajouté → seed
  initial pose un binding `published`).
- F1 (registry éditeurs), B4 (seed extensions).
- T2 § cascade, encoders. T3 §Bundle happy-path. T4 §éditeurs. T5
  §parcours nominaux.
- R4 (rollout par page-group) — la matrice sert de checklist.
- C1 → C5 (catalog) — fiches détaillées par composant migré.
