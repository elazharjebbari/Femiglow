# C4 — maison-cross-links

> Triptyque de cartes de fin de page Maison, qui invitent à
> continuer la lecture vers Rituel, Journal, Kit. Lazy en
> viewport, animation `cross-link`. Les images sont aussi
> réutilisées en vignettes 88×88 dans le sommaire (variant `xs`).

## 1. Identité

| Clé | Valeur |
|---|---|
| `componentKey` | `maison-cross-links` |
| Nom affiché | Cross-links Maison |
| Page-group | `maison` |
| RSC path | `apps/web/src/components/sections/CrossLinkTriptyque.tsx` |
| Composant carte (item) | `apps/web/src/components/sections/CrossLinkCard.tsx` |
| Wrapper RSC (data fetch) | bound côté `MaisonPage` (`apps/web/src/app/(marketing)/maison/page.tsx`) |
| Route(s) consommatrice(s) | `/maison` |
| Statut | `planned` |
| Source actuelle des littéraux | `apps/web/src/data/mock/maison.ts` (`mockMaison.crossLinks`) |
| Dernière revue | 2026-05-05 — initiales |

## 2. Champs éditoriaux

| key | label | type | required | defaultValue | description | group | config |
|-----|-------|------|----------|--------------|-------------|-------|--------|
| `heading` | « Titre de section » | `text` | non | `null` | H2 optionnel au-dessus du triptyque. **N'existe pas dans le RSC actuel** : à ajouter au moment de la migration. | `Header` | `{ maxLength: 60 }` |
| `intro` | « Phrase d'introduction » | `multiline` | non | `null` | Phrase courte au-dessus des cartes. **N'existe pas dans le RSC actuel** : à ajouter. | `Header` | `{ maxLength: 200 }` |
| `links` | « Cartes » | `list<record>` | **oui** | (cf. ci-dessous) | Liste de cartes de cross-link. Cardinalité min 2 max 6 ; le design actuel attend 3 (grille `sm:grid-cols-3`). | `Cards` | `{ minItems: 2, maxItems: 6, itemType: "record", itemConfig: { shape: { … } } }` |

### Shape de `links[i]` (record)

| champ | type | required | description | config |
|-------|------|----------|-------------|--------|
| `id` | `text` | oui | Identifiant stable (ex `rituel`, `journal`, `kit`). Sert de clé React et de jointure vers le slot media correspondant (`cross-rituel`, `cross-journal`, `cross-kit`). | `{ maxLength: 40 }` |
| `kicker` | `kicker` | non | Sur-titre court de la carte (« Le rituel »). | `{ maxLength: 30 }` |
| `label` | `text` | oui | Titre cliquable de la carte. La fiche initiale parlait de `label` : on conserve ce nom. Mappé au `titre` du schéma actuel. | `{ maxLength: 50 }` |
| `description` | `multiline` | non | Phrase descriptive optionnelle. **N'existe pas dans le RSC actuel** : à ajouter. | `{ maxLength: 200 }` |
| `href` | `link` | oui | URL interne (`/rituel`, `/journal`, `/kit`) ou ancre (`#origine`). | `{ allowedHrefSchemes: ["http", "https"] }` |
| `icon` | `icon` | non | Icône optionnelle. Pas utilisée par le design actuel mais prévue pour une variante future. | `{ iconRegistry: "femiglow-curated" }` |

> **Image de la carte** : portée par le système Component-Media,
> slots `cross-rituel`, `cross-journal`, `cross-kit` du registre.
> **Le CMS-Fields ne contient pas l'image.**

> **Note shape** : le schéma Zod actuel
> (`apps/web/src/lib/schemas/page-content.ts`, `crossLinkSchema`) a
> `kicker`, `titre`, `href`, `image`. Le shape ci-dessus introduit
> `description` et `icon`, et **renomme** `titre` → `label`. Au
> moment de la migration, soit on aligne le Zod (préféré), soit
> on map dans le `Bound`.

### defaultValue (jsonb encodé)

