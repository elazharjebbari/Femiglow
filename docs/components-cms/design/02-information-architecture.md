# D2 — Architecture de l'information

## Modèle mental

L'admin Components-CMS s'inscrit dans la hiérarchie suivante,
**héritée du système Component-Media** (cf. A1 § D1) et étendue
pour les champs :

```
Site
└── Page-group         (ex « Maison », « Journal », « Rituel »)
    └── Page            (ex « / », « /journal/[slug] »)
        └── Composant   (ex `home-hero`, `journal-article`)
            ├── Champs        ◄── nouveau (titres, CTA, etc.)
            ├── Médias        (existant)
            └── Animations    (existant)
```

Le composant est le **point d'ancrage** unique : c'est l'écran où la
fondatrice passe son temps. Tout ce qui le concerne (champs, médias,
animations, preview) y est rassemblé, jamais éclaté ailleurs (cf. P7).

## Niveaux de navigation

### N1 — Liste des composants

Route : `/admin/components`

Vue **plate** des composants du registre, regroupés par `pageGroup`.
Chaque ligne affiche :

- nom du composant (`label`),
- clé technique en monospace (`key`),
- compteur **« n champs en brouillon »** s'il y en a,
- compteur **« n programmés »** s'il y en a,
- date de dernière publication relative.

C'est l'écran de **scan rapide** : « qu'est-ce qui m'attend ? ».

### N2 — Édition d'un composant

Route : `/admin/components/[key]`

