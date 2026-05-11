# 14 — Spécification UI du wizard d'import (admin)

Spécification détaillée frame par frame du wizard d'import dans l'admin `/admin/rituals/import`. C'est le **second wizard du composant** (le premier, public, est la soumission individuelle — `↗ 03-wizard-ui-specification.md`).

## 1. Cadrage général

### 1.1 Posture

Le wizard d'import est **administratif**. Il ne porte donc pas la voix « maison / rituel » à 100 % comme le wizard public. Il garde un ton professionnel mais respecte la palette et la typographie de l'admin :

- Inter Medium / Regular pour le corps.
- Cormorant Light pour les titres.
- Palette sauge / crème / encre.
- Pas d'emoji, pas d'icône type Material Design (préférer SVG inline simples : croix, chevron, check, upload, download).

### 1.2 Conteneur

L'import vit dans une **page admin classique**, pas dans un drawer. Layout pleine largeur (max-width 1200 px), 6 étapes navigables via une stepper sticky en haut.

Route : `/admin/rituals/import` (étape 1 par défaut) puis `/admin/rituals/import/[batchId]/[step]` pour les étapes ultérieures.

### 1.3 Stepper sticky

```
┌────────────────────────────────────────────────────────────────────┐
│  1. Source     2. Upload     3. Mappage    4. Aperçu    5. Commit  6. Rapport │
│     ●━━━━━━━━━━━━○━━━━━━━━━━━○━━━━━━━━━━━○━━━━━━━━━━━○━━━━━━━━━━━○  │
└────────────────────────────────────────────────────────────────────┘
```

- Position sticky top, fond crème, ombre subtle bottom.
- Étape courante : numéro en encre sur fond sauge, label Inter Medium 13 pt encre.
- Étapes futures : numéro en brume, label Inter Regular 13 pt brume.
- Étapes passées : numéro check `✓` sauge-dark sur fond crème, label cliquable pour revenir.
- Hauteur 64 px.

## 2. Étape 1 — Source

### 2.1 Frame

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Importer des rituels partagés                                      │
│  ─────────                                                          │
│                                                                     │
│  Quel format souhaitez-vous importer ?                              │
│                                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │   CSV   │  │  JSON   │  │  JSONL  │  │  TSV    │  │   ZIP   │   │
│  │  (.csv) │  │ (.json) │  │ (.jsonl)│  │  (.tsv) │  │ avec    │   │
│  │         │  │         │  │         │  │         │  │ photos  │   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │
│                                                                     │
│  ☐ Le fichier contient des en-têtes (header row)                    │
│                                                                     │
│  Téléchargez d'abord un modèle pour vérifier la structure attendue. │
│                                                                     │
│  [Télécharger un modèle CSV →]                                      │
│  [Télécharger un modèle JSON →]                                     │
│  [Télécharger un exemple ZIP →]                                     │
│                                                                     │
│  Voir la documentation des formats →                                │
│                                                                     │
│  ─────────                                                          │
│                                                                     │
│  [Continuer]                                                        │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tuiles format

5 tuiles en grid responsive (5 colonnes desktop, 3 tablet, 2 mobile, 1 sub-360).

| Élément | Style |
| --- | --- |
| Tuile | 160 × 120 px, fond crème pure, bordure 1,5 px sauge-pale, radius 0, padding 16 px |
| Format (titre) | Cormorant Light 24 pt encre, centré |
| Extension | Inter Regular 13 pt brume, centré |
| État hover | Fond sauge-pale, bordure sauge-dark |
| État actif | Fond sauge, bordure sauge-dark, texte encre |
| Focus | Outline 2 px encre offset 4 px |

### 2.3 Boutons « Télécharger un modèle »

```
[Télécharger un modèle CSV →]
```

- Inter Medium 13 pt encre.
- Underline subtle.
- Icône `→` typographique.
- Click → `GET /api/admin/rituals/import/template?format=csv` retourne le fichier.

3 modèles disponibles : CSV (semicolon par défaut), JSON, ZIP exemple avec une image factice. Cf. `↗ 15-import-templates-formats.md`.

