# 03 — Spécification UI détaillée du wizard de soumission

Ce document est la **référence visuelle exhaustive** du wizard, frame par frame, élément par élément. Il s'adresse au designer et au développeur frontend qui implémentent le wizard. Toute ambiguïté au moment de l'implémentation se résout ici.

Il complète, sans le remplacer, le document fonctionnel `↗ 11-wizard-soumission.md` du dossier parent.

## 1. Cadrage général

### 1.1 Conteneur

Le wizard **occupe le drawer entier** lorsqu'il est actif (mode `view = 'wizard'`). Il remplace la liste de témoignages dans le même drawer plutôt que d'empiler une modale.

Dimensions :

- Desktop : 480 × 100vh.
- Tablet : 420 × 100vh.
- Mobile : 100vw × 92vh (bottom sheet étendu).

Fond : crème `#FBF8F1`.
Padding interne : 32 px horizontal desktop / 24 px mobile.

### 1.2 Indicateur de progression

Coin haut droit, **discret** :

```
                                      2 sur 3
```

- Inter Regular 12 pt brume `#6B6863`.
- Pas de barre de progression visible, pas de couleur sémantique, pas de fill animé.
- Si l'utilisatrice a sauté une étape, l'indicateur passe en italique : `2 sur 3 — étape 2 passée`.

### 1.3 Bouton retour

Coin haut gauche :

```
← Revenir aux rituels
```

- Inter Medium 13 pt encre, hover sauge-dark.
- Cliquer ramène au mode liste sans perte d'état (le brouillon localStorage est conservé).

Sur les étapes 2 et 3, le bouton devient `← Retour` et ramène à l'étape précédente.

### 1.4 En-tête de wizard (commun)

Toujours visible en haut du contenu :

```
                                              2 sur 3

← Retour

PARTAGER MON RITUEL                          (kicker Inter 9 pt sauge-dark)

Étape 2 — Vos mots-clés                       (Cormorant Light 28 pt encre)

╌╌╌╌◆╌╌╌╌                                     (fleuron champagne 80×14 px)
```

Marge sous le fleuron : 32 px.

## 2. Étape 1 — Votre voix

### 2.1 Frame complète

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  [← Revenir aux rituels]                          1 sur 3        │
│                                                                  │
│  PARTAGER MON RITUEL                                             │
│  Étape 1 — Votre voix                                            │
│                                                                  │
│  ╌╌╌╌◆╌╌╌╌                                                       │
│                                                                  │
│  Qu'est-ce que le rituel a changé pour vous ?                   │
│  ─────────────────────────────────────────                       │
│  ┌─────────────────────────────────────────┐                    │
│  │                                          │                    │
│  │  Décrivez ce que vous avez remarqué.    │                    │
│  │  Cinquante mots suffisent.              │                    │
│  │                                          │                    │
│  │                                          │                    │
│  │                                          │                    │
│  │                                          │                    │
│  └─────────────────────────────────────────┘                    │
│  0 / 50 mots                                                     │
│                                                                  │
│                                                                  │
│  Recommanderiez-vous ce rituel à une amie ?                     │
│  ─────────────────────────────────────────                       │
│  ┌─────────────────────────────────────────┐                    │
│  │  ○  Oui, sans hésiter                   │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │  ○  J'hésite                            │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │  ○  Pas pour moi                        │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│                                                                  │
│  Soumettre tel quel →                                            │
│  ─────────────────────────────────────                           │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │           Continuer →                    │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  Vous pouvez partager dès maintenant.                            │
│  Les détails sont facultatifs.                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Élément par élément

#### 2.2.1 Titre de question 1

```
Qu'est-ce que le rituel a changé pour vous ?
```

- **Composant** : `<label htmlFor="ritual-body">`.
- **Police** : Cormorant Regular 18 pt encre.
- **Marge** : 32 px top, 12 px bottom.
- **Pas de gras**, pas d'italique.
- **Filet** : 1 px sauge-pale `#E8EFE7` en `border-bottom` sur 60 px de largeur, centré sous le label, 8 px en dessous.

#### 2.2.2 Textarea body

