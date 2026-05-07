# C3 — home-avis-strip

> Bandeau d'avis lecteur sur la page d'accueil. Trois témoignages
> au repos, séparés par un fleuron champagne. Lazy en viewport,
> animation `fade-in`.

## 1. Identité

| Clé | Valeur |
|---|---|
| `componentKey` | `home-avis-strip` |
| Nom affiché | Bandeau Avis |
| Page-group | `home` |
| RSC path | `apps/web/src/components/sections/AvisStrip.tsx` |
| Wrapper RSC (data fetch) | `apps/web/src/components/sections/AvisStripBound.tsx` |
| Route(s) consommatrice(s) | `/` |
| Statut | `planned` |
| Source actuelle des littéraux | `apps/web/src/components/sections/AvisStrip.tsx` (defaults `kicker`, `title` dans la signature) + `apps/web/src/data/mock/homepage.ts` (`mockHomepage.avis`) |
| Dernière revue | 2026-05-05 — initiales |

## 2. Champs éditoriaux

| key | label | type | required | defaultValue | description | group | config |
|-----|-------|------|----------|--------------|-------------|-------|--------|
| `kicker` | « Kicker » | `kicker` | non | `"Voix"` | Sur-titre de la section. | `Header` | `{ maxLength: 30 }` |
| `heading` | « Titre de section » | `text` | non | `"Celles qui ont essayé."` | H2 italique de la section. | `Header` | `{ maxLength: 60 }` |
| `reviews` | « Témoignages » | `list<record>` | **oui** | (cf. ci-dessous) | Trois portraits clientes, chacun avec prénom, contexte, citation. Cardinalité min 3 max 8. | `Reviews` | `{ minItems: 3, maxItems: 8, itemType: "record", itemConfig: { shape: { … } } }` |
| `cta` | « CTA bas de section » | `cta` | non | `null` | Lien optionnel vers `/rituel` ou un article. N'existe pas dans le RSC actuel — à ajouter en migration. | `CTA` | `{ variants: ["link", "ghost"] }` |

### Shape de `reviews[i]` (record)

| champ | type | required | description | config |
|-------|------|----------|-------------|--------|
| `id` | `text` | oui | Identifiant stable (ex `t1`). Sert de clé React et de jointure éventuelle vers un slot d'avatar. | `{ maxLength: 40 }` |
| `authorFirstName` | `text` | oui | Prénom seul, jamais de nom de famille. | `{ maxLength: 40 }` |
| `authorContext` | `text` | non | Ville ou contexte court (« Casablanca », « Rabat »). | `{ maxLength: 60 }` |
| `quote` | `multiline` | oui | Témoignage à la première personne, 1 à 3 phrases. | `{ maxLength: 240 }` |
| `initieeDepuis` | `text` | non | Date relationnelle (« Janvier 2025 »). Affichée discrètement. | `{ maxLength: 40 }` |
| `rating` | `number` | non | Note 1-5. **Pas affichée** dans le RSC actuel (la maison ne note pas), conservée pour usage futur. | `{ min: 1, max: 5, step: 1 }` |

> **Note** : la fiche initiale prévoyait un champ `excerpt` et
> un `source` ; le RSC consomme en réalité `quote` (texte intégral)
> sans champ source. On garde `quote` pour rester aligné au schéma
> Zod (`testimonialSchema` dans `apps/web/src/lib/schemas/page-content.ts:41`).
> Un `source` (lien externe vers un avis tiers) pourra être ajouté
> au shape sans casser les bindings existants.

> **Note** : l'image du témoin (`handImage` aujourd'hui) reste
> portée par le système Component-Media via les slots `avis-yasmine`
> / `avis-salma` / `avis-ines` du registre. **Le CMS-Fields ne
> contient pas l'image.**

### defaultValue (jsonb encodé)

