# D6 — Wireframes

## Cadrage

Wireframes ASCII des **six écrans / sous-éléments** clés. Ils sont
intentionnellement basse-fidélité : leur rôle est de fixer le **layout
et la hiérarchie visuelle**, pas le rendu pixel.

Chaque wireframe respecte les règles de D2 (IA), D3 (patterns), D4
(style) et D5 (a11y). Les tokens et tailles évoqués sont indicatifs.

## W1 — Page d'édition d'un composant (vue Champs)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Admin · Composants · Maison · home-hero · Champs           [Aperçu]  [Publier ▾]  │
├──────────┬───────────────────────────────────────────────────────────────────────┤
│  Maison  │  home-hero — Hero d'accueil                       ✓ Tout est enregistré │
│ ──────── │  Composé de 8 champs · 3 brouillons · 0 programmés                     │
│ ▸ home-  │                                                                          │
│   hero ●3│  ┌─ [ Champs ] [ Médias ]  [ Animations ]  [ Aperçu ] ──────────────┐  │
│   home-  │  │ ─────────                                                          │  │
│   avis   │  │                                                                     │  │
│   home-  │  │  ▾ Hero                                                             │  │
│   intro  │  │     ┌────────────────────────────────────────────────────────────┐ │  │
│   home-  │  │     │ Titre                       text   [Publié]                │ │  │
│   …      │  │     │ ────────────────────────────────────────────────────────── │ │  │
│          │  │     │ Le rituel du soir, en cinq minutes.                42/120 │ │  │
│  Journal │  │     │ Titre principal du hero d'accueil    [Historique]          │ │  │
│   journal│  │     └────────────────────────────────────────────────────────────┘ │  │
│   journal│  │                                                                     │  │
│   …      │  │     ┌────────────────────────────────────────────────────────────┐ │  │
│          │  │     │▌Sous-titre                  multiline  [Brouillon]         │ │  │
│  Rituel  │  │     │ ────────────────────────────────────────────────────────── │ │  │
│   rituel │  │     │ Une routine douce, pensée pour les peaux pressées          │ │  │
│   …      │  │     │ et fatiguées en fin de journée.                    98/500 │ │  │
│          │  │     │ Sous-titre du hero — modifié il y a 2 min                  │ │  │
│          │  │     └────────────────────────────────────────────────────────────┘ │  │
│          │  │                                                                     │  │
│          │  │     ┌────────────────────────────────────────────────────────────┐ │  │
│          │  │     │ Kicker                       kicker  [Publié]              │ │  │
│          │  │     │ Notre rituel                                          12/40 │ │  │
│          │  │     └────────────────────────────────────────────────────────────┘ │  │
│          │  │                                                                     │  │
│          │  │  ▾ CTA                                                              │  │
│          │  │     ┌────────────────────────────────────────────────────────────┐ │  │
│          │  │     │▌Bouton principal             cta     [Brouillon]           │ │  │
│          │  │     │ Libellé   [Découvrir le rituel                          ]  │ │  │
│          │  │     │ Lien      [/rituel                                      ]  │ │  │
│          │  │     │ Variante  ( ) primary  (•) secondary  ( ) ghost            │ │  │
│          │  │     │ Icône     [→ arrow-right]                      [Effacer]   │ │  │
│          │  │     │ Aperçu : ┌──────────────────────────┐                       │ │  │
│          │  │     │          │ Découvrir le rituel  →   │                       │ │  │
│          │  │     │          └──────────────────────────┘                       │ │  │
│          │  │     └────────────────────────────────────────────────────────────┘ │  │
│          │  │                                                                     │  │
│          │  │  ▸ Réassurance                                          (3 champs)  │  │
│          │  │  ▸ SEO                                                  (2 champs)  │  │
│          │  └─────────────────────────────────────────────────────────────────────┘  │
└──────────┴───────────────────────────────────────────────────────────────────────┘

Légende :
  ▾ accordéon ouvert      ▸ accordéon fermé
  ▌  bordure gauche dirty (champagne)
  ●3 compteur de drafts dans le rail
```

**Notes :**
- Header sticky 56 px, fond `creme/95` blur léger.
- Rail gauche 240 px, fond `creme-warm/40`, item actif fond `creme-warm` plein.
- Onglets en sous-header — `aria-selected="true"` sur Champs.
- Indicateur de save à droite du sous-titre (compteur de drafts).
- Chaque carte de champ (`field-card`) suit D4.

## W2 — Onglet Champs avec accordéons groupés (zoom)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ─────────                                                                    │
│  ▾ Hero                                                  3 champs · 1 draft  │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│   Titre                                                            [Publié]  │
│   [────────────────────────────────────────────────────────]                │
│   Description courte du champ.                       [Historique]            │
│                                                                              │
│   Sous-titre                                                  [Brouillon]    │
│   [────────────────────────────────────────────────────────]                │
│   Description courte du champ.                       [Historique]            │
│                                                                              │
│   Kicker                                                          [Publié]   │
│   [────────────────────────────────────────────────────────]                │
│                                                                              │
│  ▸ CTA                                                  1 champ · 1 draft    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  ▸ Réassurance                                          3 champs · 0 draft   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  ▸ SEO                                                  2 champs · 1 draft   │
│  ─────────────────────────────────────────────────────────────────────────  │
└────────────────────────────────────────────────────────────────────────────┘

Header d'accordéon :
  - role="button" aria-expanded
  - clic ou Espace/Enter pour toggle
  - chevron à gauche, label au centre, compteur à droite
  - hover bg-creme-warm/60
```

