# Langage visuel

## 1. Tonalité

**Sérieux mais accessible.** L'outil pilote des intégrations critiques (Pixel Meta, Ads conversions). Le ton doit refléter :
- **Confiance** : signaler clairement les états sûrs vs. à risque.
- **Clarté** : pas d'ambiguïté sur ce qui se passe (preview JSON, diff visuel).
- **Calme** : pas de couleurs criardes ni d'animations agressives. L'admin réfléchit, ne fait pas une course.

À éviter :
- Couleurs néon ou saturées en grandes surfaces.
- Animations longues ou parasites (zoom-in dramatique).
- Densité d'information excessive (tableaux 10 colonnes par défaut).
- Jargon technique sans glossaire accessible.

## 2. Hiérarchie

Trois niveaux maximum d'attention visuelle dans un écran :
1. **Action principale** : CTA primaire (sauge intense, taille `lg`, position prominent).
2. **Information critique** : titre + statut santé.
3. **Détails secondaires** : metadata, timestamps, IDs techniques.

## 3. Motion

**Subtil, fonctionnel.** Animations < 300ms, easing `ease-out`.

| Élément | Animation |
|---|---|
| Step transition wizard | Slide horizontal 240ms |
| Toast apparition | Fade + slide-from-bottom 200ms |
| Modale ouverture | Fade backdrop + scale 0.96→1 en 200ms |
| Validation badge mise à jour | Fade + small bounce (max 8%) |
| Hover boutons | Background color 120ms |
| Skeleton loading | Pulse opacity 0.5 ↔ 1 sur 1.5s |
| Drift status change OK→Critical | Pulse rouge brief (3 cycles) puis stable |

**Respect `prefers-reduced-motion`** : toutes les animations désactivées (sauf fade discrets).

## 4. Illustrations

Pour les empty states uniquement. Style :
- Trait fin 2px, monochrome ou bichrome sauge/encre.
- Sujets : tableaux de bord stylisés, icônes outils empilées, drapeaux marocain en filigrane.
- Pas de photos, pas d'illustrations 3D.

Empty states :

| État | Illustration suggérée | Texte |
|---|---|---|
| Aucun plan | Tableau vide avec une feuille | "Créez votre premier plan de tracking pour commencer." |
| Aucun event activé | Liste vide avec icône loupe | "Aucun événement activé. Activez-en depuis la matrice." |
| Drift OK | Coche stylisée | "Tout est synchronisé." |

## 5. Density

**Espacement généreux par défaut.** Pas d'admin densité Excel.

- Padding cards : 24px (`p-6`).
- Gap entre sections : 32px (`gap-8`).
- Hauteur boutons : 40px min (touch friendly).
- Hauteur inputs : 40px min.
- Hauteur lignes de matrice : 48px min (touch friendly).

Mode "compact" optionnel (toggle) pour utilisateurs avancés sur grand écran :
- Padding cards : 16px.
- Gap : 16px.
- Hauteur inputs : 32px.

## 6. États visuels (récapitulatif)

| État | Couleur dominante | Icône |
|---|---|---|
| OK / Validé / Actif | Sauge `#5a8a6f` | ✓ CheckCircle2 |
| Warning | Ambre `#c08a3e` | ⚠ AlertTriangle |
| Error / Critical | Brique `#b54848` | ✗ AlertCircle |
| Info / Neutral | Encre `#2d2d2d` | ℹ Info |
| Saving / Pending | Gris stone-400 | ⟳ Loader (spin) |
| Disabled | Stone-300 + opacity 0.6 | (aucune) |

Toujours doubler la couleur par une icône + un texte. Jamais juste la couleur (a11y).

## 7. RTL (arabe)

- Layout en `dir="rtl"`.
- Stepper wizard : flèches inversées.
- Icônes directionnelles (`ChevronRight`, `ArrowRight`) miroitées.
- Padding/margin : utiliser `me-*`, `ms-*` (margin-end, margin-start) au lieu de `mr-*`, `ml-*`.
- Tests E2E spécifiques RTL (cf. tests).

## 8. Dark mode

**Pas en v1.** Préparation pour v2 :
- Tokens couleur définis par variables CSS.
- Composants n'utilisent jamais de couleurs hardcodées.
- Variable `--color-bg-page` pour fond global.

L'admin marketing utilise majoritairement en journée. Dark mode = v2.
