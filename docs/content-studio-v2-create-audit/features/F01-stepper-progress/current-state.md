# F01 — Current State

## Fichier
`apps/web/src/components/admin/content-studio-v2/create/Stepper.tsx`

## Ce qui marche
- 4 étapes rendues avec libellés/descriptions corrects
- Lecture `draft.status` → étape active via `STATUS_TO_STEP`
- Aria : `aria-current="step"`, `aria-label`
- Connecteurs visuels entre steps
- Steps passées avec Check icon (vert)
- Active step en couleur accent
- Step click fonctionne pour les états past/active

## Ce qui ne marche pas

### G05 — Hack `deriveActiveStep`
```ts
if (base === 'visual' && hasMedia && draft.caption.trim().length > 0) {
  return 'validate';
}
```
Cette logique avance visuellement le step à `validate` même si `draft.status` reste à `needs_review`. Conséquence : drift entre UI et état métier.

### G10 — `cursor: not-allowed` agressif
```ts
cursor: isFuture ? 'not-allowed' : 'pointer'
```
Pas de tooltip explicatif. L'utilisateur ne sait pas pourquoi le step est bloqué.

### Pas de badge Mock
Le composant ne reçoit pas l'info `mockMode`.

### Navigation rétrograde sans scroll
`onStepClick` est passé mais le parent (`CreateWorkspace`) ne l'utilise pas pour scroller / focuser.

## Tests existants
- `Stepper.test.tsx` (6 tests) — couvre rendu, états, navigation past/future
- Aucun test pour mockMode ou ré-orchestration parent