**Notes :**
- Tous les groupes sont **DOM-présents** même fermés (cf. D5) — la
  fermeture est purement visuelle (`grid-template-rows`).
- L'ordre des groupes suit le registre TS (cf. D2).
- Compteur droit avec virgule oxford : « 3 champs · 1 brouillon ».

## W3 — Détail d'un éditeur Cta (zoom)

```
┌─ Bouton principal ─────────────────────────  cta  ─  [Brouillon ◐] ─┐
│                                                                       │
│  Libellé                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Découvrir le rituel                                       19/60 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Lien (href)                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ /rituel                                                         │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ✓ Lien interne reconnu                                                │
│                                                                       │
│  Variante                                                             │
│  ( ) primary    (•) secondary    ( ) ghost    ( ) inline               │
│                                                                       │
│  Icône (facultative)                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  → arrow-right                              [Changer]  [Effacer]│ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Aperçu du bouton                                                     │
│  ┌──────────────────────────────────────┐                             │
│  │ Découvrir le rituel              →   │  variant=secondary           │
│  └──────────────────────────────────────┘                             │
│                                                                       │
│  Description : CTA principal du hero. Doit pointer une page interne.  │
│                                                                       │
│  ─────────────────────────────────────────────────────────────────── │
│                  [Voir l'historique ▾]                [Restaurer ▾]   │
└───────────────────────────────────────────────────────────────────────┘

États du champ (bordure gauche) :
  ┌─                ┌▌                ┌╳
  │ pristine        │ dirty           │ error
  └─                └▌                └╳
```

**Notes :**
- Tous les sous-champs **toujours visibles** (P6).
- Aperçu live : `role="status"` (cf. D5) — le label vocalisé
  change quand l'admin tape.
- Liens secondaires en bas, séparés par `divider-soft`.
- En mobile, les champs `Libellé` / `Lien` empilent ; les radios
  *Variante* passent en colonne.

## W4 — Modale « Publier les modifications »

```
                 ┌─ Publier les modifications · home-hero ──────────────────────┐
                 │                                                                 │
                 │  Vous êtes sur le point de publier 3 champs du composant       │
                 │  home-hero. La nouvelle version sera live immédiatement.       │
                 │                                                                 │
                 │  ┌────────────────────────────────────────────────────────┐   │
                 │  │ • Titre                          v3 → v4               │   │
                 │  │   Le rituel du soir → Le rituel du soir, en cinq min…   │   │
                 │  │                                            [Voir le diff] │   │
                 │  │ ─────────────────────────────────────────────────────  │   │
                 │  │ • Bouton principal               v1 → v2               │   │
                 │  │   secondary → secondary · libellé modifié              │   │
                 │  │                                            [Voir le diff] │   │
                 │  │ ─────────────────────────────────────────────────────  │   │
                 │  │ • Liste de bénéfices             v2 → v3               │   │
                 │  │   3 items → 4 items (+1)                                │   │
                 │  │                                            [Voir le diff] │   │
                 │  └────────────────────────────────────────────────────────┘   │
                 │                                                                 │
                 │  ☐ Programmer plutôt cette publication                          │
                 │                                                                 │
                 │  Note interne (facultative)                                     │
                 │  ┌────────────────────────────────────────────────────────┐   │
                 │  │ Mise à jour du visuel printemps                         │   │
                 │  └────────────────────────────────────────────────────────┘   │
                 │                                                                 │
                 │ ──────────────────────────────────────────────────────────────  │
                 │                              [Annuler]   [Publier 3 champs]   │
                 └─────────────────────────────────────────────────────────────────┘

  Overlay : encre/40
  Conteneur : creme, max-w 640, shadow-md, sans border-radius
  Focus initial : « Publier 3 champs »  (cf. D5)
  Cmd+Enter valide ; Esc annule
```

**Notes :**
- La modale liste les diffs **inline** (résumés) ; cliquer sur « Voir
  le diff » ouvre le modal détaillé W5 (stack).
- Si la case « Programmer » est cochée, la zone se remplace par le
  popover Schedule (W6) intégré.
- Le bouton primaire reste désactivé tant qu'un draft est en `error`.

## W5 — Modale Diff (détail d'un champ)