```jsonc
// home-avis-strip.kicker
{ "v": "Voix" }

// home-avis-strip.heading
{ "v": "Celles qui ont essayé." }

// home-avis-strip.reviews
{
  "items": [
    {
      "fields": {
        "id":               { "v": "t1" },
        "authorFirstName":  { "v": "Salma" },
        "authorContext":    { "v": "Casablanca" },
        "initieeDepuis":    { "v": "Janvier 2025" },
        "quote":            { "v": "Mes ongles ne cassent plus depuis trois mois. Je ne pensais pas que cinq minutes le soir suffiraient." }
      }
    },
    {
      "fields": {
        "id":               { "v": "t2" },
        "authorFirstName":  { "v": "Yasmine" },
        "authorContext":    { "v": "Rabat" },
        "initieeDepuis":    { "v": "Mars 2024" },
        "quote":            { "v": "C’est devenu un moment pour moi. Le rituel rythme ma fin de journée." }
      }
    },
    {
      "fields": {
        "id":               { "v": "t3" },
        "authorFirstName":  { "v": "Inès" },
        "authorContext":    { "v": "Marrakech" },
        "initieeDepuis":    { "v": "Octobre 2023" },
        "quote":            { "v": "La base a une finition naturelle qui me ressemble enfin." }
      }
    }
  ]
}

// home-avis-strip.cta — null tant qu'aucun binding
null
```

## 3. Wireframe / contexte

```
┌───────────────────  / (HomePage, viewport ≥ 1024)  ────────────────┐
│  […] Manifeste ─────────────────────────────────────────────────┐ │
│                                                                  ▼ │
│  ┌──────────────────────  AVIS STRIP  ─────────────────────────┐  │
│  │                                                             │  │
│  │                    ── Voix ──                                │  │
│  │              Celles qui ont essayé.                          │  │
│  │                                                              │  │
│  │   ┌──────────┐    ✣    ┌──────────┐    ✣    ┌──────────┐    │  │
│  │   │  Salma   │         │ Yasmine  │         │   Inès   │    │  │
│  │   │ Casa     │         │ Rabat    │         │ Marraki. │    │  │
│  │   │          │         │          │         │          │    │  │
│  │   │ « Mes    │         │ « C’est  │         │ « La     │    │  │
│  │   │  ongles… »         │  devenu… »         │  base… » │    │  │
│  │   │          │         │          │         │          │    │  │
│  │   │ portrait │         │ portrait │         │ portrait │    │  │
│  │   └──────────┘         └──────────┘         └──────────┘    │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  Fleuron                                                            │
│  [ JournalExtraitsBound ]                                          │
└─────────────────────────────────────────────────────────────────────┘
```

> Mobile : la grille passe en colonne unique, le fleuron de
> séparation se masque (`hidden self-center lg:block` dans
> `AvisStrip.tsx:50`).

> **Capture de référence** : `apps/web/public/_screenshots/home-avis-strip.png`.

## 4. Lignes éditoriales (voix FemiGlow)