- **Composant** : `<textarea id="ritual-body">`.
- **Dimensions** : 100 % largeur, 160 px hauteur minimale, redimensionnable verticalement (`resize: vertical`).
- **Padding interne** : 16 px tous côtés.
- **Police** : Cormorant Regular 17 pt encre, line-height 1.6.
- **Fond** : crème pure `#FFFFFF`.
- **Bordure** : 1,5 px sauge-pale.
- **Radius** : 0.
- **Placeholder** : `Décrivez ce que vous avez remarqué. Cinquante mots suffisent.` — Cormorant Regular 17 pt brume.
- **Focus** : bordure 1,5 px sauge-dark, outline 2 px encre offset 4 px.
- **Auto-save** : toutes les 15 sec dans `localStorage` clé `ritual-draft-v1`.

#### 2.2.3 Compteur de mots

Sous la textarea, aligné à gauche :

```
0 / 50 mots
```

États (modulation couleur sans alarmisme) :

| Mots | Style | Texte |
| --- | --- | --- |
| 0 à 49 | Inter Regular 12 pt encre | `{n} / 50 mots` |
| 50 à 100 | Inter Regular 12 pt sauge-dark | `{n} mots — suffisamment dense pour être lue.` |
| 101 à 250 | Inter Regular 12 pt sauge-dark | `{n} mots — suffisamment dense pour être lue.` |
| 251 à 350 | Inter Regular 12 pt brume | `{n} mots — plus court invite à plus de lecture.` |
| 351+ | Inter Regular 12 pt rouge-feutre `#9C5B5B` | `{n} mots — au-delà de cent cinquante, l'attention se perd.` |

Margin top 8 px, margin bottom 24 px.

#### 2.2.4 Toast emoji retiré

Apparaît en bas du textarea quand un emoji est tapé :

```
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
Les émoticônes ne sont pas
dans notre grammaire.
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
```

- Position : sous le textarea, centré.
- Fond : sauge-pale `#E8EFE7`.
- Padding : 12 × 16 px.
- Bordure : 1,5 px sauge.
- Police : Cormorant Italic 14 pt encre.
- Apparition : 200 ms `translateY -8 px → 0, opacity 0 → 1`.
- Tenue : 2 sec.
- Disparition : 200 ms `opacity → 0`.
- `aria-live="polite"`.

#### 2.2.5 Titre de question 2

```
Recommanderiez-vous ce rituel à une amie ?
```

- **Composant** : `<fieldset><legend>`.
- **Style** : identique au titre de question 1.
- **Margin top** : 40 px (espace généreux entre les deux questions).
- **Margin bottom** : 12 px sous le filet décoratif.

#### 2.2.6 Radio « Oui, sans hésiter »

```
┌─────────────────────────────────────────┐
│  ○  Oui, sans hésiter                   │
└─────────────────────────────────────────┘
```

- **Composant** : `<label><input type="radio" name="would_recommend" value="oui" hidden /> Oui, sans hésiter</label>`.
- **Bouton radio caché**, le label est le toggle visible.
- **Largeur** : 100 %.
- **Hauteur** : 56 px (touch target).
- **Padding** : 16 × 20 px.
- **Fond default** : crème pure.
- **Bordure default** : 1,5 px sauge-pale.
- **Radius** : 0.
- **Texte** : Inter Regular 15 pt encre.
- **Cercle radio** : 16 × 16 px, bordure 1,5 px sauge-pale, fond crème pure, à gauche du label avec margin-right 12 px.
- **État `:checked`** (via `label:has(input:checked)`):
  - Fond : sauge-pale `#E8EFE7`.
  - Bordure : 1,5 px sauge-dark.
  - Cercle : intérieur sauge-dark plein 8 × 8 px centré.
- **Hover** : fond sauge-pale, 150 ms `default`.
- **Focus** : outline 2 px encre offset 4 px sur le label.
- **Margin top** entre les 3 options : 8 px.

Idem pour `J'hésite` (value=`hesite`) et `Pas pour moi` (value=`non`).

#### 2.2.7 Lien `Soumettre tel quel`

```
Soumettre tel quel →
```

- **Composant** : `<button type="button">`.
- **Position** : avant le bouton primaire, marge top 32 px.
- **Police** : Inter Medium 13 pt brume.
- **Hover** : couleur encre.
- **Click** : soumet le wizard immédiatement sans passer par étapes 2 et 3.
- **État** : visible **uniquement** si `body` et `would_recommend` sont valides.

#### 2.2.8 Bouton CTA primaire `Continuer →`

