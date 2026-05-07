# D5 — Accessibilité

## Cible

**WCAG 2.2 niveau AA** sur l'ensemble de la surface admin
Components-CMS. Vérifié automatiquement par axe-core (cible **0
violation A/AA**, cf. A1 § Qualité), et manuellement au clavier +
VoiceOver à chaque PR qui touche un éditeur.

L'accessibilité **n'est pas un sprint de fin** (P8). Tout PR ajoutant
ou modifiant un éditeur doit livrer ses tests RTL + axe en même temps
que le composant.

## Critères clés

| Critère WCAG | Application admin |
|---|---|
| 1.3.1 Info et relations | Labels `<label for>`, fieldsets pour groupes radio, listes sémantiques |
| 1.4.3 Contraste minimal | Tous textes ≥ 4.5:1, gros textes ≥ 3:1 |
| 1.4.11 Contraste non-textuel | Bordure d'input, focus ring ≥ 3:1 vs fond |
| 1.4.13 Contenu au survol/focus | Tooltips dismissible, persistant, hoverable |
| 2.1.1 Clavier | Toute action atteignable au clavier (cf. § Clavier) |
| 2.1.2 Pas de piège clavier | Modales : focus-trap **avec sortie** (Escape) |
| 2.4.3 Ordre de focus | Ordre DOM = ordre visuel |
| 2.4.7 Focus visible | Anneau `outline-2 outline-encre outline-offset-2` |
| 2.4.11 Focus non occulté | Header sticky tient compte du scroll-padding |
| 2.5.7 Drag movements (2.2) | Réordonnancement de liste : alternative non-drag (boutons monter/descendre) |
| 2.5.8 Cible (2.2) | Toutes cibles ≥ 24×24 px |
| 3.2.1 Pas de changement au focus | Aucun submit sur focus |
| 3.3.1/2 Erreurs identifiées | Erreurs en `role="alert"` + texte associé via `aria-describedby` |
| 4.1.2 Nom/rôle/valeur | Tout contrôle custom (toggle, picker) expose un rôle ARIA explicite |
| 4.1.3 Messages d'état | `<SaveIndicator>` et badges de statut en `role="status"` aria-live `polite` |

## Navigation clavier

### Ordre global d'un écran d'édition

```
1. Skip-link « Aller au contenu » (visible au focus)
2. Lien retour « ← Composants »
3. Onglets (rôle tablist, flèches gauche/droite pour changer)
4. Bouton « Aperçu »
5. Bouton « Publier ▾ »
6. SaveIndicator (focusable car interactif si erreur, non-focusable sinon)
7. Rail latéral (liste de composants frères)
8. Première carte de champ → premier sous-champ → …
```

### Raccourcis admin

| Raccourci | Action | Scope |
|---|---|---|
| `Tab` / `Shift+Tab` | navigation standard | global |
| `Cmd+S` (`Ctrl+S` Win/Linux) | force le save de tous les champs dirty (en plus du debounce auto) | écran d'édition |
| `Cmd+Enter` | confirme la modale de publish | modale Publier |
| `Esc` | ferme modale ou popover, sans valider | modales / popovers |
| `←` / `→` | change d'onglet quand le focus est sur le tablist | tablist |
| `↑` / `↓` | navigue dans une liste enum / icon picker / restore list | listes verticales |
| `Espace` | active radio/checkbox/switch | inputs |
| `Cmd+B`, `Cmd+I`, `Cmd+K` | gras / italique / lien | RichTextEditor seul |
| `Alt+↑` / `Alt+↓` | déplace l'item de liste vers le haut / le bas | ListEditor |

### Skip-link

Premier élément focusable du DOM, masqué visuellement (`sr-only`) tant
que non focus, devient visible avec un fond `creme` et un anneau focus
au focus. Cible : `#main-content`.

## Focus management

### Modales

- À l'ouverture : focus initial sur le **premier élément interactif
  utile** (souvent le bouton primaire dans la modale de confirmation).
- **Focus-trap** : `Tab` ne sort jamais du conteneur, boucle.
- À la fermeture : focus rendu à l'**élément déclencheur** (le bouton
  qui a ouvert la modale).
- `Escape` ferme et restaure le focus.

### Popovers (Schedule, IconPicker)

- Même règles que modales (trap + Escape).
- Pas d'overlay assombri (différencie du modal).
- `aria-expanded` sur le bouton déclencheur.

### Accordéons

- Header focusable (`role="button"`, `aria-expanded`, `aria-controls`).
- `Espace` / `Enter` togglent.
- Le contenu est **toujours dans le DOM** (cf. D2), seul le rendu
  visuel change. → permet à `Cmd+F` et lecteurs d'écran de tout voir.

### Champs en erreur

- À la première tentative de publish, **le focus saute** au premier
  champ en erreur.
- Le message d'erreur est associé via `aria-describedby`.
- Le bouton « Publier » de la modale est désactivé tant que des erreurs
  existent côté drafts en attente.

## Labels et descriptions

### Règle universelle