```jsonc
// maison-cross-links.heading — null tant qu'aucun binding
null

// maison-cross-links.intro — null tant qu'aucun binding
null

// maison-cross-links.links
{
  "items": [
    {
      "fields": {
        "id":          { "v": "rituel" },
        "kicker":      { "v": "Le rituel" },
        "label":       { "v": "Lire le rituel" },
        "description": null,
        "href":        { "href": "/rituel", "label": "Lire le rituel", "external": false }
      }
    },
    {
      "fields": {
        "id":          { "v": "journal" },
        "kicker":      { "v": "Le journal" },
        "label":       { "v": "Le journal" },
        "description": null,
        "href":        { "href": "/journal", "label": "Le journal", "external": false }
      }
    },
    {
      "fields": {
        "id":          { "v": "kit" },
        "kicker":      { "v": "Le kit" },
        "label":       { "v": "Voir le kit" },
        "description": null,
        "href":        { "href": "/kit", "label": "Voir le kit", "external": false }
      }
    }
  ]
}
```

## 3. Wireframe / contexte

```
┌──────────  /maison (MaisonPage, viewport ≥ 640)  ─────────────────┐
│  […] Engagements ─────────────────────────────────────────────┐  │
│                                                                ▼  │
│  ┌────────────────────  CROSS-LINKS  ──────────────────────────┐  │
│  │   (heading optionnel — non rendu aujourd'hui)              │  │
│  │   (intro optionnelle — non rendue aujourd'hui)             │  │
│  │                                                             │  │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │  │
│  │  │   image 4:5  │   │   image 4:5  │   │   image 4:5  │    │  │
│  │  │   (cover)    │   │   (cover)    │   │   (cover)    │    │  │
│  │  │              │   │              │   │              │    │  │
│  │  │ kicker       │   │ kicker       │   │ kicker       │    │  │
│  │  │ Le rituel    │   │ Le journal   │   │ Le kit       │    │  │
│  │  │              │   │              │   │              │    │  │
│  │  │ Lire le      │   │ Le journal   │   │ Voir le      │    │  │
│  │  │ rituel →     │   │            → │   │ kit →        │    │  │
│  │  └──────────────┘   └──────────────┘   └──────────────┘    │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  [ Footer global ]                                                 │
└────────────────────────────────────────────────────────────────────┘
```

> Mobile (`< 640px`) : grille en colonne unique, cartes empilées.
> La grille `sm:grid-cols-3` du `CrossLinkTriptyque.tsx:13` régit
> la responsiveness.

> **Capture de référence** : `apps/web/public/_screenshots/maison-cross-links.png`.

## 4. Lignes éditoriales (voix FemiGlow)

- **kicker** : « Le rituel », « Le journal », « Le kit ». Article
  défini, deux mots. Cohérence inter-cartes obligatoire.
- **label** : verbe à l'infinitif + complément court (« Lire
  le rituel », « Voir le kit »). Sur la carte journal qui pointe
  vers un index, le label peut être un groupe nominal (« Le
  journal »).
- **description** (futur) : une phrase, pas plus. Pose un détail
  qui complète le titre sans le redire (« Cinq gestes, en cinq
  minutes »). Pas de promesse d'achat.
- **href** : toujours interne en première intention. Si lien
  externe, exiger `external: true` et `target="_blank"` côté
  rendu.

### Bons exemples

```
kicker : « Le journal »
label  : « Le journal »          ← acceptable, pointe vers l’index
href   : /journal

kicker      : « Le rituel »
label       : « Lire le rituel »
description : « Cinq gestes, en cinq minutes. »
href        : /rituel
```

### Contre-exemples

```
kicker : « ON RECOMMANDE »                — emphase
label  : « Cliquez ici »                  — verbe d’écran
label  : « Le rituel ! Découvrez tous nos gestes pas à pas avec Salma. »
                                          — trop long, sature la carte
href   : https://femiglow.ma/rituel       — préférer relatif
```

## 5. Scénarios MSW (6)