```
┌─────────────────────────────────────────┐
│           Continuer →                    │
└─────────────────────────────────────────┘
```

- **Composant** : `<button type="button">` (pas `submit` — submit final est à l'étape 3).
- **Largeur** : 100 %.
- **Hauteur** : 56 px.
- **Padding** : 12 × 24 px.
- **Fond** : encre `#2C2A28`.
- **Texte** : crème, Inter Medium 13 pt.
- **Flèche** : caractère `→` (U+2192) à 8 px du texte.
- **Radius** : 0.
- **Hover** : fond encre-claire `#4A4844`, 200 ms.
- **Active** : `scale(0.98)` 100 ms.
- **Disabled** : opacity 0.4, cursor not-allowed (si body invalide ou would_recommend non choisi).
- **Margin top** : 8 px (suite du lien `Soumettre tel quel`).

#### 2.2.9 Texte d'aide en pied

```
Vous pouvez partager dès maintenant.
Les détails sont facultatifs.
```

- Cormorant Italic 14 pt brume centré.
- Margin top 16 px.
- 2 lignes sur 2 lignes (pas de fusion).

### 2.3 Validation et transitions étape 1

| Trigger | Comportement |
| --- | --- |
| body.trim() < 50 chars | Bouton `Continuer` désabilité (opacity 0.4), `Soumettre tel quel` masqué |
| body 50–600 chars + would_recommend choisi | Boutons actifs |
| body > 600 chars | Compteur en rouge-feutre, boutons désactivés, message « Au-delà de trois cents mots, le rituel se dilue. » |
| Click `Continuer` | Validation + transition vers étape 2 |
| Click `Soumettre tel quel` | Validation + POST `/api/rituals/submit` (avec champs étapes 2/3 vides) + confirmation |

## 3. Étape 2 — Vos mots-clés

### 3.1 Frame complète

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  [← Retour]                                       2 sur 3        │
│                                                                  │
│  PARTAGER MON RITUEL                                             │
│  Étape 2 — Vos mots-clés                                         │
│                                                                  │
│  ╌╌╌╌◆╌╌╌╌                                                       │
│                                                                  │
│  Que diriez-vous en trois mots ?                                 │
│  (jusqu'à trois)                                                 │
│  ─────────────────────────────────                               │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ ☐ Ongles plus       │  │ ☐ Plaque souple     │               │
│  │   lisses            │  │                     │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ ☐ Cuticules         │  │ ☐ Plus de casse     │               │
│  │   apaisées          │  │                     │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ ☐ Éclat naturel     │  │ ☐ Rituel devenu     │               │
│  │                     │  │   habitude          │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ ☐ Mains détendues   │  │ ☐ Fini brillant     │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  ┌─────────────────────┐                                         │
│  │ ☐ Halal             │                                         │
│  └─────────────────────┘                                         │
│                                                                  │
│                                                                  │
│  Une photo de vos mains ?                                        │
│  ─────────────────────────                                       │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │                                          │                    │
│  │       + Glisser ou choisir              │                    │
│  │         jusqu'à 3 photos                │                    │
│  │                                          │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  Mains, gestes, table de soin.                                   │
│  Pour préserver l'intimité de la maison,                         │
│  nous ne publions pas de visage de face.                         │
│                                                                  │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │           Continuer →                    │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  [Passer cette étape →]                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Sous-section Tags

#### 3.2.1 Grille de checkboxes

- **Layout desktop** : Grid 2 colonnes, gap 12 px horizontal et 8 px vertical.
- **Layout mobile** : Grid 1 colonne.
- **Container** : `<fieldset>` avec `<legend>Que diriez-vous en trois mots ? (jusqu'à trois)</legend>`.

#### 3.2.2 Checkbox tag

```
┌─────────────────────┐
│ ☐ Ongles plus       │
│   lisses            │
└─────────────────────┘
```

- **Composant** : `<label><input type="checkbox" hidden /> Ongles plus lisses</label>`.
- **Largeur** : 100 % de la colonne.
- **Hauteur minimale** : 56 px.
- **Padding** : 12 × 16 px.
- **Police** : Inter Regular 14 pt encre.
- **Fond default** : crème pure.
- **Bordure default** : 1,5 px sauge-pale.
- **Radius** : 0.
- **Carré checkbox** : 14 × 14 px, à gauche, bordure 1,5 px sauge-pale, fond crème pure, margin-right 12 px.
- **État `:checked`** :
  - Fond : sauge-pale.
  - Bordure : 1,5 px sauge-dark.
  - Carré rempli : intérieur sauge-dark plein avec petit check `✓` SVG crème 8 × 8 px.
- **Hover** : fond sauge-pale.
- **Focus** : outline 2 px encre offset 4 px.

#### 3.2.3 État `disabled` quand 3 tags cochés

Quand 3 cases cochées, les 6 autres :

- `opacity: 0.4`.
- `cursor: not-allowed`.
- Tooltip discret au hover : `Trois suffisent.` (Cormorant Italic 12 pt brume).

#### 3.2.4 Compteur de tags

Sous la grille, optionnel, discret :

```
2 / 3 mots choisis
```

- Inter Regular 12 pt brume.
- Margin top 12 px.

### 3.3 Sous-section Photos

#### 3.3.1 Zone drop

```
┌─────────────────────────────────────────┐
│                                          │
│       + Glisser ou choisir              │
│         jusqu'à 3 photos                │
│                                          │
└─────────────────────────────────────────┘
```

- **Composant** : `<div role="button" tabIndex={0}>` avec `<input type="file" multiple accept="image/jpeg,image/png,image/heic,image/webp" hidden />`.
- **Dimensions** : 100 % largeur, hauteur 140 px minimum.
- **Padding** : 24 px.
- **Fond** : crème pure.
- **Bordure default** : 1,5 px dashed sauge-pale.
- **Radius** : 0.
- **Texte centré** : Cormorant Italic 16 pt brume.
- **Hover** : bordure dashed sauge-dark.
- **Drag-over** : bordure 2 px solid sauge `#C5DBC4`, fond sauge-pale.
- **Drop ok** : bordure 2 px solid sauge-dark, transition 200 ms.
- **Focus** : outline 2 px encre offset 4 px.

#### 3.3.2 Vignettes uploadées

Quand une photo est uploadée, elle apparaît au-dessus de la zone drop :

```
┌───┐ ┌───┐ ┌───┐
│ ▣ │ │ ▣ │ │ + │
│ × │ │ × │ │   │
└───┘ └───┘ └───┘
```

- Dimensions chaque vignette : 100 × 100 px.
- Gap : 12 px.
- Bordure : 1,5 px sauge-pale.
- Radius : 0.
- Bouton `×` en haut à droite : 24 × 24 px, fond crème opacité 0.9, croix SVG 12 px encre.
- Touch target effectif : 40 × 40 px via padding extérieur.
- Au 3ᵉ photo uploadée, la zone drop disparaît (remplacée par texte « 3 photos. C'est tout. »).

#### 3.3.3 États photo

| État | Visuel |
| --- | --- |
| `uploading` | Skeleton sauge-pale avec pulse opacity 0.6 → 1 toutes les 1,5 sec, percentage tooltip |
| `processing` | Photo affichée + overlay sauge-pale semi-transparent + texte `Vérification en cours…` |
| `ok` | Photo affichée normalement |
| `manual_review` | Photo affichée + badge orange (Inter SemiBold 9 pt kicker `EN RELECTURE`) en haut-gauche |
| `rejected_face` | Modale d'alerte (cf. § 3.3.4) |
| `error` | Photo placeholder avec icône `×` + texte `Une erreur. Essayer à nouveau.` |

#### 3.3.4 Modale d'alerte face détectée

Apparaît au-dessus du wizard (overlay supplémentaire) **si une photo uploadée retourne `faces_status = REJECTED_FACE`** :

```
┌───────────────────────────────────────────┐
│                                            │
│  ╌╌╌╌◆╌╌╌╌                                 │
│                                            │
│  La photo contient un visage.             │
│                                            │
│  Pour préserver l'intimité de la maison,  │
│  voudriez-vous la remplacer ?             │
│                                            │
│  [Choisir une autre photo]                 │
│                                            │
│  Conserver pour relecture humaine →       │
│                                            │
└───────────────────────────────────────────┘
```

- **Position** : centrée verticalement, max 400 px largeur, padding 32 px.
- **Fond** : crème.
- **Bordure** : aucune, shadow `0 8px 24px rgba(44, 42, 40, 0.12)`.
- **Titre** : Cormorant Light 22 pt encre.
- **Corps** : Cormorant Italic 15 pt encre.
- **Bouton primaire** « Choisir une autre photo » : pleine largeur, encre.
- **Lien secondaire** « Conserver pour relecture humaine → » : Inter Medium 13 pt brume, en pied.

### 3.4 Texte d'aide en pied de l'étape

```
Mains, gestes, table de soin.
Pour préserver l'intimité de la maison,
nous ne publions pas de visage de face.
```

- Cormorant Italic 14 pt brume.
- Margin top 16 px sous la zone drop.

### 3.5 CTAs en pied

#### 3.5.1 Bouton primaire `Continuer →`

Identique à étape 1.

#### 3.5.2 Lien secondaire `Passer cette étape →`

```
Passer cette étape →
```

- Inter Medium 13 pt brume.
- Margin top 16 px.
- Hover : encre.
- Click : passe directement à l'étape 3 sans rien remplir en étape 2.

### 3.6 Validation et transitions étape 2

| Trigger | Comportement |
| --- | --- |
| Tag 4ᵉ click | `:checked` ignoré, les 6 autres restent disabled |
| Photo trop grosse (> 5 Mo) | Toast erreur + photo rejetée côté client avant upload |
| Photo upload échec | Vignette en erreur, bouton retry visible |
| Click `Continuer` | Transition étape 3 |
| Click `Passer` | Transition directe vers confirmation (sans étape 3) |
| Click `← Retour` | Retour étape 1, état préservé |

## 4. Étape 3 — Votre signature

### 4.1 Frame complète

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  [← Retour]                                       3 sur 3        │
│                                                                  │
│  PARTAGER MON RITUEL                                             │
│  Étape 3 — Votre signature                                       │
│                                                                  │
│  ╌╌╌╌◆╌╌╌╌                                                       │
│                                                                  │
│  Comment souhaitez-vous signer ?                                 │
│  ─────────────────────────────                                   │
│                                                                  │
│  Prénom (apparaîtra publiquement)                                │
│  ┌─────────────────────────────────────────┐                    │
│  │ Amal                                     │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  Ville                                                           │
│  ┌─────────────────────────────────────────┐                    │
│  │ Rabat                                ▾ │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  Initiée depuis                                                  │
│  ┌──────────────┬──────────────────────────┐                    │
│  │ Février     ▾│ 2026                   ▾ │                    │
│  └──────────────┴──────────────────────────┘                    │
│                                                                  │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │ ☐ Signer anonymement                    │                    │
│  │                                          │                    │
│  │   (la maison gardera votre prénom en    │                    │
│  │    mémoire, mais publiera                │                    │
│  │    « Une initiée, Rabat »)              │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │      Partager mon rituel →               │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  [Passer cette étape →]                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Champs

#### 4.2.1 Prénom

- **Composant** : `<label><input type="text" />`.
- **Label** : `Prénom (apparaîtra publiquement)`. Cormorant Regular 18 pt encre. Suffixe italique brume.
- **Filet 1 px sauge-pale 60 px sous le label**.
- **Input** : hauteur 56 px, padding 16 × 20 px, Inter Regular 15 pt encre, fond crème pure, bordure 1,5 px sauge-pale.
- **Focus** : bordure sauge-dark.
- **Validation** : 1 à 30 caractères, regex `^[a-zA-ZÀ-ÿ' -]+$`. Erreur silencieuse jusqu'au blur.
- **Autocomplete** : `given-name`.
- **Pré-remplissage** : depuis emailToken si `customerFirstName` disponible.

#### 4.2.2 Ville

- **Composant** : `<label><select>` ou `<input type="text" list="cities">`.
- **Label** : `Ville`. Style identique au prénom.
- **Options** : Rabat, Casablanca, Salé, Tanger, Marrakech, Fès, Agadir, Oujda, Tétouan, Meknès, Kénitra, Autre.
- **Comportement** : sélection dans une liste fermée. Si « Autre », champ texte libre apparaît.
- **Pré-remplissage** : depuis emailToken si `customerCity` disponible.

#### 4.2.3 Initiée depuis

```
┌──────────────┬──────────────────────────┐
│ Février     ▾│ 2026                   ▾ │
└──────────────┴──────────────────────────┘
```

- **Composant** : 2 `<select>` natifs côte à côte.
- **Mois** : Janvier à Décembre.
- **Année** : 2024 jusqu'à année courante.
- **Style** : identique aux champs précédents, divisés par un filet sauge-pale 1 px vertical.

#### 4.2.4 Checkbox anonymat

```
┌─────────────────────────────────────────┐
│ ☐ Signer anonymement                    │
│                                          │
│   (la maison gardera votre prénom en    │
│    mémoire, mais publiera                │
│    « Une initiée, Rabat »)              │
└─────────────────────────────────────────┘
```

- **Composant** : `<label><input type="checkbox" />` + paragraphe d'aide.
- **Largeur** : 100 %.
- **Padding** : 16 × 20 px.
- **Fond default** : crème pure.
- **Bordure** : 1,5 px sauge-pale.
- **Label principal** : Inter Regular 15 pt encre.
- **Texte d'aide** : Cormorant Italic 14 pt brume.
- **État checked** : fond sauge-pale, texte preview signature mis à jour.

### 4.3 CTAs en pied

#### 4.3.1 Bouton primaire `Partager mon rituel →`

- Identique structure au CTA `Continuer` mais avec libellé `Partager mon rituel →`.
- **Spinner** pendant submit : remplace le texte par `Partage en cours…` + spinner 14 × 14 px encre-claire à droite.
- **Disabled pendant submit**.

#### 4.3.2 Lien `Passer cette étape →`

- Soumet immédiatement avec champs étape 3 vides (signature « Une initiée » par défaut).

### 4.4 Validation et transitions étape 3

| Trigger | Comportement |
| --- | --- |
| Champs vides | Pas d'erreur (tout est optionnel) |
| Click `Partager mon rituel` | POST `/api/rituals/submit` + transition vers confirmation |
| Click `← Retour` | Retour étape 2 |
| Submit error | Bannière sauge-pale en haut de l'étape + bouton réessayer |
| Submit success | Transition vers confirmation |

## 5. Confirmation finale

### 5.1 Frame complète

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│                                                                  │
│                                                                  │
│                                                                  │
│                     ╌╌╌╌◆╌╌╌╌                                    │
│                                                                  │
│                                                                  │
│              La maison reçoit votre rituel.                      │
│                                                                  │
│                                                                  │
│              Nous l'ouvrirons sous 24 à 48 heures.               │
│                                                                  │
│              Vous recevrez un mot quand il sera publié.          │
│                                                                  │
│                                                                  │
│                                                                  │
│              Avec soin,                                          │
│              Souheila · FemiGlow                                 │
│                                                                  │
│                                                                  │
│                     ╌╌╌╌╌╌╌╌╌╌                                   │
│                                                                  │
│                                                                  │
│              [Continuer la lecture]                              │
│                                                                  │
│                                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Détails

- **Centrage** : flexbox vertical et horizontal, padding généreux.
- **Fleuron supérieur** : variante A, 96 × 14 px champagne, apparition fade 400 ms.
- **Titre** : `La maison reçoit votre rituel.` Cormorant Italic 22 pt encre. Apparition 600 ms `out-soft` delay 200 ms.
- **Body 1** : `Nous l'ouvrirons sous 24 à 48 heures.` Cormorant Italic 18 pt encre. Apparition 400 ms delay 600 ms.
- **Body 2** : `Vous recevrez un mot quand il sera publié.` Cormorant Italic 18 pt encre. Apparition 400 ms delay 900 ms.
- **Signature** : `Avec soin,` puis `Souheila · FemiGlow`. Inter Regular 13 pt brume (1ère ligne), Inter Medium 13 pt encre (2ᵉ ligne). Apparition delay 1300 ms.
- **Fleuron inférieur** : variante B (point central). Apparition delay 1700 ms.
- **Bouton `Continuer la lecture`** : secondaire (texte 13 pt + filet supérieur), apparition delay 2000 ms.
- **Auto-close** : 8 secondes après l'apparition complète, le drawer ferme automatiquement et restaure la liste avec position scroll préservée.
- **`aria-live="polite"` sur le conteneur** : annonce vocale du contenu.

## 6. Modale de reprise de brouillon

Apparaît au mount du wizard si `localStorage` contient un brouillon < 7 jours :

```
┌───────────────────────────────────────────┐
│                                            │
│  ╌╌╌╌◆╌╌╌╌                                 │
│                                            │
│  La maison a gardé votre rituel           │
│  en mémoire.                              │
│                                            │
│  Voulez-vous le reprendre ou             │
│  recommencer ?                            │
│                                            │
│  [Reprendre]                              │
│                                            │
│  Recommencer →                            │
│                                            │
│  Plus tard →                              │
│                                            │
└───────────────────────────────────────────┘
```

- Centre du drawer, max 380 px.
- Padding 32 px, fond crème, shadow subtle.
- Bouton primaire « Reprendre » : encre.
- Liens secondaires « Recommencer » et « Plus tard » : Inter Medium 13 pt brume.

## 7. États globaux du wizard

| État | Description | Style |
| --- | --- | --- |
| `step_1_idle` | Étape 1 vierge | Default |
| `step_1_typing` | Saisie en cours | Sanitization active |
| `step_1_valid` | Body et signal OK | CTA actif |
| `step_2_uploading` | Photo en cours d'upload | Vignette skeleton + pulse |
| `step_2_face_alert` | Modale face détectée | Overlay supplémentaire |
| `step_3_idle` | Étape 3 | Default |
| `step_3_submitting` | Submit en cours | Bouton spinner |
| `submit_success` | Confirmation affichée | Animation séquentielle |
| `submit_error` | Erreur réseau | Bannière + bouton retry |

## 8. Comportement mobile spécifique

### 8.1 Adaptations layout

- Bottom-sheet plein écran (92 vh).
- Étapes 2 (tags) : grid 1 colonne.
- Étape 3 (mois/année) : flex en row si écran ≥ 360 px, sinon flex column.
- Photo drop : zone plus grande (180 px hauteur).
- Boutons primaires : `min-height: 56 px` strictement.
- Keyboard pad : `inputmode` et `enterkeyhint` corrects sur chaque champ.

### 8.2 Drag-to-close désactivé

Pendant le wizard, le drag-to-close du bottom sheet est désactivé pour éviter une fermeture accidentelle pendant la saisie. Seul le bouton `← Revenir aux rituels` ferme.

## 9. Accessibilité du wizard

Critères WCAG 2.2 AA strictement appliqués :

| Critère | Application |
| --- | --- |
| Fieldset / legend | Sur les groupes radio (signal) et checkbox (tags, anonymat) |
| Label / input pairing | Tous les champs ont un `<label htmlFor>` |
| `aria-describedby` | Compteur de mots associé au textarea via `aria-describedby="body-counter"` |
| Focus management | Premier champ focusé au mount de chaque étape |
| Annonce de changement d'étape | `aria-live="polite"` sur container du wizard |
| Erreur de soumission | `role="alert"` sur la bannière |
| Touch target | ≥ 44 × 44 px partout |
| Pas de couleur seule | Erreur signalée par texte + bordure (pas que rouge) |
| Drag-to-close mobile | Désactivé pendant wizard pour éviter perte de saisie |

## 10. Tests visuels recommandés (Storybook)

Stories à créer :

| Story | Variantes |
| --- | --- |
| `RitualsWizard / Step 1` | vide, en cours, dense, trop long, emoji détecté |
| `RitualsWizard / Step 2` | 0 tag, 3 tags, 4ᵉ disabled, 0 photo, 3 photos, face detected modal |
| `RitualsWizard / Step 3` | vide, prénom rempli, anonymat coché, pré-rempli email |
| `RitualsWizard / Confirmation` | apparition complète |
| `RitualsWizard / DraftResumeModal` | modale ouverte |
| `RitualsWizard / SubmitError` | bannière d'erreur |

Chaque story rend axe-core en background.

## 11. Synthèse — règles d'or du wizard

1. **L'étape 1 doit pouvoir être soumise seule.** Toute friction au-delà tue la conversion.
2. **Pas de message d'erreur rouge en cours de frappe.** Validation au blur, messages doux.
3. **Voix maison à toutes les chaînes.** Pas un seul « Champ obligatoire » ni « Erreur ».
4. **Brouillon localStorage 7 jours.**
5. **Anonymat par défaut si rien en étape 3.**
6. **Photo optionnelle**, jamais bloquante.
7. **Confirmation = lettre, pas notification.**
8. **Drag-to-close désactivé pendant le wizard sur mobile.**
9. **Visibilité progressive des liens secondaires** : `Soumettre tel quel` n'apparaît qu'une fois validé.
10. **Toutes les animations désactivables** via `prefers-reduced-motion`.