```
              ┌─ Diff · Bouton principal · home-hero ──────────────────────────┐
              │                                                                  │
              │   Avant — publié, v1                Après — brouillon, v2 prévu │
              │  ──────────────────────────────    ────────────────────────────│
              │   {                                  {                          │
              │     "label": "En savoir plus",        "label": "Découvrir le ri-│
              │                                                tuel",            │
              │     "href": "/rituel",                "href": "/rituel",         │
              │     "variant": "primary",      ⮕     "variant": "secondary",   │
              │     "icon": null               ⮕     "icon": "arrow-right"     │
              │   }                                  }                          │
              │                                                                  │
              │   Modifié il y a 5 min · Salma                                   │
              │                                                                  │
              │  ──────────────────────────────────────────────────────────────  │
              │                                                       [Fermer]    │
              └──────────────────────────────────────────────────────────────────┘

  Conteneur 720 px desktop ; stack vertical en mobile.
  Lignes modifiées : flèche ⮕ et fond petale-soft/40 sur la ligne.
  Aucun bouton "publier" depuis le diff (lecture seule, P7).
```

**Notes :**
- Pour `text` / `multiline` / `rich-text`, on affiche un diff
  caractère/ligne (ajouts en `sauge-soft`, retraits en `petale-soft`).
- Pour `cta` / `record`, on affiche le JSON aplati avec annotation par
  champ.
- Pour `list`, on affiche les items avec `+` / `-` / `↕`.

## W6 — Popover « Programmer la publication »

```
                          [Publier ▾] ◀── menu déclencheur
                          │
                          │  ┌─ Programmer la publication ─────────────────┐
                          │  │                                                │
                          │  │  Date                                          │
                          │  │  ┌────────────────────────────────────┐       │
                          └─►│  │ 15 / 03 / 2026                     │       │
                             │  └────────────────────────────────────┘       │
                             │                                                │
                             │  Heure                          (Europe/Paris) │
                             │  ┌────────────────────────────────────┐       │
                             │  │ 08 : 00                            │       │
                             │  └────────────────────────────────────┘       │
                             │                                                │
                             │  Soit dans 4 jours, 12 heures.                 │
                             │                                                │
                             │  ☐ Annuler le programme existant si présent    │
                             │                                                │
                             │  ──────────────────────────────────────────── │
                             │              [Annuler]   [Programmer]         │
                             └────────────────────────────────────────────────┘

  Popover 360 px, attaché au bouton.
  Pas d'overlay assombri (différencie d'une modale).
  Esc ferme ; clic dehors ferme ; Tab boucle dans le popover.
  Bouton primaire désactivé si scheduledAt < now() + 1 min (cf. A4 E3).
```

**Notes :**
- Date et heure affichées en **fuseau utilisateur** (cf. A3 EC8).
- L'aperçu *« Soit dans 4 jours, 12 heures »* se met à jour en
  `aria-live="polite"` à chaque changement.
- Si l'admin a déjà programmé un autre champ pour la même date, un
  rappel discret apparaît (« 1 autre champ programmé à cette date »).

## Vue mobile (référence rapide)

```
┌──────────────────────────────────┐
│ ☰   home-hero          [Publier▾]│
│ ✓ Tout est enregistré             │
├──────────────────────────────────┤
│ ⟨ Champs Médias Anim Aperçu ⟩    │
├──────────────────────────────────┤
│  ▾ Hero                           │
│   Titre              [Publié]    │
│   [─────────────────────────]    │
│                                   │
│   Sous-titre       [Brouillon]   │
│   [─────────────────────────]    │
│   [─────────────────────────]    │
│                                   │
│  ▸ CTA                            │
│  ▸ Réassurance                    │
└──────────────────────────────────┘

  ☰ ouvre le rail latéral en Sheet drawer.
  Onglets scrollables horizontalement.
  Editors plein-largeur, label au-dessus.
```

## Conventions de notation

| Symbole | Signification |
|---|---|
| `▾` | Accordéon ouvert |
| `▸` | Accordéon fermé |
| `▌` | Bordure gauche `dirty` (champagne) |
| `╳` | Bordure gauche `error` (petale-dark) |
| `(•)` | Radio sélectionné |
| `( )` | Radio non sélectionné |
| `☐` `☑` | Checkbox |
| `[Action]` | Bouton |
| `[─── … ───]` | Champ texte |
| `→ arrow-right` | Aperçu d'icône |
| `●3` | Badge avec compteur (3 drafts) |
| `[ ⚏ ]` | Statut « publié » plein |
| `[ ◐ ]` | Statut « brouillon » mi-rempli |
| `[ ◷ ]` | Statut « programmé » horloge |

## Croisements

| Wireframe | Doc associée |
|---|---|
| W1 — Page édition | D2, D3, D4 |
| W2 — Accordéons groupés | D2 |
| W3 — CtaEditor détaillé | D3 § Cta |
| W4 — Modale Publier | D3 § Save flow, A4 |
| W5 — Modale Diff | D3 § Diff modal |
| W6 — Popover Schedule | D3, A4 § Scheduling, A3 EC8 |