```ts
// scenario: empty
// Cascade défaut, 3 cartes seedées. Heading & intro à null → non rendus.
{ componentKey: 'maison-cross-links', bindings: [] }

// scenario: default
// 3 links seedés en published, identiques au defaultValue.
{
  componentKey: 'maison-cross-links',
  bindings: [
    { fieldKey: 'links', status: 'published', value: { items: [/* 3 items defaults */] } },
  ],
}

// scenario: with-heading
// La fondatrice ajoute un heading et une intro pour le launch printemps.
{
  bindings: [
    { fieldKey: 'heading', status: 'published', value: { v: 'Continuer la lecture' } },
    { fieldKey: 'intro',   status: 'published', value: { v: 'Trois portes d’entrée vers la maison.' } },
  ],
}

// scenario: less-than-min
// links avec 1 item — Zod rejette (minItems: 2). L'admin doit afficher
// « Ajouter au moins 2 cartes » et bloquer la publication.
{
  fieldKey: 'links',
  value: { items: [/* 1 item */] },
}

// scenario: external-href
// Une carte pointe vers un domaine externe (ex partenaire presse).
// Le rendu doit ajouter rel="noopener" et target="_blank".
{
  fieldKey: 'links',
  value: { items: [{ fields: {
    id:    { v: 'press' },
    label: { v: 'Lire dans Vogue Adria' },
    href:  { href: 'https://www.vogue.com/article-femiglow', label: 'Vogue Adria', external: true }
  }}]},
}

// scenario: scheduled-pending
// Reformulation programmée pour la sortie du nouveau kit.
{
  fieldKey: 'links',
  status: 'scheduled',
  scheduledAt: '2026-09-01T05:00:00.000Z',
  value: { items: [/* 3 items v2 */] },
}
```

## 6. Notes de migration

1. **Lire les littéraux** dans `apps/web/src/data/mock/maison.ts`
   (`mockMaison.crossLinks`, lignes 135-172).
2. **Renommer `titre` → `label`** dans le shape : la fiche initiale
   et la cohérence transverse (CTA, link…) imposent `label`. Le
   schéma Zod `crossLinkSchema` doit suivre — prévoir une migration
   du mock dans le PR.
3. **`heading` et `intro`** : ajouter au RSC `CrossLinkTriptyque.tsx`
   un `<header>` conditionnel au-dessus de la `<ul>`. Préférer
   ne **pas** rendre quand la valeur est `null` (pas de placeholder
   visible).
4. **`description`** : ajouter au composant carte
   (`CrossLinkCard.tsx`) un `<p>` optionnel. Tester l'impact
   visuel sur les 3 cartes existantes (préserver l'alignement
   vertical en grille).
5. **Image** : déjà géré par Component-Media, slot `cross-rituel`,
   `cross-journal`, `cross-kit`. **Pas de field image** ici.
6. **Cardinalité** : la fiche initiale demandait `min 2 max 6`. Le
   design actuel n'absorbe que 3. Pendant la migration, fixer
   `maxItems: 3` et noter `// TODO: relax once layout supports
   2/4/6`.

> Procédure pas-à-pas : [`runbook/02-add-field.md`](../runbook/02-add-field.md) (R2).

## 7. Tests liés

| Niveau | Fichier | Couverture |
|--------|---------|------------|
| Unit (resolver) | `apps/web/src/lib/components/__tests__/maison-cross-links.resolve.test.ts` | cascade, jointure id ▸ slot media. |
| RTL (RSC) | `apps/web/src/components/sections/CrossLinkTriptyque.test.tsx` *(à créer)* | rendu 2/3 cartes, heading optionnel. |
| RTL (admin éditeur) | `apps/web/src/app/admin/components/[key]/__tests__/maison-cross-links.editor.test.tsx` | drag-reorder, validation `id` unique. |
| E2E | `apps/web/playwright/admin/maison-cross-links.spec.ts` | réordonner les cartes, publier, vérifier `/maison`. |

## 8. Changelog

| Date | Auteur | Changement |
|------|--------|------------|
| 2026-05-05 | docs | Création initiale. Defaults seedés depuis `mockMaison.crossLinks`. Renommage `titre` → `label` à acter au moment de la migration. |
