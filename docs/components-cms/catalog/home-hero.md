# C2 — home-hero

> Hero principal de la page d'accueil. Image eager, animation
> `reveal-up`. Premier contact éditorial du site : c'est lui qui
> donne le ton.

## 1. Identité

| Clé | Valeur |
|---|---|
| `componentKey` | `home-hero` |
| Nom affiché | Hero Accueil |
| Page-group | `home` |
| RSC path | `apps/web/src/components/sections/Hero.tsx` |
| Wrapper RSC (data fetch) | `apps/web/src/components/sections/HeroBound.tsx` |
| Route(s) consommatrice(s) | `/` |
| Statut | `planned` |
| Source actuelle des littéraux | `apps/web/src/data/mock/homepage.ts` (objet `mockHomepage.hero`) |
| Dernière revue | 2026-05-05 — initiales |

## 2. Champs éditoriaux

| key | label | type | required | defaultValue | description | group | config |
|-----|-------|------|----------|--------------|-------------|-------|--------|
| `kicker` | « Kicker (sur-titre) » | `kicker` | non | `"Maison de Casablanca"` | Sur-titre court affiché au-dessus du H1, traité visuellement en champagne avec filet. | `Header` | `{ maxLength: 30 }` |
| `title` | « Titre principal » | `text` | **oui** | `"Le rituel ongles, en cinq minutes."` | H1 de la page. Tiens en deux lignes sur mobile. | `Header` | `{ maxLength: 70 }` |
| `subtitle` | « Sous-titre » | `multiline` | non | `"Trois gestes, une saison. Une beauté lente, ancrée au Maroc."` | Phrase d'accroche éditoriale, deux à trois lignes max. | `Header` | `{ maxLength: 200 }` |
| `cta` | « Bouton principal » | `cta` | non | `{ "label": "Découvrir le rituel", "href": "/rituel", "variant": "primary" }` | CTA de conversion. Vise une page-group du site. | `CTA` | `{ variants: ["primary", "secondary"] }` |
| `ctaSecondary` | « Bouton secondaire » | `cta` | non | `{ "label": "Voir le kit", "href": "/kit", "variant": "link" }` | CTA inline discret, à côté du primaire. | `CTA` | `{ variants: ["link", "ghost"] }` |
| `badge` | « Badge éditorial » | `text` | non | `null` | Pastille optionnelle (« Nouveauté », « Édition limitée »). N'existe pas dans le RSC actuel — à ajouter au moment de la migration. | `Header` | `{ maxLength: 20 }` |

> **Note migration `badge`** : ce champ n'a **pas** de littéral
> existant dans `Hero.tsx` ni dans le mock. Il est introduit par la
> migration. Le RSC devra ajouter un emplacement conditionnel
> `{data.badge && <Badge>…</Badge>}` au-dessus du kicker, ou décider
> de différer l'ajout (auquel cas retirer la ligne ici jusqu'à la
> phase 2 du rollout).

> **Note migration `ctaSecondary`** : la fiche initiale n'en
> faisait pas mention ; nous la retenons parce que le RSC la consomme
> déjà (`data.ctaSecondary`). Le retirer demanderait de dégrader le
> RSC. Conservé.

### Exemples encodés (jsonb)

```jsonc
// home-hero.title
{ "v": "Le rituel ongles, en cinq minutes." }

// home-hero.subtitle
{ "v": "Trois gestes, une saison. Une beauté lente, ancrée au Maroc." }

// home-hero.kicker
{ "v": "Maison de Casablanca" }

// home-hero.cta
{ "label": "Découvrir le rituel", "href": "/rituel", "variant": "primary" }

// home-hero.ctaSecondary
{ "label": "Voir le kit", "href": "/kit", "variant": "link" }

// home-hero.badge   — null tant qu'aucun binding
null
```

## 3. Wireframe / contexte

```
┌────────────────────  / (HomePage, viewport 1440)  ────────────────┐
│  [ Header global ]                                                 │
│                                                                    │
│  ┌────────────────────────  HERO  ──────────────────────────────┐ │
│  │                                                              │ │
│  │  ── kicker ────────                            ┌───────────┐ │ │
│  │  Maison de Casablanca                          │           │ │ │
│  │                                                │  image    │ │ │
│  │  Le rituel ongles,                             │  4:5      │ │ │
│  │  en cinq minutes.                              │  eager    │ │ │
│  │                                                │  priority │ │ │
│  │  Trois gestes, une saison. Une                 │           │ │ │
│  │  beauté lente, ancrée au Maroc.                │           │ │ │
│  │                                                │           │ │ │
│  │  [ Découvrir le rituel ]   Voir le kit →       │           │ │ │
│  │                                                └───────────┘ │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  Fleuron                                                           │
│  [ Section voisine — GestesGrid (5 gestes) ]                       │
└────────────────────────────────────────────────────────────────────┘
```

> **Capture de référence** : `apps/web/public/_screenshots/home-hero.png`.
> Vue mobile : empilement vertical, image rabattue sous le bloc
> texte (cf. `lg:grid-cols-[6fr_5fr]` dans `Hero.tsx:26`).

## 4. Lignes éditoriales (voix FemiGlow)

- **kicker** : nomme la maison ou la saison (« Maison de Casablanca »,
  « Le rituel du soir »). Pas de slogan, pas de promesse.