> Chaque contrôle a un **label visible** ou un **aria-label** explicite.
> **Jamais** de placeholder seul tenant lieu de label.

### Patterns

- `<label htmlFor>` lié à `<input id>` pour text/textarea/select.
- Radio groups dans un `<fieldset>` avec `<legend>`.
- Switches : `<button role="switch" aria-checked="…" aria-label="…">`
  + label texte adjacent (pas seulement la couleur).
- Picker icône : bouton déclencheur `aria-label="Choisir une icône"`,
  popover `role="dialog" aria-label="Sélecteur d'icône"`.
- Item de liste : poignée drag `aria-label="Déplacer l'item N"` ;
  bouton suppression `aria-label="Supprimer l'item N"`.

## Guidance par éditeur

### TextEditor / MultilineEditor

- `<input>` / `<textarea>` natifs.
- `aria-describedby` pointe la description + le compteur (« 42 sur 120
  caractères »).
- Compteur en `aria-live="polite"` quand on dépasse 90 % de la limite.

### RichTextEditor

- `<textarea>` source avec `aria-multiline="true"`.
- `aria-describedby` mentionne **les raccourcis** (« utilisez Cmd+B pour
  le gras »).
- Barre d'outils : chaque bouton `aria-label="Insérer du gras"`,
  `aria-keyshortcuts="Meta+B"`.
- Toggle Aperçu : `<button role="switch" aria-checked>`.

### CtaEditor

