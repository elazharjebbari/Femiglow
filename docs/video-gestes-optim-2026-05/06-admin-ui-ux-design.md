# 06 — Design admin UI/UX

Éditeur dédié `/admin/kit/video` pour piloter l'URL YouTube, les chapitres, le poster custom, la provenance, l'affichage durée et la couleur d'accent.

Livré en **phase 6** du plan (cf. `08-plan-action-phases.md`). Réutilise les patterns admin existants livrés dans le plan SEO (`docs/seo-action-plan-2026-05/`).

## 1. Architecture des écrans

### 1.1 Route

| Route | Type | Rôle |
|---|---|---|
| `/admin/kit/video` | RSC editor | Éditeur singleton (un seul rituel vidéo par site) |

Pas de page liste : la section vidéo est unique sur `/kit`.

### 1.2 Composants nouveaux

| Composant | Rôle |
|---|---|
| `KitVideoEditor.tsx` | Formulaire principal |
| `VideoChaptersEditor.tsx` | Sub-form d'édition des chapitres (drag/drop ou ordre numérique) |
| `VideoPreviewCard.tsx` | Aperçu live en haut-droite (reprend `VideoPosterCover` + `VideoChapters`) |
| `KitVideoResetDialog.tsx` | Modale confirmation reset (saisie `RESET-VIDEO`) |

### 1.3 Layout

Layout 2 colonnes desktop (édition gauche / preview droite), accordéon mobile.

```
+-----------------------------------------------------------+
|  En-tête : [← Retour] Rituel vidéo (singleton)            |
|            Statut : Brouillon · Dernière modif : …       |
+----------------------------+------------------------------+
|  Colonne édition (gauche)  |  Colonne preview (droite)   |
|                            |                              |
|  ▾ Source vidéo            |  VideoPreviewCard            |
|     YouTube URL * [    ]   |  (poster + bouton + chapters)|
|     ↳ vidéo détectée : OK  |                              |
|                            |                              |
|  ▾ Identité éditoriale     |                              |
|     Provenance [    ]      |                              |
|     Durée display [    ]   |                              |
|     Accent color o o o o   |                              |
|                            |                              |
|  ▾ Poster custom (overlay) |                              |
|     [Médiapicker]          |                              |
|     ↳ aperçu 380×675       |                              |
|                            |                              |
|  ▾ Chapitres (4)           |                              |
|     #01  Paste    [00:00]  |                              |
|     #02  Powder   [00:18]  |                              |
|     #03  Step 4   [00:42]  |                              |
|     #04  Polissage[01:08]  |                              |
|     [+ Ajouter chapitre]   |                              |
|                            |                              |
+----------------------------+------------------------------+
|  Pied : [Annuler] [Enregistrer] [Publier] [Reset]         |
+-----------------------------------------------------------+
```

## 2. Champs et validation

| Champ | Type | Obligatoire | Limites | Validation Zod |
|---|---|---|---|---|
| `youtubeUrl` | URL | Oui | URL parsable (`parseYouTubeUrl`) | `z.string().url().refine(parsable)` |
| `provenance` | string | Non | 1-120 chars + ponctuation finale | `regex(/[.!?»]$/)` |
| `durationDisplay` | string | Non | 1-8 chars | `min(1).max(8)` |
| `accentColor` | enum | Non | sauge/petale/ciel/champagne | `subProductAccentColorSchema` |
| `posterCustomMediaId` | string | Non | mediaId existant | `min(1).nullable()` |
| `chapters` | array | Non | 2-6 entrées, triées | `array(videoChapterSchema)` + `refine` |
| `chapters[].key` | slug | Oui (si chapter présent) | kebab-case max 40 | `regex` |
| `chapters[].label` | string | Oui | 1-24 chars | `min(1).max(24)` |
| `chapters[].startSeconds` | int | Oui | 0-600 | `int().min(0).max(600)` |

## 3. États du formulaire

| État | Visuel | Action |
|---|---|---|
| `clean` | Save désactivé | — |
| `dirty` | Save actif `bg-encre` | Save crée brouillon |
| `saving` | Spinner + texte « Enregistrement… » | bloqué |
| `saved-draft` | Toast vert « Brouillon enregistré » + bandeau « Brouillon » | Publish actif |
| `published` | Bandeau « Publié à HH:mm » | Reset visible |
| `error` | Banner rouge + retry | Retry / correction |
| `reset-confirm` | Modale `RESET-VIDEO` à saisir | Confirm supprime override |

