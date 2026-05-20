# 06 — Design admin UI/UX

Éditeur dédié `/admin/kit/composition` pour piloter nom, volume, description, sensation, ingrédients, certifications, image isolated + contextual des 3 sous-produits.

Livré en **phase 6** du plan (cf. `08-plan-action-phases.md`).

## 1. Architecture des écrans

### 1.1 Routes admin

| Route | Type | Rôle |
|---|---|---|
| `/admin/kit/composition` | RSC index | Liste des 3 sous-produits + statut (override / mock) |
| `/admin/kit/composition/[id]` | RSC editor | Éditeur d'un sous-produit |

Pas de page « new » : les 3 ids (`1-paste`, `2-powder`, `polissoir-step-4`) sont fixés par le mock. Le contrat reste 3 cards.

### 1.2 Composants nouveaux

| Composant | Rôle |
|---|---|
| `KitCompositionList.tsx` | Liste 3 cards : nom, statut, dernière modif, action |
| `KitCompositionEditor.tsx` | Formulaire d'un sous-produit (le cœur du module) |
| `IngredientsListEditor.tsx` | Édition de la liste `ingredients` (composants imbriqués) |
| `CertificationsListEditor.tsx` | Édition `certifications` (rang minimum, courte) |
| `AccentColorPicker.tsx` | Sélection enum (4 radios) avec preview color chip |
| `CompositionPreviewCard.tsx` | Mini-render de la card pour aperçu temps réel |
| `KitCompositionResetDialog.tsx` | Modale confirmation reset (saisie `RESET-<id>`) |

### 1.3 Layout

Layout 2 colonnes desktop (édition gauche / preview droite), accordéon mobile.

```
+-----------------------------------------------------------+
|  En-tête : [← Retour] Sous-produit : « Paste »            |
|            Statut : Brouillon  ·  Dernière modif : ...    |
+----------------------------+------------------------------+
|  Colonne édition (gauche)  |  Colonne preview (droite)   |
|                            |                              |
|  ▾ Identité                |  CompositionPreviewCard      |
|     Nom * [    ]           |  (mini-render live)          |
|     Volume * [    ]        |                              |
|     Sensation [    ]       |                              |
|     AccentColor o o o o    |                              |
|                            |                              |
|  ▾ Description             |                              |
|     ShortDescription *     |                              |
|                            |                              |
|  ▾ Image isolée            |                              |
|     [Médiapicker]          |                              |
|                            |                              |
|  ▾ Image contextuelle      |                              |
|     [Médiapicker]          |                              |
|                            |                              |
|  ▾ Ingrédients (4)         |                              |
|     - Cera Alba 12 % ...   |                              |
|     - Tocopherol ...       |                              |
|     [+ Ajouter]            |                              |
|                            |                              |
|  ▾ Certifications (3)      |                              |
|     - Halal — HCC          |                              |
|     [+ Ajouter]            |                              |
|                            |                              |
+----------------------------+------------------------------+
|  Pied : [Annuler] [Enregistrer] [Publier] [Reset]         |
+-----------------------------------------------------------+
```

## 2. Champs et validation

| Champ | Type | Obligatoire | Limites | Validation Zod |
|---|---|---|---|---|
| `name` | string | Oui | 1-80 | `z.string().min(1).max(80)` |
| `volume` | string | Oui | 1-20 | `z.string().min(1).max(20)` |
| `shortDescription` | text | Oui | 1-280 | `z.string().min(1).max(280)` |
| `sensation` | string | Non | 1-80, ponctuation finale | `z.string().min(1).max(80).regex(/[.!?»]$/)` |
| `accentColor` | enum | Non | sauge / petale / ciel / champagne | `z.enum([...])` |
| `image` | image picker | Oui | mediaId existant | `z.string().min(1)` |
| `contextualImage` | image picker | Non | mediaId existant ou null | `z.string().nullable()` |
| `ingredients` | array | Oui | min 1 | `z.array(ingredientDetailedSchema).min(1)` |
| `certifications` | array | Oui | min 0 | `z.array(certificationSchema)` |

## 3. États du formulaire

| État | Visuel | Action utilisateur |
|---|---|---|
| `clean` | Save désactivé | Pas d'action |
| `dirty` | Save actif `bg-encre` | Save crée brouillon |
| `saving` | Save bouton spinner + texte « Enregistrement… » | Aucune (bloqué) |
| `saved-draft` | Toast vert « Brouillon enregistré » + statut bandeau « Brouillon » | Publish actif |
| `published` | Statut bandeau « Publié à HH:mm » | Reset visible, Publish désactivé tant que clean |
| `error` | Banner rouge avec message + bouton retry | Retry, ou correction des champs invalides |
| `reset-confirm` | Modale `RESET-<id>` à saisir | Confirm supprime override, retour au mock |

## 4. Aperçu temps réel — `CompositionPreviewCard`