- `<fieldset>` parent `aria-labelledby` (label de champ).
- Sous-champs labelisés un par un.
- Aperçu live : `role="status" aria-live="polite"` (annonce le label
  du bouton dès qu'il change).

### LinkEditor

- Idem CtaEditor sans variant ni icône.
- Checkbox `external` : label *« Ouvrir dans un nouvel onglet »*.

### IconEditor + IconPicker

- Bouton déclencheur : `aria-label="Choisir une icône, actuellement : sun"`,
  `aria-haspopup="dialog"`, `aria-expanded`.
- Popover : `role="dialog"`, focus-trap.
- Champ recherche : `<input type="search" aria-label="Rechercher une icône">`.
- Grille : chaque option `role="option"` ou bouton avec
  `aria-label="<icon-name>"`. Les **noms** sont annoncés au focus.
- Touche `Enter` valide, `Esc` ferme sans valider.

### ColorTokenEditor

- `<fieldset><legend>` → titre du champ.
- Chaque swatch est un radio (`role="radio"`, `aria-checked`).
- **Le nom du token est visible en texte** (pas seulement la couleur :
  WCAG 1.4.1 *Use of color*).
- Flèches navigent ; `Espace` choisit.

### EnumEditor

- ≤ 4 options : `<fieldset>` + radios standards.
- > 4 options : `<select>` natif (très accessible par défaut).

### NumberEditor

- `<input type="number">` natif. Mode pas chic mais hyper accessible.
- `aria-describedby` indique min / max / step et l'unité.

### BooleanEditor

- Switch ARIA `<button role="switch" aria-checked>` + texte
  *Activé / Désactivé* à droite.
- **Pas seulement la couleur** : la position et le texte signalent
  l'état (WCAG 1.4.1).

### ListEditor

- Conteneur `role="list"`, items `role="listitem"`.
- Réordonnancement :
  - **drag-and-drop** disponible mais **non requis** ;
  - **alternative clavier** : flèches `Alt+↑` / `Alt+↓` sur l'item
    focus, ou boutons explicites « Monter / Descendre » dans le menu
    de l'item.
- Bouton « Ajouter » : `aria-label="Ajouter un item à la liste"`.

### RecordEditor

- `<fieldset>` parent avec `<legend>` = label du champ.
- Sous-champs : composent les éditeurs primitifs (chacun gère son
  a11y).

## Annonces dynamiques (live regions)

| Région | Type | Priorité |
|---|---|---|
| `<SaveIndicator>` | `role="status"` `aria-live="polite"` | polite |
| Badge de statut au changement | `aria-live="polite"` | polite |
| Erreur de validation inline | `role="alert"` (équivalent assertive) | assertive |
| Conflit 409 (modale) | `role="alertdialog"` | assertive |
| Confirmation de publication réussie | toast `role="status"` | polite |
| Compteur de caractères critique | `aria-live="polite"` | polite |

> **Pas de spam** : l'indicateur de save n'annonce pas chaque
> sauvegarde individuelle. Il annonce le **changement d'état global**
> (`enregistrement…`, `enregistré`, `erreur`).

## Couleur et contraste

### Règles

1. La **couleur n'est jamais le seul vecteur** d'information :
   - dirty → bordure gauche **+** indicateur dans le header **+** badge ;
   - erreur → bordure rouge **+** texte d'erreur **+** icône `triangle-alert` ;
   - statuts → couleur **+** texte explicite.
2. Contraste validé par axe-core sur la palette mappée en D4. Les
   paires fond/texte critiques :

| Paire | Contraste calculé | Conforme |
|---|---|---|
| `encre` sur `creme` | ≥ 12 | AAA |
| `encre` sur `creme-warm` | ≥ 11 | AAA |
| `encre` sur `champagne-soft` | ≥ 8 | AAA |
| `encre` sur `sauge-soft` | ≥ 7 | AAA |
| `encre` sur `ciel-soft` | ≥ 7 | AAA |
| `petale-dark` sur `petale-soft` | ≥ 5 | AA |
| `creme` sur `encre` | ≥ 12 | AAA |
| `creme` sur `petale-dark` | ≥ 5 | AA |
| `encre-soft` sur `creme` | ≥ 6 | AA |

### Mode sombre

**Hors scope v1**. L'admin reste en clair. Si un PR introduit le mode
sombre, il devra remapper l'intégralité des paires ci-dessus.

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    transition-duration: 0ms !important;
  }
}
```

- Le pulse de `<SaveIndicator>` devient un état statique.
- Les ouvertures de modale / accordéon deviennent instantanées.
- Le drag-and-drop reste fonctionnel (le mouvement est utile à la
  tâche, pas décoratif).
- Aucun effet d'apparition ne disparaît : on supprime juste le
  *delta* d'animation.

## Cibles tactiles

| Élément | Taille minimale |
|---|---|
| Bouton standard | 40 × 40 px (avec padding interne) |
| Icone-bouton | 32 × 32 px hit-area (icône 16-20 px centrée) |
| Switch | 32 × 20 px visible, hit-area 44 × 24 |
| Radio / checkbox | 20 × 20 visible, hit-area 32 × 32 |
| Poignée drag | 24 × 24 px hit-area |
| Lien textuel inline | hauteur de ligne native (~20 px) — exception WCAG 2.5.8 *inline* |

## Lecteurs d'écran : checklist par écran

### Écran d'édition d'un composant

- [ ] Titre H1 = nom du composant.
- [ ] Tablist annonce « 4 onglets, Champs sélectionné, 1 sur 4 ».
- [ ] Chaque accordéon annonce son label + état (« plié / déplié »).
- [ ] Chaque champ annonce label + statut (« Titre, Brouillon »).
- [ ] Description du champ annoncée via `aria-describedby`.
- [ ] Compteur dépassant la limite annoncé en `polite`.
- [ ] Bouton « Publier » annonce le nombre de drafts (« Publier 3 modifications »).

### Modale Publier

- [ ] Annoncée comme `dialog`, titre lu en premier.
- [ ] Liste des champs à publier annoncée comme `list`.
- [ ] Lien « Voir le diff » : annoncé comme `link` ouvrant un autre `dialog`.
- [ ] Bouton primaire annonce action concrète (« Publier 3 champs »).

### Modale Conflit

- [ ] `alertdialog`, focus initial sur explication.
- [ ] Boutons primaire et secondaire bien différenciés en label.

## Tests d'accessibilité

### Automatique

- **axe-core** via `@axe-core/playwright` sur 6 écrans clés (cf. T5).
- **vitest-axe** sur chaque éditeur en isolation (cf. T4).
- **Storybook a11y addon** si Storybook est ajouté plus tard
  (out-of-scope v1).

### Manuel (checklist par PR éditeur)

1. Naviguer entièrement au clavier (Tab / Shift+Tab).
2. Tester avec VoiceOver (macOS) sur Safari.
3. Vérifier `prefers-reduced-motion: reduce` (Inspector → Rendering).
4. Zoomer à 200 % sans scroll horizontal.
5. Désactiver les feuilles de styles et vérifier l'ordre DOM.
6. Vérifier le contraste sur Inspector (colorimétrie).

### Cibles métriques

| Métrique | Cible |
|---|---|
| axe violations A/AA | 0 |
| Lighthouse a11y score | ≥ 95 |
| Cible tactile minimum | 24 × 24 (WCAG 2.2 AA) |
| Couvre-clavier | 100 % des interactions |
| Annonces SR | toutes les changements d'état critiques |

## Internationalisation

L'UI est FR-only en v1 (cf. README, A1). Néanmoins :

- Tous les textes UI passent par un module `i18n.ts` (même monolingue).
- Aucun texte hard-codé dans les composants admin.
- L'attribut `lang="fr"` est posé sur le `<html>`.
- Les dates utilisent `Intl.DateTimeFormat` avec `'fr-FR'`.

Cf. A5.

## Quand ce doc et l'implémentation divergent

Si un PR introduit un éditeur qui ne respecte pas une règle ci-dessus :

1. soit on rectifie l'éditeur ;
2. soit on documente l'écart **ici** avec la justification (rare) et on
   ouvre un ticket pour résorber.

Les écarts non documentés sont **traités comme des bugs**.

## Croisements

| Choix a11y | Source / contrainte |
|---|---|
| Focus trap modales | WCAG 2.4.3, P2 |
| Alternative non-drag | WCAG 2.5.7 (2.2 AA) |
| Couleur + texte (statuts) | D3, D4 |
| `aria-describedby` rich-text | D3 |
| `prefers-reduced-motion` | D4 |
| axe 0 violation | A1 § Qualité |
