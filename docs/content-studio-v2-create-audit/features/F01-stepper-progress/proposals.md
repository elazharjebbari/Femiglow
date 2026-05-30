# F01 — Propositions

## Option A — Maintenir le hack `deriveActiveStep`

Garder la logique actuelle qui regarde `hasMedia + caption.trim()` pour avancer visuellement à validate.

### Forces
- Aucun changement code
- L'UX semble fluide

### Faiblesses
- Drift UI vs status persiste
- Pas de fix réel — palliatif visuel

### Pertinence
Solution refusée.

## Option B — Pure `draft.status` + transitions appelées explicitement

Le Stepper lit `draft.status` uniquement. Les transitions sont déclenchées par :
- `POST /drafts/:id/review` au select variante (auto)
- `POST /drafts/:id/approve` au click "Valider et préparer"

### Forces
- Source de vérité unique
- Audit fidèle
- Pas de hack

### Faiblesses
- Nécessite des modifications dans `VariantsCompare` et `PreviewPane` (cf F05 et F13)

### Pertinence
**Recommandée** (cf P02 — Status-driven strict).

## Option C — Step state explicite côté Context

Maintenir un `currentStep` directement dans le contexte StudioProvider, mis à jour par les composants (pas dérivé du status).

### Forces
- Découplage UI / état métier
- Tests UI plus simples

### Faiblesses
- Drift possible si les composants oublient de mettre à jour
- Pas d'audit
- Casse le single-source-of-truth principle

### Pertinence
Solution refusée.

## Recommandation finale

**Option B**. Détails :

1. Supprimer la logique conditionnelle dans `deriveActiveStep`
2. Retourner simplement `STATUS_TO_STEP[draft.status]`
3. Ajouter prop `mockMode` au Stepper, rendre badge dans le header
4. `cursor:not-allowed` remplacé par tooltip explicatif + `aria-disabled`
5. `onStepClick(key)` côté parent : scrollIntoView smooth vers la section correspondante
