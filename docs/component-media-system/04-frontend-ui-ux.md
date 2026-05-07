# 04 — Frontend, UI & UX

## Inventaire des écrans admin

| Route                                  | Rôle                              |
|----------------------------------------|-----------------------------------|
| `/admin/components`                    | Liste, filtres, "santé" globale   |
| `/admin/components/[key]`              | Détail composant + bindings + anim|
| `/admin/components/seed`               | Import des PNG `docs/images/values/` (assistant guidé) |
| `/admin/components/animations`         | Catalogue des profils d'animation |

(L'admin reste sous `requireAdmin()` → middleware déjà en place.)

## Navigation

L'entrée s'ajoute dans le shell admin existant (cf. `AdminShell` ou
`TrackingShell` selon le pattern utilisé). On crée un sous-shell
**Components** distinct des shells Tracking / Media :

```
Admin
├── Tableau de bord
├── Tracking ▸
├── Médias ▸
├── Composants ▸           ← NEW
│   ├── Inventaire
│   ├── Animations
│   └── Importer PNG sources
├── Leads
└── Réglages
```

## Page `/admin/components` — Inventaire

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Composants visuels                                  [Importer PNG] │
│  Inventaire centralisé · 24 composants · 18 actifs · 6 vides        │
├─────────────────────────────────────────────────────────────────────┤
│  ▣ Tabs par page : [Toutes] [Home] [Journal] [Kit] [Maison] [Rituel]│
│  Filtres : Catégorie ▾  · Avec binding ☐ · Sans média ☐  Search 🔍 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │ Hero    │  │ Article │  │ Cross-  │  │ Pivot   │                 │
│  │ Home    │  │ Card    │  │ Link    │  │ Banner  │                 │
│  │ ━━━━━━  │  │ ━━━━━━  │  │ ━━━━━━  │  │ ━━━━━━  │                 │
│  │ ⬜ ⬜    │  │ 1 slot  │  │ 3 slots │  │ ⬜      │                  │
│  │ active  │  │ vide    │  │ active  │  │ vide    │                  │
│  │ /home   │  │ /journal│  │ /home   │  │ /maison │                  │
│  │ [✏️]     │  │ [✏️]     │  │ [✏️]     │  │ [✏️]     │                 │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Carte composant

Chaque carte montre :
- Nom du composant (titre serif)
- Catégorie + page (mini badges)
- **Preview thumbnail** : si binding actif → vignette du média (variant
  `thumb`) ; sinon → SVG fallback rendu
- Compteur de slots actifs / total
- État "vide" (rouge soft) ou "configuré" (emerald soft)
- Action principale : `[Configurer]` ouvre la page détail

**État vide général** :
> _Aucun composant. Lance la commande_ `pnpm seed:components` _ou clique sur "Synchroniser le registre"._

## Page `/admin/components/[key]` — Détail

### Layout en 3 colonnes (desktop ≥ 1024)

```
┌───────────────────────────────────────────────────────────────────────┐
│ ← Composants  ·  Hero — Page d'accueil           [Aperçu] [Désactiver]│
├──────────────────────────┬─────────────────────┬──────────────────────┤
│ INFOS                    │ SLOTS               │ ANIMATIONS           │
│                          │                     │                      │
│ Path : Hero.tsx          │ ▣ primary  [active] │ Profil par défaut    │
│ Catégorie : hero         │ ┌──────────────┐    │ ▾ fade-in            │
│ Page : home              │ │  preview     │    │                      │
│ Slot LOAD : eager        │ │  hero-home   │    │ Disponibles :        │
│ Priority : high          │ └──────────────┘    │ ☑ none               │
│                          │ Lazy : eager        │ ☑ fade-in (default)  │
│ Fallback SVG :           │ Priority : high     │ ☐ reveal-up          │
│ /images/hero-home.svg    │ Animation : fade-in │ ☐ scale-hover        │
│                          │                     │                      │
│ [Sync registry]          │ [Changer média]     │ Reduced-motion : ✓   │
│                          │ [Désactiver]        │                      │
│                          │ [Désassigner]       │                      │
└──────────────────────────┴─────────────────────┴──────────────────────┘
```

### Composants atomiques

- **`SlotCard`** : carte d'un slot avec preview, binding actuel, actions.
- **`MediaPicker`** : modale qui ouvre la library `/admin/media` avec :
  - filtre par tag pré-rempli (`<pageGroup>/hero`, `<pageGroup>/card`…)
  - filtre par kind (image/video selon le slot)
  - sélection unique
  - bouton "Uploader" (raccourci vers `/admin/media/upload?return=...`)
- **`LoadingStrategySelect`** : `radio` group avec 4 options + tooltips
  expliquant le compromis perf/UX.
- **`AnimationProfileSelector`** : liste des profils avec preview live
  (motion.div animé) qui respecte `useReducedMotion`.
- **`PreviewPanel`** : iframe vers `/admin/components/[key]/preview` qui
  rend le composant tel qu'il apparaîtra sur la page publique.

## Picker média (drawer)

```
┌──────────────────────────────────────────────────────────────┐
│  Sélectionner un média pour « Hero — Page d'accueil »  [✕]   │
├──────────────────────────────────────────────────────────────┤
│  Filtres : tag=home/hero · kind=image · status=ready         │
│  🔍 [Recherche…]                                              │
├──────────────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                   │
│  │ ✓  │ │    │ │    │ │    │ │    │ │    │  → grid 6 cols   │
│  │home│ │mai │ │ate │ │... │ │... │ │... │                   │
│  │hero│ │son │ │lier│ │    │ │    │ │    │                   │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                   │
│                                                              │
│  [+ Uploader un nouveau média]    [Annuler] [Confirmer →]    │
└──────────────────────────────────────────────────────────────┘
```

## Page `/admin/components/seed` — Assistant import

Wizard 3 étapes :

1. **Scan** : recense les fichiers de `docs/images/values/` (count par
   pageGroup), montre la map `image → composant` (avec mismatch en rouge).
2. **Confirmation** : checkbox `force` (re-upload), `autoActivate` (off
   par défaut).
3. **Exécution** : POST seed-from-docs ; affiche les compteurs en temps
   réel (Server-Sent Events optionnel V2 ; polling sur `mediaJobs.health`
   en V1).

## Page `/admin/components/animations` — Profils

Liste des profils avec :
- Nom + key + kind
- Preview live (motion.div qui boucle l'animation)
- Description
- Liste des composants qui l'utilisent (badge count)
- Action : "Modifier" (édite `params` JSON, lecture seule sur `config`).

## Composant public `<ComponentMedia>`

Signature :

```tsx
import { ComponentMedia } from '@/components/media/ComponentMedia';

<ComponentMedia
  componentKey="hero-home"
  slot="primary"
  fallbackSvg="/images/hero-home.svg"
  alt="Une main au calme posée sur du lin beige"
  className="h-[80vh] w-full object-cover"
  /* overrides optionnels */
  loadingOverride="eager"
  prioritOverride
/>
```

Côté serveur (RSC) :
1. Appelle `resolveComponentMedia({ componentKey, slot })`.
2. Si binding actif + media → délègue à `<MediaImage media={...} loading={...} />`.
3. Sinon → `<img src={fallbackSvg} alt={alt} className={className} />` simple.
4. Wraps dans `<ComponentAnimationWrapper componentKey={componentKey}>`
   qui applique le profil d'animation par défaut (rendu client).

## Style

- Tokens existants : palette `creme`/`stone`/`encre`, fonts Cormorant
  Garamond / Inter / Pinyon Script.
- Composants UI réutilisés : `Tag`, `Badge`, `Button` du design système.
- Modale : `Drawer` (slide right), keyboard `Esc` ferme.
- Couleurs sémantiques : binding actif = `emerald-100`, binding vide =
  `stone-100`, conflit = `rose-100`.

## Accessibilité

- Toutes les modales ont `role="dialog"`, `aria-labelledby`, focus trap.
- Toggle binding active/inactive : `aria-pressed`.
- Picker média : navigation clavier ↑↓→← entre vignettes, `Enter` pour
  confirmer.
- Preview animation : bouton "Pause" pour les utilisateurs reduced-motion.
- Tableaux respectent `<th scope="col">`, captions cachés visuellement.

## Mobile (≤ 640)

- Liste : grid 1 col.
- Détail : tabs verticales (Slots | Animations | Aperçu).
- Picker : full-screen drawer.