- **kicker** : un mot, parfois deux (« Voix », « Voix d'ici »).
- **heading** : phrase brève, italique, ponctuée. Ne dit
  pas « Avis clients » — préfère un groupe nominal éditorial
  (« Celles qui ont essayé. »).
- **quote** : voix réelle, 1 à 3 phrases, en français de tous les
  jours. Apostrophes courbes obligatoires. Pas de superlatif
  (« incroyable », « le meilleur »). Pas d'adjectif d'achat
  (« qualité prix »). On garde le **je**, on évite le **nous**.
- **authorFirstName** : prénom seul. Pas d'initiale du nom.
- **authorContext** : ville. Si la cliente n'est pas marocaine,
  préciser le pays (« Paris, France »).
- **initieeDepuis** : « Mois Année », jamais une date complète.

### Bons exemples

```
quote : « Mes ongles ne cassent plus depuis trois mois. Je ne
         pensais pas que cinq minutes le soir suffiraient. »
quote : « C’est devenu un moment pour moi. Le rituel rythme ma
         fin de journée. »
```

### Contre-exemples

```
quote : « Produit incroyable !!! Je recommande à 100% !! »  — emphase
quote : « 5 étoiles, livraison rapide, conforme à la description. »
                                                            — registre marketplace
quote : « Nous sommes ravies de cette acquisition. »        — nous, registre formel
```

## 5. Scénarios MSW (6)

```ts
// scenario: empty
// Aucun binding. Cascade défaut. La grille affiche les 3 témoignages
// seedés.
{ componentKey: 'home-avis-strip', bindings: [] }

// scenario: default
// 3 reviews seedés en published, identiques au defaultValue.
{
  componentKey: 'home-avis-strip',
  bindings: [
    { fieldKey: 'kicker',  status: 'published', value: { v: 'Voix' } },
    { fieldKey: 'heading', status: 'published', value: { v: 'Celles qui ont essayé.' } },
    { fieldKey: 'reviews', status: 'published', value: { items: [/* … 3 items defaults … */] } },
  ],
}

// scenario: less-than-min
// reviews avec 2 items seulement → Zod rejette (minItems: 3).
// L'admin doit afficher un message « 1 témoignage manquant ».
{
  fieldKey: 'reviews',
  value: { items: [/* item1 */, /* item2 */] },
}

// scenario: long-text
// Une `quote` à 320 caractères, dépasse le maxLength=240.
// Le compteur passe en rouge, le save est bloqué côté client et serveur.
{
  fieldKey: 'reviews',
  value: { items: [
    { fields: {
      id: { v: 't-long' },
      authorFirstName: { v: 'Maya' },
      quote: { v: '…320 caractères…' }
    }},
  ]},
}

// scenario: special-chars
// Apostrophes courbes, guillemets français imbriqués.
{
  fieldKey: 'reviews',
  value: { items: [{
    fields: {
      id: { v: 't-q' },
      authorFirstName: { v: 'Lina' },
      quote: { v: 'Salma m’a écrit\u202f: «\u202fLaisse pousser, ce n’est pas grave.\u202f» Ça m’a apaisée.' }
    }
  }]},
}

// scenario: max-items
// 8 reviews, à la borne haute. Le rendu doit gérer le wrap visuel
// (la grille CSS prévue ne tient pas 8 colonnes ; en attendant un
// design dédié, on accepte le débordement responsive).
{
  fieldKey: 'reviews',
  value: { items: [/* 8 témoignages */] },
}
```

## 6. Notes de migration

1. **Lire les littéraux** dans deux endroits :
   - Defaults `kicker = 'Voix'` et `title = 'Celles qui ont essayé.'`
     dans la signature de `AvisStrip.tsx:21-24` (props par défaut).
   - Tableau `mockHomepage.avis` (3 témoignages) dans
     `apps/web/src/data/mock/homepage.ts:58-99`.
2. **Décider du nom du field titre** : le RSC l'appelle `title`
   en prop, le registre va le nommer **`heading`** pour ne pas
   collisionner avec l'usage générique « title » (réservé au H1
   de page). Documenter dans le PR.
3. **Ne pas migrer `handImage`** : c'est un media, géré par les
   slots existants `avis-yasmine`, `avis-salma`, `avis-ines`. La
   correspondance `review.id` ▸ slot media est faite côté
   `AvisStripBound`.
4. **Conserver l'invariant `max:3` du Zod** : tant que le RSC ne
   sait pas afficher plus de 3 témoignages proprement, on **ne
   relâche pas** la borne `homepageContentSchema.avis.max(3)`.
   Le `maxItems: 8` du registre est une borne future et **doit
   être ramenée à 3** au moment de la migration tant que le rendu
   n'a pas évolué. Annoter `// TODO: relax once design supports >3`.

> Procédure pas-à-pas : [`runbook/02-add-field.md`](../runbook/02-add-field.md) (R2).

## 7. Tests liés

| Niveau | Fichier | Couverture |
|--------|---------|------------|
| Unit (resolver) | `apps/web/src/lib/components/__tests__/home-avis-strip.resolve.test.ts` | cascade, fallback à `mockHomepage.avis`. |
| RTL (RSC) | `apps/web/src/components/sections/AvisStrip.test.tsx` *(à créer)* | rendu 0/1/3 témoignages, fleuron seulement entre les items. |
| RTL (admin éditeur) | `apps/web/src/app/admin/components/[key]/__tests__/home-avis-strip.editor.test.tsx` | éditeur de liste, ajout/retrait d'un item, validation `minItems`. |
| E2E | `apps/web/playwright/admin/home-avis-strip.spec.ts` | ajouter un témoignage, programmer la publication. |

## 8. Changelog

| Date | Auteur | Changement |
|------|--------|------------|
| 2026-05-05 | docs | Création initiale. Defaults seedés depuis `AvisStrip.tsx` + `mockHomepage.avis`. |