## 4. Microcopy (voix maison, aucun emoji)

- Save success : `Brouillon enregistré. Le rendu public reste sur la version publiée.`
- Publish success : `Publié. La section vidéo de /kit est en cours d'actualisation.`
- Unpublish : `Override retiré. La version par défaut reprend.`
- Reset confirm : `Effacer définitivement l'override de la section vidéo ? La version par défaut reprend immédiatement.`
- Empty state chapitres : `Aucun chapitre renseigné. Cliquez sur « Ajouter » pour démarrer.`
- Field hint provenance : `Phrase courte qui ancre la vidéo dans la maison. Termine par un point ou un guillemet »`.
- Field hint chapter label : `Maximum 24 caractères. Mot court qui tient sur la timeline mobile.`
- Field hint startSeconds : `Position en secondes (entier). Doit être ≥ chapitre précédent.`

## 5. Design tokens

| Élément | Couleur | Source |
|---|---|---|
| Fond admin | Crème | `#FBF8F1` |
| Card form | Blanc | `#FFFFFF` |
| Bordure | Gris-sauge | `#C7CCC2` |
| Action principale | Encre | `#2C2A28` |
| Action destructive | Rose 600 (Tailwind) | — |
| Focus ring | Champagne 40 % | `#C8A876` 40 % |
| Bandeau publié | Sauge 20 % | `#A8B89E` 20 % |

## 6. Accessibilité

- Tous les inputs ont `<label htmlFor>` associé.
- Erreurs Zod affichées avec `aria-invalid="true"` + `aria-describedby` pointant le message.
- Modale reset : `role="dialog"`, focus trap, fermeture `Escape`.
- Navigation clavier complète, raccourcis `Cmd+S` (save), `Cmd+Enter` (publish si valid).
- `VideoChaptersEditor` : chaque chapitre est une `<fieldset>` avec `<legend>` numéroté, navigation flèches haut/bas pour réordonner.

## 7. Workflow utilisateur

### 7.1 Parcours nominal

```
1. /admin/kit/video
   → Form pré-rempli (override DB ou mock fallback)
2. Édition URL YouTube
   → Détection live : "vidéo YouTube détectée OK" en vert
   → Aperçu poster (thumbnail YouTube) auto-rempli en attendant posterCustom
3. Saisie provenance + durationDisplay + accentColor
   → Aperçu live mis à jour
4. Édition chapitres
   → Validation côté UI : startSeconds croissants
5. Upload poster custom via médiapicker
   → Aperçu remplace la thumbnail YouTube
6. Save → toast "Brouillon enregistré"
7. Publish → toast "Publié"
8. Vérification /kit dans un nouvel onglet
```

### 7.2 Parcours de retour à la version maison

```
1. /admin/kit/video → bouton Reset
2. Modale demande RESET-VIDEO
3. Confirm → DELETE override + audit log
4. Le rendu /kit retombe sur le mock TS
```

## 8. Composants à créer

| Composant | Phase |
|---|---|
| `apps/web/src/app/admin/kit/video/page.tsx` | 6 |
| `apps/web/src/components/admin/kit/KitVideoEditor.tsx` | 6 |
| `apps/web/src/components/admin/kit/VideoChaptersEditor.tsx` | 6 |
| `apps/web/src/components/admin/kit/VideoPreviewCard.tsx` | 6 |
| `apps/web/src/components/admin/kit/KitVideoResetDialog.tsx` | 6 |
| API routes `/api/admin/kit/video/*` | 6 |
| Hook `useKitVideoDraft` | 6 |

## 9. Tests UX

| Test | Type |
|---|---|
| Form se charge avec valeurs courantes | Vitest + MSW |
| Save → PATCH appelé avec body Zod valide | Vitest + MSW |
| URL YouTube invalide → erreur affichée | Vitest |
| Chapitres non triés → erreur de validation | Vitest |
| Modale reset bloque tant que `RESET-VIDEO` n'est pas tapé | Vitest |
| Publish déclenche `revalidateTag('kit-video')` (mock) | Vitest + MSW |
| Aperçu live met à jour à chaque keystroke | Vitest |
| Parcours nominal complet | Playwright |
| A11y axe sur la page | Playwright |
