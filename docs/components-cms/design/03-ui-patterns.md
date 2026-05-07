# D3 — Patterns d'éditeur et flow de save

## Cadrage

Ce document décrit **comment** l'admin présente et manipule chaque
type de champ (`FieldType` cf. A2). Il fixe les patterns d'interface,
le flow de sauvegarde, et les modales de publication / conflit / diff.

Contrainte : **un éditeur par type** (cf. A1 § D5). Pas de
fallback générique. Pas de RHF (cf. A1 § D6) : useReducer + custom
hooks. Cf. F1 pour le registry technique et F3 pour le form-engine.

## Structure commune d'un éditeur

Chaque éditeur partage la même *forme* extérieure (cf. D2 § Hiérarchie
d'un champ) :

```
┌──────────────────────────────────────────────────────────────────┐
│ <Label> <kbd>cle</kbd>                              <StatusBadge>│
│                                                                   │
│ <BodyEditor — propre au type>                                    │
│                                                                   │
│ <Description>                       [Historique]  [Restaurer ▾]  │
└──────────────────────────────────────────────────────────────────┘
```

Props communes (cf. F1) :

```ts
interface FieldEditorProps<T> {
  fieldDef: ComponentFieldDefinition;
  value: T;
  defaultValue: T | undefined;
  onChange: (next: T) => void;     // local, déclenche le debouncer
  status: FieldStatus;              // 'pristine' | 'dirty' | 'saving' | 'saved' | 'error'
  error?: ValidationError;
  describedById?: string;           // pour aria-describedby
}
```

L'éditeur **ne sait rien** du transport (REST, MSW). Il appelle
`onChange` sur chaque mutation locale ; le form-engine F3 fait le
debounce et le PATCH.

## Patterns par type

### TextEditor — `text`

Single-line, max ~120 caractères en pratique.

```
┌─────────────────────────────────────────────────────┐
│ Le rituel du soir, en cinq minutes.            42/120│
└─────────────────────────────────────────────────────┘
```

- `<input type="text">` natif, sans contrôle custom.
- Compteur **discret** en bas-droite, vire `petale-dark` à 90 % de la
  limite, rouge si dépassé (validation Zod).
- Touche **Enter** : *blur* (pas de submit, pas de retour ligne).
- `placeholder` = `field.config.placeholder`.

### MultilineEditor — `multiline`

Multi-ligne sans formatage.

```
┌─────────────────────────────────────────────────────┐
│ Une routine douce,                                   │
│ pensée pour les peaux pressées et fatiguées.         │
│                                                       │
│                                              82/500 │
└─────────────────────────────────────────────────────┘
```

- `<textarea>` natif, hauteur auto (`field-sizing: content` ou
  fallback JS).
- Reste 5-10 lignes max visible avant scroll interne.
- Le compteur suit la même règle que `TextEditor`.
- **Pas de Markdown** ici : c'est `rich-text` qui s'en charge.

### RichTextEditor — `rich-text`

Markdown sanitizé. **Pas de WYSIWYG** : on affiche **les balises
Markdown** dans la zone d'édition (mode source) avec barre d'outils
qui les insère, et un **toggle Aperçu** qui affiche le rendu.

```
┌─────────────────────────────────────────────────────┐
│ [B] [I] [H2] [Lien] [Liste] [Citation]    Aperçu ▢ │
├─────────────────────────────────────────────────────┤
│                                                       │
│ ## Notre routine                                      │
│                                                       │
│ Un **rituel doux**, pensé pour les soirs courts.     │
│                                                       │
│ - étape 1                                             │
│ - étape 2                                             │
│                                                       │
│                                          1 245/5 000 │
└─────────────────────────────────────────────────────┘
```

- Source Markdown pure (cf. P6 — pas de magie).
- Barre d'outils insère du Markdown au curseur ; raccourcis
  `Cmd+B`, `Cmd+I`, `Cmd+K` pour le lien.
- Toggle « Aperçu » → rendu HTML sanitizé (`sanitize-html` selon
  `config.allowedTags` et `config.allowedHrefSchemes`).
- Indicateur de **sanitization appliquée** : si le serveur a retiré du
  contenu, un bandeau `petale-soft` l'indique au prochain save.
- a11y : `aria-multiline="true"`, `aria-describedby` pour les
  raccourcis (cf. D5).

### CtaEditor — `cta`

Un *call-to-action* est `{ label, href, variant?, icon? }`.

```
┌─────────────────────────────────────────────────────┐
│ Libellé                                              │
│ ┌──────────────────────────────────────────────────┐│
│ │ Découvrir le rituel                              ││
│ └──────────────────────────────────────────────────┘│
│                                                       │
│ Lien (href)                                          │
│ ┌──────────────────────────────────────────────────┐│
│ │ /rituel                                          ││
│ └──────────────────────────────────────────────────┘│
│ ✓ Lien interne reconnu                                │
│                                                       │
│ Variante                                             │
│ ( ) Primary  (•) Secondary  ( ) Ghost  ( ) Inline    │
│                                                       │
│ Icône (facultative)                                  │
│ ┌──────────────────────────────────────────────────┐│
│ │ [→ arrow-right]                       [Effacer] ││
│ └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

- 4 sous-champs **toujours visibles** (P6).
- `href` : validation live « lien interne / externe / mailto / tel ».
- `variant` : radio groupe parmi `field.config.variants`.
- `icon` : ouvre `IconPicker` (popover, cf. ci-dessous), bouton
  *Effacer* pour passer à `undefined`.
- Mini-preview du bouton réel **sous** le formulaire :

```
┌─────────────────────────────────────────────────────┐
│ Aperçu du bouton                                     │
│   ┌────────────────────────────┐                    │
│   │ Découvrir le rituel    →   │  (variant=secondary)│
│   └────────────────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

### LinkEditor — `link`

Sous-ensemble de `cta` : `{ href, label?, external? }`.

```
┌─────────────────────────────────────────────────────┐
│ Lien (href)                                          │
│ [─────────────────────────────────────────────]      │
│                                                       │
│ Libellé visible (facultatif)                         │
│ [─────────────────────────────────────────────]      │
│                                                       │
│ ☐ Ouvrir dans un nouvel onglet (external)            │
└─────────────────────────────────────────────────────┘
```

### IconEditor — `icon`

Picker recherchable parmi le registre d'icônes
(`field.config.iconRegistry`, ex `lucide` ou `femiglow-curated`).

```
┌─────────────────────────────────────────────────────┐
│ [icon: sun]                            [Changer ▾]   │
└─────────────────────────────────────────────────────┘
```

Au clic *Changer* :

```
┌─ Choisir une icône ─────────────────────────────────┐
│ [🔍 Recherche…]                                      │
│                                                       │
│ ☼  ✦  →  ←  ✓  ✗  ❤  ★                              │
│ sun  star arrow-…                                     │
│                                                       │
│                                       [Annuler] [OK] │
└──────────────────────────────────────────────────────┘
```

- Popover (pas modale plein écran).
- Recherche **substring** sur les *aliases* du registre.
- 8 colonnes desktop / 4 mobile.
- Touche `Escape` ferme sans sauver.
- a11y : focus-trap, `role="dialog"`, label ARIA (cf. D5).

### ColorTokenEditor — `color-token`

Restreint aux tokens FemiGlow (`creme`, `creme-warm`, `champagne`,
`champagne-soft`, …) selon `field.config.tokenSet`.

```
┌─────────────────────────────────────────────────────┐
│ Token de fond                                        │
│ ▣ creme    ▣ creme-warm   ▣ champagne                │
│ ▣ champagne-soft  ▣ ciel-soft  ▣ sauge-soft          │
│                                                       │
│ Token actif : champagne-soft                         │
└─────────────────────────────────────────────────────┘
```

- Swatches carrées, label **sous** le swatch (lisibilité a11y).
- Token actif souligné par anneau `encre`.
- Pas de color-picker libre (P6, P7) — le set est fini.
- Clavier : flèches → / ← / ↑ / ↓ pour naviguer, Espace pour choisir.

### EnumEditor — `enum`

Une valeur parmi `field.config.options[]`.

```
┌─────────────────────────────────────────────────────┐
│ Moment de la journée                                 │
│ ( ) Matin    (•) Soir    ( ) Nuit                    │
└─────────────────────────────────────────────────────┘
```

- Radio si ≤ 4 options.
- `<select>` natif si > 4 options.
- Touche `Tab` traverse normalement, `Espace` sélectionne.

### NumberEditor / BooleanEditor

- `number` : `<input type="number">` avec min/max/step (`field.config`),
  flèches du clavier incrémentent. Compteur d'unité optionnel
  (`field.config.unit`, ex « min »).
- `boolean` : switch label-gauche / contrôle-droite. Texte explicite
  *Activé / Désactivé* à droite (pas seulement la couleur — cf. D5).

### ListEditor — `list`

Tableau ordonné de l'`itemType`. **Réordonnable**, **non éclaté en
sous-écran** (cf. D2).

```
┌─────────────────────────────────────────────────────┐
│ Bénéfices  (3 / max 5)                               │
│                                                       │
│ ⠿  [item 1 — record editor inline                ] ✕ │
│ ⠿  [item 2 — record editor inline                ] ✕ │
│ ⠿  [item 3 — record editor inline                ] ✕ │
│                                                       │
│ [+ Ajouter un bénéfice]                              │
└─────────────────────────────────────────────────────┘
```

- Poignée `⠿` à gauche (drag) **et** boutons « monter / descendre »
  pour clavier (cf. D5).
- Croix de suppression à droite ; **soft-confirm** si l'item contient
  du contenu non vide (small inline confirm, pas modale).
- Bouton « Ajouter » désactivé à `maxItems`.
- Validation Zod sur `minItems`/`maxItems` au save.
- Réorder déclenche un PATCH (la position est sérialisée dans la
  valeur jsonb : `{ items: [...] }`).

### RecordEditor — `record`

Sous-objet typé. Affiche ses sous-champs **inline**, indenté.

```
┌─────────────────────────────────────────────────────┐
│ Citation client                                      │
│  │  Texte                                            │
│  │  [textarea ─────────────────────────────────]    │
│  │                                                    │
│  │  Auteur                                           │
│  │  [text ─────────────────────────────────────]    │
└─────────────────────────────────────────────────────┘
```

- Indentation = `pl-6 border-l-2 border-encre-soft`.
- Chaque sous-champ utilise son propre éditeur (composition).
- Pas de label « group » entre — la zone elle-même est le group.

### Patterns dérivés (`kicker`, `quote`, `breadcrumb-segment`)

| Type | Implémentation |
|---|---|
| `kicker` | `TextEditor` avec préview en uppercase + letter-spacing (la valeur stockée reste casse normale). |
| `quote` | `RecordEditor` figé sur `{ text: multiline, author: text }`. |
| `breadcrumb-segment` | `RecordEditor` figé sur `{ label: text, href: link }`. |

Ces alias héritent du label/description du registre, mais pas
d'éditeur custom — ils composent les éditeurs primitifs.

## Status badges

Affiché dans le coin supérieur droit de chaque champ.

| Statut | Texte | Pastille | Token |
|---|---|---|---|
| `published` (à jour) | « Publié » | ●  | `sauge-soft` fond, `encre` texte |
| `draft` (en cours) | « Brouillon » | ◐ | `champagne-soft` fond, `encre` texte |
| `scheduled` | « Programmé · 15 mars 08:00 » | ◷ | `ciel-soft` fond, `encre` texte |
| `conflict` | « Conflit » | ⚠ | `petale-soft` fond, `petale-dark` texte |
| `default-fallback` | « Valeur par défaut » | ○ | `encre-soft` texte sur `creme-warm` |

- Tooltip au hover : date relative + auteur (« publié il y a 3 jours
  par Salma »).
- `role="status"` pour lecteurs d'écran (cf. D5).
- Pas d'animation au changement, sauf `transition: bg 200ms`.

## Save flow

Cf. principe P5 (D1) et A4 § Auto-save.

```
[user tape]
    │ onChange local (optimiste)
    ▼
[reducer met à jour state local]  ◄── statut champ → 'dirty'
    │
    │ debounce 800ms (par champ)
    ▼
[PATCH /api/admin/components/[key]/fields/[fieldKey]]
    │
    ├── 200 OK    ───► statut champ → 'saved'  + check inline éphémère 1 s
    ├── 4xx       ───► statut champ → 'error'  + message inline + retry
    └── 5xx/retry ───► retry ×3 (200/600/1500 ms backoff)
```

### Indicateur global `<SaveIndicator>`

Top-right de l'écran, **persistant** :

```
○  Tout est enregistré         (état idle)
●  Enregistrement…             (≥ 1 champ saving, animation pulse douce)
✓  Enregistré il y a 2 s        (success transitoire 4 s)
⚠  Erreur de sauvegarde — Réessayer  (1 champ en error)
```

- Texte ARIA-live `polite`.
- En cas d'erreur, **aucun champ ne perd sa valeur locale** (P4).
- Le bouton *Réessayer* relance les PATCH en attente.

### Dirty state au niveau page

Le header **épingle** un compteur si ≥ 1 champ a un draft non publié :

```
┌──────────────────────────────────────────────────────────┐
│ ← Composants  home-hero · 3 brouillons   ✓  [Publier ▾] │
└──────────────────────────────────────────────────────────┘
```

- Cliquer le compteur **filtre l'onglet Champs** sur les champs en
  brouillon (ouvre les accordéons concernés).

## Action « Publier »

Bouton menu en header. Trois choix :

| Choix | Effet |
|---|---|
| Publier maintenant | Modale de confirmation avec diff (cf. ci-dessous) |
| Programmer… | Popover de schedule (D6 § wireframe) |
| Annuler les brouillons | Modale de confirmation, supprime les drafts (rôle = `archive` sur drafts) |

### Modale « Publier maintenant »

```
┌─ Publier les modifications · home-hero ──────────────────────────┐
│                                                                    │
│ 3 champs vont être publiés :                                       │
│                                                                    │
│ • Titre                  [Voir le diff]                            │
│ • CTA principal          [Voir le diff]                            │
│ • Liste de bénéfices     [Voir le diff]                            │
│                                                                    │
│ ☐ Programmer plutôt à une date                                     │
│                                                                    │
│ Note (interne, facultative)                                        │
│ [─────────────────────────────────────────────────────────]        │
│                                                                    │
│                                  [Annuler]   [Publier 3 champs]    │
└────────────────────────────────────────────────────────────────────┘
```

- Liste **ordonnée** comme dans l'écran d'édition.
- Clic « Voir le diff » ouvre le diff modal (cf. ci-dessous), inline-stack.
- Note → stockée dans `componentFieldHistory.notes`.
- Bouton primaire bloqué tant qu'au moins un champ est en `error`.
- Confirmation par **Cmd+Enter** ; Echap ferme.
- a11y : focus-trap, focus initial sur bouton primaire (cf. D5).

## Diff modal

Affiche le **avant / après** d'un seul champ ou de tous les champs
publiés en attente.

```
┌─ Diff · Titre ───────────────────────────────────────────────────┐
│                                                                    │
│  Avant (publié, v3)                Après (brouillon)               │
│  ─────────────────────             ─────────────────────           │
│  Le rituel du soir.                Le rituel du soir,              │
│                                    en cinq minutes.                │
│                                                                    │
│  Modifié il y a 5 min · Salma                                     │
│                                                                    │
│                                              [Fermer]              │
└────────────────────────────────────────────────────────────────────┘
```

- Side-by-side desktop, stack mobile.
- Pour `text`/`multiline`/`rich-text` : diff caractère/ligne (lib légère).
- Pour `cta`/`record` : table champ-par-champ (Avant / Après / Δ).
- Pour `list` : items réordonnés/ajoutés/retirés (avec badges +/-/↕).
- Pas d'édition depuis ce modal (P7) — c'est de la **lecture**.

## Modale de conflit (E1, A4)

Quand le PATCH revient **409** (un autre admin a modifié le draft) :

```
┌─ Conflit de version · home-hero · Titre ─────────────────────────┐
│                                                                    │
│ Un·e autre admin (Salma) a modifié ce champ il y a 2 minutes.     │
│                                                                    │
│ Votre version (locale)                Version actuelle (serveur)   │
│ ─────────────────────                 ─────────────────────        │
│ Le rituel du soir,                    Le rituel apaisant           │
│ en cinq minutes.                      du soir.                     │
│                                                                    │
│ Que souhaitez-vous faire ?                                         │
│                                                                    │
│  [Reprendre la version serveur]  [Garder ma version (écrase)]      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

- *Reprendre* recharge depuis le serveur, perd les modifs locales (P4
  → on les sauvegarde en `localStorage` pour restauration manuelle).
- *Garder* renvoie un PATCH avec `If-Match` mis à jour (cf. A3 EC6).
- Pas d'option « merge auto » en v1.

## Schedule popover

Ouvert depuis *Publier ▾ → Programmer*.

```
┌─ Programmer la publication ──────────────────┐
│                                                │
│ Date     [ 15/03/2026 ]                       │
│ Heure    [ 08:00      ]   (Europe/Paris)      │
│                                                │
│ Soit dans 4 jours, 12 heures.                  │
│                                                │
│ ☐ Annuler le programme existant                │
│                                                │
│            [Annuler]   [Programmer]            │
└────────────────────────────────────────────────┘
```

- Validation : `scheduledAt > now() + 1 minute` (cf. A4 E3).
- Date / heure en **fuseau utilisateur** (cf. A3 EC8), serveur reçoit
  l'ISO UTC.
- Affiche la durée relative pour confirmation visuelle.

## Récapitulatif des patterns

| FieldType | Composant | Inline | Sous-écran |
|---|---|---|---|
| text | TextEditor | ✅ | — |
| multiline | MultilineEditor | ✅ | — |
| rich-text | RichTextEditor | ✅ | — |
| cta | CtaEditor | ✅ | — |
| link | LinkEditor | ✅ | — |
| icon | IconEditor + IconPicker (popover) | ✅ | popover |
| color-token | ColorTokenEditor | ✅ | — |
| number | NumberEditor | ✅ | — |
| boolean | BooleanEditor | ✅ | — |
| enum | EnumEditor | ✅ | — |
| list | ListEditor | ✅ | — |
| record | RecordEditor | ✅ | — |
| kicker | TextEditor (alias) | ✅ | — |
| quote | RecordEditor figé | ✅ | — |
| breadcrumb-segment | RecordEditor figé | ✅ | — |

**Aucun éditeur ne ferme l'écran courant**, conformément à P7.

## Croisements

| Pattern | Source / contrainte |
|---|---|
| Save optimiste | A1 D6, A4, P5 |
| Modale publier avec diff | A4 transitions |
| Modale conflit | A3 EC6, A4 E1 |
| Schedule popover | A4 § Scheduling, EC8 |
| Status badges | A4 § Statuts |
| Editor par type | A1 D5, F1 |