### 2.4 Bouton « Continuer »

Disabled tant qu'aucun format choisi. Style identique au wizard public.

## 3. Étape 2 — Upload

### 3.1 Frame (CSV exemple)

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Importer des rituels partagés                                      │
│  Étape 2 — Upload du fichier                                        │
│  ─────────                                                          │
│                                                                     │
│  Format choisi : CSV                                                │
│  Séparateur : ⦿ Point-virgule (recommandé)                          │
│              ○ Virgule                                              │
│              ○ Tabulation                                           │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                                                             │    │
│  │            ⬆ Glisser un fichier ou cliquer                   │    │
│  │              pour parcourir                                  │    │
│  │                                                             │    │
│  │            Taille max 5 Mo, 500 rows max                    │    │
│  │            Format UTF-8 obligatoire                          │    │
│  │                                                             │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Une fois uploadé :                                                 │
│  ─ Le fichier est parsé en arrière-plan (10-30 sec)                │
│  ─ Aucun rituel n'est créé tant que vous n'avez pas validé l'aperçu │
│  ─ Vous pouvez modifier les rows une à une avant le commit           │
│                                                                     │
│  ─────────                                                          │
│                                                                     │
│  [← Retour]                          [En attente du fichier]        │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 Zone drop

| Élément | Style |
| --- | --- |
| Container | 100 % largeur, hauteur 200 px, padding 32 px |
| Bordure default | 1,5 px dashed sauge-pale |
| Bordure drag-over | 2 px solid sauge `#C5DBC4`, fond sauge-pale |
| Icône `⬆` | SVG inline 24 px, encre, centré |
| Texte principal | Cormorant Light 22 pt encre, centré |
| Texte secondaire | Inter Regular 13 pt brume, centré, max 360 px |
| Pendant upload | Bordure 2 px solid sauge, progress bar discrète en bas |

### 3.3 Pendant upload + parsing

```
┌────────────────────────────────────────────────┐
│                                                 │
│  ⏳ Parsing en cours…                            │
│                                                 │
│  rituels-mai-2026.csv  ●●●●●●●●○○○ 73%          │
│                                                 │
│  Lecture des lignes…                           │
│  87 / ~120 rows                                │
│                                                 │
│  Annuler                                       │
│                                                 │
└────────────────────────────────────────────────┘
```

