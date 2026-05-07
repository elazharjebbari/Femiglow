# 05 — UI / UX & design admin

## Principes directeurs

- **Voix FemiGlow** : tutoiement, vocabulaire sensoriel, jamais de
  jargon technique côté fondatrice (`média`, pas `asset` ou `blob`).
- **Lisibilité avant densité** : la fondatrice doit comprendre l'état
  d'un média en une seconde — un seul coup d'œil.
- **Élégance > exhaustivité** : ne pas afficher tout d'un coup ; le
  drawer détaillé pour qui veut creuser, la grille pour qui veut
  parcourir.
- **Réversibilité** : toute action destructive est confirmée et
  annulable pendant 30 j (soft delete).
- **Cohérence avec le module admin existant** : on réutilise les
  tokens, les boutons, les modales du design system actuel.

## Surfaces

```
/admin/media                  → bibliothèque (liste + grille + filtres)
/admin/media/upload           → page d'import (drop zone, batch)
/admin/media/{id}             → détail (drawer ou page selon contexte)
/admin/media/{id}/usages      → où le média est utilisé
/admin/media/settings         → réglages globaux (formats, qualités, breakpoints)
/admin/media/duplicates       → dédoublonnage assisté
```

## Bibliothèque `/admin/media`

### Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ ⌂ Tableau de bord  /  Médias                          + Importer  │
├────────────────────────────────────────────────────────────────────┤
│ [🔍 Recherche…]  [Type: Tous ▾] [Statut ▾] [Tag ▾] [Inutilisés ▾] │
│                                              Tri ▾   Vue □ ⊞       │
├────────────────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │ ▣   │ │ ▣   │ │ ▣   │ │ ▣   │ │ ▣   │ │ ▣   │                    │
│ │     │ │     │ │     │ │     │ │     │ │     │                    │
│ │     │ │     │ │     │ │  ⏳ │ │  ⚠  │ │ 🔗  │   ← badges          │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
│ kit-     hero-   journal-banner  pending  failed   external-svg    │
│ optimisé optimisé non-optimisé   en cours erreur   pas réoptim     │
│ 18 KB    248 KB  2.1 MB                                            │
└────────────────────────────────────────────────────────────────────┘
```

### Vue grille (par défaut)

- **Tile** : 200 × 200 px (desktop), 144 × 144 (mobile).
- **Vignette** : variante `thumb` 160 px avec fallback BlurHash.
- **Badges en overlay (coin haut-droit)** :
  - `✓ optimisé` (vert) — `status='ready'` et au moins 1 variante.
  - `⏳ en cours` (orange) — `status='pending'` ou `processing`.
  - `⚠ erreur` (rouge) — `status='failed'` (cliquable → drawer avec
    log d'erreur).
  - `🔗 externe` (bleu) — `status='passthrough'`.
  - `★ hero` (or) — `is_hero=true`.
- **Footer du tile** : nom du slug (tronqué), taille de la version
  servie sur web, kind icon (📷/🎥/🎵).
- **Hover** : zoom léger (scale 1.02), bouton « voir » et « éditer »
  apparaissent.
- **Click** : ouvre le drawer détaillé.
- **Long press / shift-click** : sélection multiple (bulk actions).

### Vue liste (alternative)

Tableau dense pour les power-users :

| Vignette | Slug | Type | Statut | Taille originale | Taille servie | Économie | Tags | Usages | Modifié |
|---|---|---|---|---|---|---|---|---|---|

Tri sur chaque colonne.

### Filtres

- **Type** : tous / image / vidéo / audio
- **Statut** : tous / optimisé / en cours / erreur / externe / supprimé (corbeille)
- **Tag** : multi-select avec couleurs
- **Inutilisés** : médias sans `media_usages` après 30 j
- **Doublons potentiels** : `phash` distance ≤ 5 (badge rouge sur tile)
- **Période** : importé dans les X derniers jours

### Recherche

- Full-text sur `slug`, `alt`, `caption`, `credit`, `original_filename`
- Tolérante aux accents (collation normalisée Postgres)
- 200 ms debounce
- Highlight du match dans le résultat

### Tri

- Plus récents (défaut)
- Plus anciens
- Plus lourds (originaux)
- Plus utilisés (jointure `media_usages`)
- Économie d'octets (tri par
  `(original_size - serviced_size) / original_size DESC`)

### Bulk actions

Quand ≥ 2 médias sélectionnés, une **barre d'action** apparaît en bas
sticky :

- Ajouter des tags
- Définir un profil de qualité
- Régénérer les variantes
- Supprimer (soft)
- Exporter (CSV : id, slug, urls, tailles)

### Pagination

Infinite scroll par lots de 50 (cursor-based, pas d'offset). Indicateur
"X médias chargés / Y au total".

## Page d'import `/admin/media/upload`

### Drop zone

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│         ┌────────────────────────────────────────────┐             │
│         │                                            │             │
│         │              ⤴                             │             │
│         │       Dépose tes images, vidéos            │             │
│         │       ou audios ici                        │             │
│         │       (ou clique pour sélectionner)        │             │
│         │                                            │             │
│         └────────────────────────────────────────────┘             │
│                                                                    │
│         ou colle une URL : [_______________________] [+]           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

- Drag & drop multi-fichiers (jusqu'à 20 simultanés).
- Coller une URL externe (passe en `source='external'`).
- Coller un screenshot (clipboard image) → upload direct.
- Aperçu des fichiers en attente d'upload sous forme de cartes :

  ```
  ┌─────────────────────────┐
  │ ▣ kit-principale.png    │
  │ ▰▰▰▰▰▰▱▱▱  62%          │
  │                         │
  │ Alt : [____________]    │
  │ Tags: [+ kit principal] │
  │ ✓ Hero  □ Inline  □ Thumb│
  │                         │
  │ [Annuler]   [Importer]  │
  └─────────────────────────┘
  ```

- Champ `alt` obligatoire (validation client + serveur).
- Si l'image matche un phash existant : modale "Doublon détecté" avec
  comparaison côte à côte et 3 options : remplacer / créer quand même /
  annuler.
- Pendant l'upload : barre de progression par fichier + ETA global.
- Après upload : toast "5 médias importés, optimisation en cours" avec
  lien vers la bibliothèque.

### Validation côté UI

Cohérente avec le serveur (cf. `03-backend.md`) :

- Taille max selon kind (toast d'erreur explicite : "Cette vidéo fait
  680 MB, la limite est 500 MB. Compresse-la avant l'envoi.")
- MIME refusé (toast : "Ce format n'est pas supporté. Formats acceptés :
  JPEG, PNG, WebP, AVIF, MP4, WebM, MP3.")
- Slug en conflit → suffixe `-2` proposé automatiquement, modifiable.

## Drawer détail

Slide-in depuis la droite (640 px de large, plein écran sur mobile).

### Structure

```
┌────────────────────────────────────────────────────────────────────┐
│ × kit-principale                                       Modifier ▾ │
├────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────┐                                         │
│ │                        │   Type      Image PNG                   │
│ │     [Aperçu HD]        │   Source    Upload                      │
│ │                        │   Statut    ✓ Optimisé                  │
│ │                        │   Importé   12 avr. 2026, 14:32         │
│ │                        │   Par       Yasmine                     │
│ └────────────────────────┘                                         │
│                                                                    │
│ ALT TEXT                                                           │
│ [Kit principal posé sur du linge brodé près d'une fenêtre.       ] │
│                                                                    │
│ LÉGENDE                                                            │
│ [_________________________________________________________________]│
│                                                                    │
│ TAGS                                                               │
│ [● kit] [● principal] [+ ajouter]                                 │
│                                                                    │
│ PROFIL DE QUALITÉ        ☐ Hero  ☑ Inline  ☐ Thumb                │
│ STRATÉGIE DE CHARGEMENT  ☐ Eager ☑ Viewport ☐ Idle ☐ Interaction  │
│                                                                    │
│ ▾ Variantes générées (12)                                         │
│ ▾ Override (avancé)                                                │
│ ▾ Usages (3 routes)                                               │
│ ▾ Métadonnées techniques                                           │
│ ▾ Journal (audit)                                                  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│   [Régénérer]  [Télécharger original]      [Supprimer]            │
└────────────────────────────────────────────────────────────────────┘
```

### Section "Variantes générées"

Tableau condensé :

| Format | Breakpoint | Dimensions | Qualité | Taille | Économie |
|---|---|---|---|---|---|
| AVIF | xs (480px) | 480×320 | 60 | 8.2 KB | -82% |
| AVIF | md (768px) | 768×512 | 60 | 18.4 KB | -78% |
| WebP | md | 768×512 | 70 | 24.7 KB | -71% |
| JPEG | md | 768×512 | 75 | 38.9 KB | -54% |
| … | | | | | |

Total : "94 KB pour 12 variantes au lieu de 2.1 MB original
(-95%)". Affiché en gros au-dessus du tableau.

Bouton "Voir cette variante" ouvre l'image dans un nouvel onglet.

### Section "Override (avancé)"

Bloc collapsé par défaut. Quand ouvert, formulaire :

- Profil de qualité override (override le contexte d'utilisation)
- Breakpoints personnalisés (multi-select xs/sm/md/lg/xl/2xl)
- Formats personnalisés (multi-select avif/webp/jpeg)
- Lazy loading override
- FetchPriority override
- BlurHash on/off
- Loader override (next / cloudflare / imgix)

Toute modification propose : "Ces changements demandent une
régénération des variantes (~3 sec). Régénérer maintenant ? [Oui] [Plus tard]"

### Section "Usages (X routes)"

Liste des `media_usages` :

```
/                           Hero               vu il y a 2h
/rituel                     Inline             vu il y a 1j
/admin/leads/{id}           Email template     jamais (tracking off)
```

Chaque ligne est cliquable → ouvre la route en nouvel onglet (avec
ancre vers le composant si `route` contient un fragment).

### Section "Journal (audit)"

Timeline des audit_events liés au média :

```
14:32  Importé par Yasmine (2.1 MB, kit-principale.png)
14:32  Optimisation lancée
14:35  Optimisée (12 variantes, 94 KB total, 3.2s)
15:01  Métadonnées modifiées (tags ajoutés : principal)
```

## Page dédoublonnage `/admin/media/duplicates`

Affiche les **clusters phash** (médias dont la distance de Hamming
≤ 5) sous forme de groupes :

```
┌────────────────────────────────────────────────────────────────────┐
│ Cluster 1 (3 médias quasi-identiques, distance moyenne 2 bits)    │
├────────────────────────────────────────────────────────────────────┤
│ [▣]  kit-principale            ✓ optimisé    18.4 KB    [Garder]  │
│ [▣]  kit-principale-v2         ⏳ en cours   pas encore  [Fusionner]│
│ [▣]  kit-principale-old        ✓ optimisé    18.4 KB    [Supprimer]│
└────────────────────────────────────────────────────────────────────┘
```

Actions :

- **Garder** = ce média est canonique, les autres sont fusionnés
  dedans (toutes leurs `media_usages` migrent vers ce media_id).
- **Fusionner** = idem mais en sens inverse.
- **Supprimer** = soft delete.
- **Ignorer ce cluster** = ajoute un flag pour ne plus le proposer.

## Réglages globaux `/admin/media/settings`

Page simple à 3 sections :

### Profils de qualité

```
HERO        AVIF q=70  WebP q=75  JPEG q=82       [Modifier]
INLINE      AVIF q=60  WebP q=70  JPEG q=75       [Modifier]
THUMB       WebP q=60  JPEG q=65                  [Modifier]
```

Modifier ouvre une modale avec sliders 50–95.

### Breakpoints

```
xs    480 px       Mobile
sm    640 px       Mobile large
md    768 px       Tablette
lg    1024 px      Tablette large
xl    1280 px      Desktop
2xl   1600 px      Desktop large
```

### Stratégie par défaut

```
Loading strategy   ◉ Viewport  ○ Eager  ○ Idle
SaveData fallback  ☑ Réduire qualité si saveData
Reduced motion     ☑ Désactiver fade-in si prefers-reduced-motion
```

Bouton "Enregistrer" → modal de confirmation : "Modifier ces
réglages relancera l'optimisation de **N médias** (estimé X minutes).
Continuer ?"

## Tokens design

Réutilise les tokens FemiGlow existants (`apps/web/src/styles/tokens.css`) :

| Token | Valeur | Usage |
|---|---|---|
| `--media-tile-bg` | `#f3ede4` (sable clair) | fond tile vide |
| `--media-tile-border` | `#e8d9c4` | bordure tile |
| `--media-badge-success` | `#7a9871` (vert sauge) | optimisé |
| `--media-badge-warning` | `#d4a574` (terracotta) | en cours |
| `--media-badge-error` | `#c97169` (rose tan) | erreur |
| `--media-badge-info` | `#8aa5b8` (bleu doux) | externe |
| `--media-badge-hero` | `#d4b878` (or) | hero |
| `--media-drawer-shadow` | `0 0 40px rgba(0,0,0,0.08)` | drawer |
| `--media-grid-gap` | `16px` desktop / `8px` mobile | grille |

## Iconographie

- 📷 → image
- 🎥 → vidéo
- 🎵 → audio
- ✓ → optimisé
- ⏳ → en cours
- ⚠ → erreur
- 🔗 → externe / URL
- ★ → hero
- ⚡ → eager / priorité haute
- 💤 → idle / chargement différé

Iconset : Lucide React (déjà dans le projet).

## Ergonomie clavier

- `↑↓←→` navigation dans la grille
- `Enter` ouvre le drawer
- `Esc` ferme le drawer
- `Cmd+A` sélectionne tout
- `Delete` soft delete (avec confirmation)
- `Cmd+R` régénère
- `/` focus sur la recherche

## États vides

- **Aucun média** : illustration centrée + bouton "Importer ton
  premier média".
- **Aucun résultat** : "Aucun média ne correspond à ces filtres. Essaie
  d'élargir tes critères ou d'importer de nouveaux médias."
- **Aucun doublon** : "Tout est unique, bravo. La déduplication est
  basée sur l'empreinte perceptuelle (phash)."

## États d'erreur

- **Réseau perdu pendant upload** : "Connexion perdue. Tes 3 fichiers
  en cours sont sauvegardés en local et seront repris automatiquement
  quand tu reviendras."
- **Pipeline en échec** : badge rouge sur le tile + tooltip "Échec
  d'optimisation : {raison}". Click → drawer avec bouton "Réessayer".
- **Quota Vercel atteint** : bandeau jaune en haut "Le stockage Vercel
  Blob est plein à 92%. Pense à archiver les anciens médias."

## Mobile (responsive)

- Drop zone occupe l'écran entier en mode upload.
- Grille passe à 2 colonnes (xs).
- Drawer devient plein écran avec un `<` retour en haut.
- Filtres regroupés dans un bouton "Filtres" qui ouvre un sheet bas.
- Bulk actions accessibles via long press.

## Conformité accessibilité

- Tous les contrôles sont labelisés (`aria-label` ou `<label>`).
- Focus visible (outline 2px sand-dark).
- Drawer a un `role="dialog"` + `aria-modal="true"` + focus trap.
- Tile a un `role="article"` avec heading `<h3>` (slug) + description.
- Couleurs des badges respectent un contraste ≥ 4.5:1 sur le fond.
- Pas de couleur seule pour transmettre une info (toujours icône +
  texte).
- jest-axe en CI (cf. `09-tests.md`).

## Performance UI

- Grille virtualisée (react-virtuoso) au-delà de 200 médias.
- Vignettes lazy-loaded (`loading="lazy"`).
- Drawer charge le détail à la demande (`useDrawerContent(id)`).
- Recherche debounced 200 ms côté client + 300 ms côté serveur.
- Pas de polling : refresh via `revalidatePath` après mutations.