Écran principal. Quatre **onglets** (cf. § Onglets ci-dessous) :

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Composants     home-hero — Hero d'accueil          [Publier ▾]  │
│                                                                      │
│  [ Champs ]  [ Médias ]  [ Animations ]  [ Aperçu ]                  │
│  ─────────                                                            │
│                                                                      │
│  (panneau de l'onglet actif)                                         │
└────────────────────────────────────────────────────────────────────┘
```

L'onglet **Champs** est nouveau (Components-CMS). Les onglets Médias
et Animations sont les surfaces existantes (`ComponentDetailPanel`,
`AnimationProfileSelector`) inchangées.

### N3 — Onglet Champs (zoom)

L'onglet *Champs* présente une **liste verticale** de champs groupés
par `field.group`. Chaque groupe est un accordéon, ouvert par
défaut au premier chargement, repliable individuellement.

```
┌─ Champs ──────────────────────────────────────────────────────────┐
│                                                                     │
│  ▾ Hero                                                              │
│      Titre              [editor]                       [statut]      │
│      Sous-titre         [editor]                       [statut]      │
│      Kicker             [editor]                       [statut]      │
│                                                                     │
│  ▾ CTA                                                               │
│      Bouton principal   [editor]                       [statut]      │
│                                                                     │
│  ▸ Réassurance                                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

L'utilisateur **n'a jamais** à scroller au-delà d'un composant pour
trouver tous ses champs. L'accordéon est un repli visuel, pas une
navigation : tous les champs sont DOM-présents (pour `Cmd+F`, lecteurs
d'écran, axe-core).

## Onglets

| Onglet | Contenu | Source | Doc |
|---|---|---|---|
| Champs | Tous les `ComponentFieldDefinition` du composant | Registry + bindings | F1, F3 |
| Médias | Slots du composant et leurs assignations | `componentMediaBindings` (existant) | (existant) |
| Animations | Profils animation appliqués | `componentAnimationBindings` (existant) | (existant) |
| Aperçu | iframe RSC servant le draft (et un toggle « publié ») | route `/admin/components/[key]/preview` | F4 |

### Règles de navigation entre onglets

1. Le changement d'onglet **ne perd pas** un draft non publié — chaque
   onglet est état-isolé, le panneau Champs garde son state.
2. Le badge global de l'écran (haut de page) **agrège** les indicateurs
   de tous les onglets : `2 champs en brouillon · 1 média non assigné`.
3. L'URL contient l'onglet actif : `/admin/components/home-hero?tab=fields`.
   Permet aux liens de pointer directement.

## Navigation latérale (left rail)

Sur l'écran d'édition d'un composant, un **rail gauche** expose la
liste des composants frères du même `pageGroup`, avec leurs
indicateurs. L'admin peut sauter d'un composant à l'autre sans
repasser par la liste globale.

```
┌────────────┬──────────────────────────────────────────────────────┐
│  Maison    │  home-hero — Hero d'accueil          [Publier ▾]      │
│ ──────────  │                                                       │
│ ▸ home-hero│  [ Champs ]  [ Médias ]  [ Animations ]  [ Aperçu ]   │
│   home-…   │                                                        │
│   home-…   │   …                                                    │
│   home-…   │                                                        │
└────────────┴──────────────────────────────────────────────────────┘
```

- Chaque entrée porte le même mini-badge que la liste N1.
- L'entrée active est en **`encre` plein** sur fond `creme-warm`.
- Le rail est **collapsible** (icône `<<`), persisté en localStorage.
- En mobile (≤ 768 px), le rail devient un Sheet (drawer) accessible
  par un bouton hamburger.

## Hiérarchie d'un champ

Au sein de l'onglet Champs, un champ est une **unité atomique**
composée de quatre zones :

```
┌──────────────────────────────────────────────────────────────────┐
│ Label             Type          Statut                           │
│ ───────────────────────────────────────────────────────────────  │
│                                                                   │
│ [   editor (selon type, cf. D3)                              ]    │
│                                                                   │
│ Description (help text)              [Historique] [Restaurer]    │
└──────────────────────────────────────────────────────────────────┘
```

| Zone | Rôle |
|---|---|
| Label | Nom humain (`field.label`) |
| Type | Pictogramme + nom (cf. D4 typographie monospace pour le `key`) |
| Statut | Badge `published` / `draft` / `scheduled` / `conflict` |
| Editor | Composant éditeur du type (D3) |
| Description | Help text (`field.description`) — facultatif |
| Actions | Liens secondaires : voir l'historique, restaurer une version |

Les **modes spéciaux** (édition d'un `list` ou d'un `record`) ouvrent
des **sections imbriquées** qui restent dans le flux vertical (pas
de modale). Cf. D3 § ListEditor.

## Hiérarchie des actions globales

Quatre actions vivent en **header de page** :

```
┌────────────────────────────────────────────────────────────────┐
│  ← Composants     home-hero          [Aperçu]  [Publier ▾]      │
└────────────────────────────────────────────────────────────────┘
```

| Action | Type | Disponibilité |
|---|---|---|
| ← Composants | lien | toujours |
| `<SaveIndicator>` | passif | toujours visible (cf. D3) |
| Aperçu | bouton secondaire | ouvre la preview en split-view |
| Publier ▾ | menu | toujours, options : *Publier maintenant*, *Programmer*, *Annuler les brouillons* |

Le menu *Publier* est **scopé au composant** : il publie tous les
drafts du composant en une transaction (cf. A4). Pas de publication
multi-composants en v1 (out-of-scope).

## Stratégie de groupement (`field.group`)

Le champ `group` du registre détermine l'accordéon de regroupement.
Conventions :

- **Petit composant (≤ 4 champs)** : pas de `group` → un seul groupe
  *« Champs »*, accordéon plat (toujours déplié).
- **Composant moyen (5 — 10 champs)** : 2-3 groupes (*Hero*, *CTA*,
  *Réassurance*).
- **Composant complexe (`record` profond, `list` imbriqué)** :
  3+ groupes, accordéons collapsés sauf le premier.

L'ordre des groupes suit l'**ordre d'apparition** dans le registre,
modulo `field.order`. Pas d'ordre alphabétique, pas de drag-and-drop
(P6, P7).

## Stratégie pour les listes (`list`) et records (`record`)

### List

Une `list` n'éclate pas en accordéon : elle reste **dans son champ**
sous forme d'un `ListEditor` (cf. D3). Les items sont affichés en
ligne, avec poignée de réordonnancement à gauche, bouton suppression
à droite, bouton « Ajouter » en bas.

Pour une liste de `record` (ex : 3 cartes de réassurance), chaque
item est un mini-formulaire, mais **toujours dans le flux vertical**
du champ parent. On ne navigue jamais à un sous-écran.

### Record

Un `record` éclate ses sous-champs **dans le même champ**, en
indentation visuelle légère (`pl-6 border-l border-encre-soft`). Les
sous-champs ont accès aux mêmes éditeurs typés. Pas de modale.

## Recherche et filtrage

L'admin propose une **barre de recherche globale** en N1 (liste des
composants) :

- recherche par `label`, `key`, ou contenu textuel d'un binding
  publié (champ texte / multiline / rich-text) ;
- filtres **sticky** : `pageGroup`, statut (`a des drafts`,
  `a un schedule`, `en conflit`).

Pas de recherche **dans** un composant : avec ≤ 20 champs en
moyenne, le scan visuel suffit (P1, P7).

## Breadcrumb

```
Admin · Composants · Maison · home-hero · Champs
```

- Cliquable jusqu'au niveau N-1.
- Le dernier segment (onglet) reflète l'onglet actif.
- En mobile, on tronque en *« … · home-hero · Champs »*.

## Mobile

L'admin **est utilisable en mobile** mais n'est pas optimisé pour la
saisie longue (rich-text, list de 10 items). Adaptations :

- Rail gauche → Sheet drawer.
- Onglets restent horizontaux mais scrollables.
- Editors plein-largeur, sans label-à-côté (label au-dessus).
- Le bouton « Publier » reste en header **collant** (sticky top).

## Croisements

| Choix IA | Source / contrainte |
|---|---|
| Onglet Champs nouveau | A1, A2 |
| Liste plate par pageGroup | Existant Component-Media |
| Iframe Aperçu | A3 § draft, F4 |
| Menu Publier scope-composant | A4 transitions |
| `field.group` ordonne accordéons | A2 |
| Pas de page séparée pour list/record | P7 (D1) |