- Spinner discret (pas d'animation agressive — fade lent 1 sec entre 0.6 et 1 opacity).
- Progress bar 1 px de hauteur, sauge sur ligne, anim linéaire.
- Compteur live (mis à jour via SSE ou polling 1 sec).
- Bouton « Annuler » → DELETE `/api/admin/rituals/import/[batchId]`.

### 3.4 Pendant vision ML (si ZIP)

Si ZIP avec photos, une seconde phase apparaît :

```
Photos extraites : 47
Vision ML en cours : 23 / 47

[En attente — vous pouvez fermer cet onglet, le travail continue]
```

L'admin peut quitter la page ; le job tourne en arrière-plan. Souheila revient ensuite à `/admin/rituals/import/[batchId]` pour reprendre.

### 3.5 Erreurs d'upload

| Erreur | Message |
| --- | --- |
| Fichier > 5 Mo | « Le fichier est trop volumineux. Limite : 5 Mo (ou 50 Mo pour ZIP). » |
| Format incorrect | « Ce fichier ne correspond pas au format CSV attendu. » |
| Encodage non UTF-8 | « Encodage non supporté. Veuillez convertir votre fichier en UTF-8 avant l'upload. » |
| ZIP sans manifest CSV/JSON | « L'archive doit contenir un fichier rituels.csv ou rituels.json à la racine. » |
| Trop de rows | « Ce fichier contient {n} rows. Maximum : 500. Veuillez splitter en plusieurs imports. » |

Affichées en bannière sauge-pale avec icône ⓘ encre, message Cormorant Italic 15 pt.

## 4. Étape 3 — Mappage colonnes

Affichée **uniquement si** les en-têtes du fichier ne matchent pas le modèle canonique. Sinon, sautée automatiquement.

### 4.1 Frame

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Étape 3 — Mappage des colonnes                                     │
│  ─────────                                                          │
│                                                                     │
│  Le fichier contient des en-têtes non reconnus.                     │
│  Indiquez à quel champ FemiGlow chaque colonne correspond.          │
│                                                                     │
│  ┌──────────────────────┬────────────────────────────────────┐     │
│  │ Colonne source        │ Champ cible                         │     │
│  ├──────────────────────┼────────────────────────────────────┤     │
│  │ Témoignage           │ [body ▾]              (obligatoire)  │     │
│  │ Recommandation       │ [wouldRecommend ▾]    (obligatoire)  │     │
│  │ Mots-clés            │ [ritualTags ▾]                       │     │
│  │ Prénom               │ [authorFirstName ▾]                  │     │
│  │ Ville                │ [authorCity ▾]                       │     │
│  │ Initiée depuis       │ [initiatedSince ▾]                   │     │
│  │ Photo                │ [photos[0] ▾]                        │     │
│  │ Note interne         │ [— Ignorer cette colonne — ▾]       │     │
│  └──────────────────────┴────────────────────────────────────┘     │
│                                                                     │
│  ╌╌╌╌                                                               │
│                                                                     │
│  Valeurs par défaut pour les champs vides                           │
│                                                                     │
│  productKey (par défaut)    [pack-femiglow ▾]                       │
│  language (par défaut)      [fr ▾]                                  │
│                                                                     │
│  ─────────                                                          │
│                                                                     │
│  [← Retour]                              [Continuer]                │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Liste des champs cibles disponibles

Affichés dans chaque `<select>` :

```
— Ignorer cette colonne —
body                          (obligatoire — texte 50-600 chars)
wouldRecommend                (obligatoire — oui|hesite|non)
ritualTags                    (liste séparée par , ou ;)
authorFirstName
authorCity
initiatedSince                (format YYYY-MM)
isAnonymous                   (boolean)
language                      (fr|ar)
photos[0]                     (filename ou URL)
photos[1]
photos[2]
```

Si un champ obligatoire (`body`, `wouldRecommend`) n'est mappé sur aucune colonne, `Continuer` reste disabled avec tooltip.

### 4.3 Détection automatique

Si l'en-tête est exactement un nom canonique (`body`, `would_recommend`, etc.) ou un nom évident (`prénom`, `recommandation`), le mappage est pré-rempli. Souheila n'a qu'à valider.

## 5. Étape 4 — Aperçu et corrections

C'est l'étape **la plus importante** du wizard. Souheila passe en revue chaque ligne avant commit.

### 5.1 Frame

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Étape 4 — Aperçu et corrections                                    │
│  ─────────                                                          │
│                                                                     │
│  ┌──── Synthèse globale ─────────────────────────────────┐         │
│  │ 123 rows parsées                                       │         │
│  │ ✓ 87 valides                                           │         │
│  │ ⚠ 28 avertissements (incluses par défaut)              │         │
│  │ ✗  8 erreurs (exclues par défaut)                      │         │
│  │ ⊜  3 doublons (de témoignages existants — exclus)       │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                     │
│  ┌──── Filtres ─────────────────────────────────────────┐          │
│  │ Tous  │  Valides  │  Avertissements  │  Erreurs  │  Doublons │  │
│  │  118       87          28               8           3        │  │
│  └────────────────────────────────────────────────────────┘         │
│                                                                     │
│  ┌──── Bulk actions ────────────────────────────────────┐          │
│  │ ☐ Tout sélectionner sur cette page                    │          │
│  │                                                       │          │
│  │ [Inclure ▾] [Exclure ▾] [Définir un défaut ▾]         │          │
│  │ [Régénérer vision ML ▾] [Supprimer ▾]                 │          │
│  └────────────────────────────────────────────────────────┘         │
│                                                                     │
│  ┌────┬──────────────────────────────────────────────────────────┐  │
│  │ ☐  │ Row 1 ✓ — Amal, Rabat                                     │  │
│  │    │ « Trois mois et l'ongle a retrouvé… »                    │  │
│  │    │ Signal : oui · Tags : ongles plus lisses                  │  │
│  │    │ Photos : amal-001.jpg (✓ OK)                              │  │
│  │    │ [Modifier] [Voir détails]                                 │  │
│  ├────┼──────────────────────────────────────────────────────────┤  │
│  │ ☐  │ Row 2 ⚠ — Yasmine, Casablanca                              │  │
│  │    │ « Cinq minutes le soir, devenu rituel… »                  │  │
│  │    │ Signal : oui · Tags : (tag inconnu "patience", ignoré)     │  │
│  │    │ Avertissement : tag "patience" non au catalogue           │  │
│  │    │ [Modifier] [Voir détails]                                 │  │
│  ├────┼──────────────────────────────────────────────────────────┤  │
│  │ ☐  │ Row 3 ✗ — (vide)                                            │  │
│  │    │ « court »                                                  │  │
│  │    │ Erreur : body trop court (< 50 caractères)                 │  │
│  │    │ Erreur : wouldRecommend vide                               │  │
│  │    │ [Modifier] [Voir détails]                                 │  │
│  ├────┼──────────────────────────────────────────────────────────┤  │
│  │ ☐  │ Row 4 ⊜ — Lina, Rabat                                       │  │
│  │    │ « ... »                                                   │  │
│  │    │ Doublon de : témoignage publié le 12 avril 2026            │  │
│  │    │ [Modifier] [Voir l'original]                              │  │
│  └────┴──────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [← Précédent]   Page 1 / 5   [Suivant →]                           │
│                                                                     │
│  ─────────                                                          │
│                                                                     │
│  [← Retour]                  [Continuer vers le commit]             │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 Synthèse globale (sticky top)

Bloc info en haut de l'étape, sticky au scroll. Indique en permanence le bilan.

| Élément | Style |
| --- | --- |
| Fond | Crème pure |
| Bordure | 1,5 px sauge-pale, padding 16 px |
| Chiffres | Inter Medium 16 pt, marqueurs `✓ ⚠ ✗ ⊜` de la même couleur que le statut associé |
| Total | Inter Regular 13 pt brume |

### 5.3 Filtres tabbed

Chips bar entre la synthèse et la liste. Chip actif = sauge.

### 5.4 Barre bulk actions

Visible dès qu'au moins 1 row est cochée. Sinon, masquée (fait place à plus de hauteur pour la liste).

Cf. `↗ 16-bulk-management.md` pour le détail des actions.

### 5.5 Lignes de preview (cards)

Chaque row est rendue comme une **card admin** avec :

| Zone | Contenu |
| --- | --- |
| Checkbox bulk | Coin haut-gauche |
| Statut visuel | Icône `✓` (sauge), `⚠` (champagne), `✗` (rouge feutre), `⊜` (brume) |
| Label row | `Row {index}` + signature courte si présente |
| Citation tronquée | 80 caractères max, ellipsis |
| Métadonnées | Signal, tags, photos avec statut vision ML |
| Erreurs / avertissements | Listés sous forme Inter 13 pt rouge-feutre ou champagne |
| Actions | `Modifier` (édition inline) + `Voir détails` (modale) |

Couleurs de fond :

- VALID : crème pure.
- WARNING : crème teinte champagne (5 % opacité).
- ERROR : crème teinte rouge feutre (5 % opacité).
- DUPLICATE : crème teinte brume (5 % opacité).

### 5.6 Modal d'édition d'une row

```
┌────────────────────────────────────────────────────────────┐
│  ✕  Modifier Row 3                                          │
│                                                             │
│  body *                                                     │
│  ┌──────────────────────────────────────────────────┐      │
│  │ court                                              │      │
│  └──────────────────────────────────────────────────┘      │
│  Erreur : body doit faire entre 50 et 600 caractères        │
│                                                             │
│  wouldRecommend *                                           │
│  ⦿ oui  ○ hesite  ○ non                                     │
│                                                             │
│  ritualTags                                                 │
│  ☐ Ongles plus lisses     ☐ Plaque souple                  │
│  ☐ Cuticules apaisées     ☐ Plus de casse                  │
│  ☐ Éclat naturel          ☐ Rituel devenu habitude         │
│                                                             │
│  authorFirstName                                            │
│  ┌──────────────────────────────────────────────────┐      │
│  │ (vide)                                            │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  authorCity                                                 │
│  [Rabat ▾]                                                  │
│                                                             │
│  initiatedSince                                             │
│  [Février ▾] [2026 ▾]                                       │
│                                                             │
│  isAnonymous                                                │
│  ☐ Signer anonymement                                       │
│                                                             │
│  Photos                                                     │
│  ┌──┐ ┌──┐ ┌──┐                                            │
│  │1 │ │2 │ │+ │                                            │
│  └──┘ └──┘ └──┘                                            │
│  Photo 1 ⚠ Visage détecté (MANUAL_REVIEW)                   │
│                                                             │
│  ──                                                         │
│                                                             │
│  ☐ Inclure cette row dans le commit                         │
│                                                             │
│  [Annuler]                          [Sauvegarder]           │
└────────────────────────────────────────────────────────────┘
```

Modale 600 px max-width, fond crème, bordure 1,5 px sauge-pale, shadow subtle. Champs identiques à ceux du wizard public mais sans la voix « initiée » (ici c'est admin → admin).

### 5.7 Pagination

Au-delà de 50 rows par page :

```
[← Précédent]   Page 1 / 5   [Suivant →]
```

ou pagination scroll infini optionnel selon préférence ergonomique. Recommandation : pagination classique (plus prédictible pour admin).

### 5.8 Bouton « Continuer vers le commit »

Disabled si :

- Aucune row INCLUDED.
- Le total INCLUDED contient des rows en status ERROR.

Au click → étape 5.

## 6. Étape 5 — Commit (confirmation)

### 6.1 Frame

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Étape 5 — Confirmation du commit                                   │
│  ─────────                                                          │
│                                                                     │
│  Vous êtes sur le point de créer 113 témoignages en statut PENDING. │
│                                                                     │
│  Détail :                                                           │
│  ─ 87 valides                                                      │
│  ─ 28 avec avertissements (acceptés)                                │
│  ─ Photos incluses : 67                                             │
│                                                                     │
│  Rituels exclus :                                                   │
│  ─ 8 en erreur (corrigeables après import si besoin)                │
│  ─ 3 doublons                                                       │
│                                                                     │
│  ─────────                                                          │
│                                                                     │
│  Note interne (optionnelle)                                         │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ Import depuis l'export WhatsApp mai 2026.                 │      │
│  │ Photos jointes : campagne shoot d'avril.                  │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ☐ Je comprends que les témoignages seront en attente de modération │
│    et que je peux les rejeter individuellement après import.        │
│                                                                     │
│  ─────────                                                          │
│                                                                     │
│  [← Retour à l'aperçu]                          [Confirmer le commit] │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 Pendant le commit

Spinner + message :

```
Commit en cours…
113 rituels créés
Photos liées : 67 / 67
Audit log inséré
```

Durée typique : 1 à 3 sec pour 100-500 rows.

### 6.3 Si erreur transactionnelle

```
✗ Le commit a échoué.

Erreur : Connection lost to database
Aucun rituel n'a été créé. Le batch reste en état PREVIEW.
Vous pouvez réessayer.

[Réessayer]   [Voir le détail technique]
```

## 7. Étape 6 — Rapport final

### 7.1 Frame

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ✓ Import réussi                                                    │
│  ─────────                                                          │
│                                                                     │
│  113 rituels ont été créés en statut PENDING.                       │
│                                                                     │
│  Vous pouvez maintenant :                                           │
│                                                                     │
│  [Voir les rituels dans la queue de modération →]                   │
│                                                                     │
│  ou                                                                 │
│                                                                     │
│  [Continuer un autre import →]                                      │
│                                                                     │
│  ─────────                                                          │
│                                                                     │
│  Détails du batch                                                   │
│                                                                     │
│  ID : batch-uuid                                                    │
│  Date : 11 mai 2026 17:42                                           │
│  Fichier : rituels-mai-2026.csv (4,3 Mo, 123 rows)                  │
│  Commit : 113 inclus, 10 exclus                                     │
│  Note : "Import depuis l'export WhatsApp mai 2026"                  │
│                                                                     │
│  ╌╌╌╌                                                               │
│                                                                     │
│  Rollback disponible pendant 24 heures.                             │
│  Au-delà, vous pouvez masquer individuellement.                     │
│                                                                     │
│  [Rollback l'import] (avec confirmation double)                     │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 7.2 Modal rollback

```
┌────────────────────────────────────────────────────────────┐
│  ⚠ Confirmer le rollback                                    │
│                                                             │
│  Cette action va masquer (status HIDDEN) les 113            │
│  témoignages créés par ce batch.                            │
│                                                             │
│  Ils ne seront pas supprimés (audit conservé) mais ne       │
│  seront plus visibles côté public.                          │
│                                                             │
│  Raison du rollback (obligatoire)                           │
│  ┌──────────────────────────────────────────────────┐      │
│  │                                                    │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ☐ Je confirme vouloir rollback ce batch                    │
│                                                             │
│  [Annuler]                          [Rollback définitif]    │
└────────────────────────────────────────────────────────────┘
```

## 8. Liste des imports passés

Page dédiée `/admin/rituals/import/history` (accessible depuis l'onglet Import) :

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Historique des imports                                             │
│  ─────────                                                          │
│                                                                     │
│  ┌────┬─────────────────┬───────┬──────┬────────────┬────────────┐  │
│  │    │ Fichier          │ Format│ Rows │ Statut      │ Date       │  │
│  ├────┼─────────────────┼───────┼──────┼────────────┼────────────┤  │
│  │ ●  │ rituels-mai-2026 │ CSV   │ 113  │ COMMITTED  │ il y a 2 h │  │
│  │    │ par Souheila     │       │      │ (113/123)  │            │  │
│  ├────┼─────────────────┼───────┼──────┼────────────┼────────────┤  │
│  │ ◐  │ test-import     │ JSON  │ —    │ PREVIEW    │ hier       │  │
│  │    │ par Souheila     │       │      │ en attente │            │  │
│  ├────┼─────────────────┼───────┼──────┼────────────┼────────────┤  │
│  │ ✓  │ partner-photos  │ ZIP   │  47  │ COMMITTED  │ 8 mai      │  │
│  │    │ par Souheila     │       │      │ rolled back│            │  │
│  └────┴─────────────────┴───────┴──────┴────────────┴────────────┘  │
│                                                                     │
│  [Nouvel import]                                                    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

Chaque ligne cliquable → vue détaillée du batch.

## 9. États du wizard

| État | Description |
| --- | --- |
| `step1_format_selection` | Étape 1, aucun format choisi |
| `step1_ready` | Format choisi, bouton Continuer actif |
| `step2_idle` | Étape 2, en attente d'upload |
| `step2_uploading` | Upload en cours, progress visible |
| `step2_parsing` | Parsing serveur |
| `step2_vision_ml` | Vision ML en cours sur photos |
| `step2_error` | Erreur d'upload ou parsing |
| `step3_mapping` | Mappage colonnes ouvert |
| `step4_preview_loading` | Chargement des rows |
| `step4_preview_ready` | Rows affichées, navigation possible |
| `step4_row_editing` | Modal d'édition ouvert |
| `step5_commit_confirm` | Étape 5 affichée |
| `step5_committing` | Commit en cours (spinner) |
| `step5_commit_error` | Échec, possibilité de réessayer |
| `step6_report` | Rapport final |
| `step6_rollback_confirm` | Modal rollback ouvert |
| `step6_rolled_back` | Rollback effectué |

## 10. Comportement responsive

L'import wizard est principalement utilisé sur desktop. Sur mobile :

- Stepper sticky devient un menu déroulant (« Étape 4 sur 6 ▾ »).
- Liste des rows en aperçu en cards verticales (1 row par ligne).
- Bulk actions en bottom sheet quand sélection active.
- Modal d'édition en plein écran.

Acceptable que l'expérience mobile soit moins fluide — l'import volumineux se fait sur ordinateur.

## 11. Accessibilité

| Critère | Application |
| --- | --- |
| Stepper | `<nav aria-label="Étapes">` avec liste ordonnée |
| Tuiles format | `<button>` avec `aria-pressed` |
| Zone drop | `<div role="button" tabIndex={0}>` + input file masqué |
| Tableau bulk | `<table>` avec `<thead>` `<tbody>`, checkbox accessible |
| Modal édition | `role="dialog"`, focus trap, ESC ferme |
| Progress | `<progress>` ou `role="progressbar"` avec `aria-valuenow` |
| Statut row | Couleur + icône + texte (jamais couleur seule) |
| Bulk select all | `aria-checked="mixed"` si sélection partielle |

axe-core sur chaque étape vert.

## 12. Animations

Plus sobres que le wizard public (c'est admin). Toutes ≤ 200 ms.

| Action | Durée |
| --- | --- |
| Bascule entre étapes | 200 ms fade-cross |
| Apparition modale row edit | 200 ms scale + opacity |
| Hover tuile / row | 150 ms |
| Skeleton row pendant fetch | Pulse 1,5 sec (sauf reduced motion) |
| Progress bar | Animation linéaire |

`prefers-reduced-motion: reduce` désactive tout > 80 ms.

## 13. Microcopy admin (extrait)

| Surface | Texte |
| --- | --- |
| Titre page | « Importer des rituels partagés » |
| Étape 1 question | « Quel format souhaitez-vous importer ? » |
| Tooltip ZIP | « Idéal si vous avez des photos à attacher » |
| Drop zone | « Glisser un fichier ou cliquer pour parcourir » |
| Étape 4 synthèse | « 113 valides · 28 avertissements · 8 erreurs · 3 doublons » |
| Statut row valid | `✓ Valide` |
| Statut row warning | `⚠ {n} avertissement(s)` |
| Statut row error | `✗ {n} erreur(s)` |
| Statut row duplicate | `⊜ Doublon de {ref}` |
| Bulk action exclude_errors | « Exclure toutes les rows en erreur » |
| Confirm commit | « Je comprends que les témoignages seront en attente de modération » |
| Confirmation success | « ✓ Import réussi — {n} rituels créés en PENDING » |
| Rollback warning | « Cette action va masquer (status HIDDEN) les {n} témoignages créés » |
| Error globale | « Une erreur est survenue. Le batch est conservé, vous pouvez réessayer. » |

Catalogue complet à intégrer dans `↗ 12-microcopy-voix.md`.

## 14. Tests UI dédiés

| Test | Niveau |
| --- | --- |
| Étape 1 : choix format active bouton Continuer | Jest |
| Étape 2 : drop fichier > 5 Mo → message d'erreur | Jest |
| Étape 2 : upload réel → spinner → étape 3 ou 4 | Playwright |
| Étape 3 : mapping → continuer → étape 4 | Playwright |
| Étape 4 : filtre `Erreurs` réduit la liste | Jest + MSW |
| Étape 4 : bulk « exclure erreurs » | Jest + MSW |
| Étape 4 : édition row modifie le statut | Jest + MSW |
| Étape 5 : confirm → spinner → étape 6 | Playwright |
| Étape 6 : rollback double confirmation | Jest |
| A11y : axe-core sur chaque étape | Playwright + axe |
| Performance : commit 500 rows < 3 sec | Playwright |

## 15. Synthèse — règles d'or wizard import

1. **6 étapes max** : Source / Upload / Mapping / Preview / Commit / Rapport.
2. **Stepper sticky** toujours visible.
3. **Aucun commit sans preview**.
4. **Rollback disponible 24 h**, double confirmation obligatoire.
5. **Bulk actions** dispo dès qu'au moins 1 row sélectionnée.
6. **Édition inline** par row possible avant commit.
7. **Statuts visuels par couleur + icône + texte** (jamais couleur seule).
8. **Vision ML en arrière-plan** ; l'admin peut quitter et revenir.
9. **Templates téléchargeables** dès l'étape 1.
10. **Historique des imports** consultable et auditable.