Réutilise `CompositionCard` (frontend public) mais alimenté par le state du form, pas par un `subProduct` final :

```tsx
<CompositionCard
  subProduct={previewSubProduct}    // dérivé du state du form
  index={0}                         // toujours 01 dans l'aperçu
  detailsHref="#"
  isolatedSlot={<img src={imageSrc} alt={imageAlt} />}
  contextualSlot={contextualImageSrc ? <img src={contextualImageSrc} alt="..." /> : undefined}
/>
```

Aperçu **non-interactif** : pas de scroll-reveal, pas de hover (à arbitrer ou désactiver pour ne pas perturber l'éditeur).

## 5. Microcopy

Aucun emoji, ton maison.

- Save success : `Brouillon enregistré. Le rendu public reste sur la version publiée.`
- Publish success : `Publié. Le cache public est en cours d'actualisation.`
- Unpublish : `Override retiré. La version « maison » reprend.`
- Reset confirm : `Effacer définitivement l'override de ce sous-produit ? La version mock TS reprend immédiatement.`
- Empty state ingredients : `Aucun ingrédient renseigné. Cliquez sur « Ajouter » pour démarrer.`
- Field hint sensation : `Phrase courte qui décrit ce que ressent l'initiée. Termine par un point ou un guillemet français »`.
- Field hint accentColor : `Couleur du numéro en pastille. Reprend la dominante de l'objet.`

## 6. Design tokens

| Élément | Couleur | Source |
|---|---|---|
| Fond admin | Crème `#FBF8F1` | Charte FemiGlow |
| Fond carte form | Blanc `#FFFFFF` | Admin convention |
| Bordure | gris-sauge `#C7CCC2` | Annexe A playbook |
| Action principale | Encre `#2C2A28` | Convention admin |
| Action destructive (Reset) | Rose 600 (Tailwind) | Convention admin |
| Focus ring | Champagne `#C8A876` à 40% opacité | Convention admin (cf. autres modales) |
| Bandeau publié | Sauge `#A8B89E` à 20% | Cohérence visuelle |

## 7. Accessibilité

- Tous les inputs ont `<label htmlFor>` associé.
- Erreurs Zod affichées avec `aria-invalid="true"` + `aria-describedby` pointant l'erreur.
- Modale reset avec `role="dialog"`, `aria-modal="true"`, focus trap, fermeture sur `Escape`.
- Navigation clavier : `Tab` ordre logique, raccourcis `Cmd+S` (save), `Cmd+Enter` (publish si dirty=false).
- AccentColorPicker : `role="radiogroup"`, `aria-checked` sur chaque option.

## 8. Workflow utilisateur

### 8.1 Parcours nominal

```
1. /admin/kit/composition
   → Liste 3 cards avec statut, dernière modif
2. Click sur « Paste »
   → /admin/kit/composition/1-paste
   → Form pré-rempli avec valeurs courantes (override DB ou mock fallback)
3. Édition champs
   → Aperçu live à droite
   → Linter de champs (longueur, ponctuation sensation, etc.)
4. Save → toast « Brouillon enregistré »
5. Publish → toast « Publié »
6. Vérification via /kit dans un nouvel onglet
```

### 8.2 Parcours de retour à la version maison

```
1. /admin/kit/composition/1-paste
2. Click « Reset »
3. Modale confirmation : saisir `RESET-1-paste`
4. Click « Confirmer »
   → DELETE de l'override
   → Le rendu public retombe sur le mock TS
   → Audit log `composition.reset` avec `meta.previous`
```

## 9. Composants à créer ou modifier

| Composant | Type | Phase |
|---|---|---|
| `KitCompositionList.tsx` | Page index admin | 6 |
| `KitCompositionEditor.tsx` | Page éditeur | 6 |
| `CompositionPreviewCard.tsx` | Wrapper du CompositionCard public | 6 |
| `AccentColorPicker.tsx` | Custom radio group | 6 |
| `IngredientsListEditor.tsx` | Sub-form | 6 |
| `CertificationsListEditor.tsx` | Sub-form | 6 |
| `KitCompositionResetDialog.tsx` | Modale confirm (saisie token) | 6 |
| API routes `/api/admin/kit/composition/*` | Backend | 6 |
| Hook `useKitCompositionDraft` | Stateful form helper | 6 |

## 10. Tests UX

| Test | Type |
|---|---|
| Index liste 3 cards | Vitest |
| Édition save → API PATCH appelé avec body Zod valide | Vitest + MSW |
| Save échec validation → erreur visible | Vitest + MSW |
| Aperçu live met à jour à chaque keystroke | Vitest + Testing Library |
| Modale reset bloque si token ≠ `RESET-<id>` | Vitest |
| Publish déclenche revalidateTag (mockée) | Vitest + MSW |
| Parcours nominal complet | Playwright |
| A11y axe sur 2 pages | Playwright |

Détails complets dans `07-tests-strategy.md`.