- **title** : phrase courte, factuelle, ponctuée. Verbe au présent
  ou groupe nominal. **Ne jamais** utiliser de capitales d'emphase.
- **subtitle** : développe le titre en une seule respiration.
  Trois propositions courtes séparées par des points conviennent
  bien (cf. defaultValue).
- **cta.label** : verbe à l'infinitif (« Découvrir », « Voir »,
  « Lire »). Maximum 3 mots.

### Bons exemples

```
title    : « Le rituel ongles, en cinq minutes. »
subtitle : « Trois gestes, une saison. Une beauté lente, ancrée au Maroc. »
kicker   : « Maison de Casablanca »
cta      : « Découvrir le rituel » → /rituel
```

### Contre-exemples

```
title    : « LA RÉVOLUTION DU SOIN ! »                — emphase, capitales
subtitle : « Découvrez vite notre offre exceptionnelle ! »  — injonction
kicker   : « ✨ Trending now »                        — emoji + anglicisme
cta      : « Cliquez ici pour en savoir plus »        — verbe d'écran
```

## 5. Scénarios MSW (6)

```ts
// scenario: empty
// Pas de binding personnalisé. La cascade tombe sur defaultValue.
// Le rendu doit être identique à la prod actuelle.
{
  componentKey: 'home-hero',
  bindings: [],
}

// scenario: default
// Tous les fields ont un binding 'published' identique au defaultValue
// (état post-seed initial).
{
  componentKey: 'home-hero',
  bindings: [
    { fieldKey: 'kicker',   status: 'published', value: { v: 'Maison de Casablanca' } },
    { fieldKey: 'title',    status: 'published', value: { v: 'Le rituel ongles, en cinq minutes.' } },
    { fieldKey: 'subtitle', status: 'published', value: { v: 'Trois gestes, une saison. Une beauté lente, ancrée au Maroc.' } },
    { fieldKey: 'cta',      status: 'published', value: { label: 'Découvrir le rituel', href: '/rituel', variant: 'primary' } },
  ],
}

// scenario: long-text
// Titre 92 chars (au-delà de maxLength=70) — l'admin doit refuser au save,
// le résolveur tronque proprement (… aux mots) si jamais ça passe en DB.
{
  fieldKey: 'title',
  value: { v: 'Le rituel ongles du soir, ancré dans la lumière de fin de journée et la lenteur méditerranéenne.' },
}

// scenario: special-chars
// Apostrophes courbes, guillemets français, espace insécable.
{
  fieldKey: 'subtitle',
  value: { v: 'Une beauté lente, ancrée au Maroc\u202f; trois gestes\u202f: rien d’autre.' },
}

// scenario: cta-mailto
// CTA externe avec mailto: — la sanitization doit l'accepter,
// allowedHrefSchemes inclut 'mailto'.
{
  fieldKey: 'cta',
  value: { label: 'Écrire à la maison', href: 'mailto:bonjour@femiglow.ma', variant: 'secondary' },
}

// scenario: scheduled-pending
// Un brouillon programmé pour ce soir 22h, le rendu actuel reste sur 'published'.
{
  fieldKey: 'title',
  status: 'scheduled',
  scheduledAt: '2026-05-05T20:00:00.000Z',
  value: { v: 'Édition de printemps : le rituel se simplifie.' },
}
```

## 6. Notes de migration

1. **Lire les littéraux** dans `apps/web/src/data/mock/homepage.ts`
   (`mockHomepage.hero`). Le RSC `Hero.tsx` ne contient **pas** de
   littéraux français : il consomme `data: HeroData`.
2. **Ajouter `fields`** dans l'entrée `home-hero` du registre TS
   (`apps/web/src/lib/components/registry.ts`, ligne ~157).
3. **Préserver `image`** : le `data.image` reste géré par le
   système Component-Media existant (slot `primary`). Le CMS-Fields
   ne touche **pas** à l'image.
4. **Brancher le RSC** : remplacer dans `HeroBound.tsx` la lecture
   du mock par `resolveComponentFields('home-hero')` ; les
   littéraux du fallback sont les `defaultValue` du registre.
5. **Garder `data.cta` en signature** : ne pas renommer le shape
   du prop, le RSC reste agnostique du système de fields.

> Procédure pas-à-pas : [`runbook/02-add-field.md`](../runbook/02-add-field.md) (R2).

## 7. Tests liés

| Niveau | Fichier | Couverture |
|--------|---------|------------|
| Unit (resolver) | `apps/web/src/lib/components/__tests__/home-hero.resolve.test.ts` | cascade default ▸ binding, cas `cta` manquant. |
| RTL (RSC) | `apps/web/src/components/sections/Hero.test.tsx` *(à créer)* | rendu avec/sans `subtitle`, avec/sans `cta`, sans `image`. |
| RTL (admin éditeur) | `apps/web/src/app/admin/components/[key]/__tests__/home-hero.editor.test.tsx` | dirty tracking sur `title`, validation maxLength. |
| E2E | `apps/web/playwright/admin/home-hero.spec.ts` | éditer `title`, sauver brouillon, publier, vérifier rendu `/`. |

## 8. Changelog

| Date | Auteur | Changement |
|------|--------|------------|
| 2026-05-05 | docs | Création initiale, défauts seedés depuis `mockHomepage.hero`. |
