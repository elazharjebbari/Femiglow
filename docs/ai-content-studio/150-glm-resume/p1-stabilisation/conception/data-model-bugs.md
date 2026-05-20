# Bugs data model — Détails et corrections

## B1 : `insertReview` set toujours `needs_review`

### Problème

Dans `repository.ts`, ligne 457 :

```typescript
status: review.status === 'blocked' ? 'needs_review' : 'needs_review',
```

Les deux branches du ternaire sont identiques. Le draft passe toujours à `needs_review`, même si le review a un statut `passed`.

### Correction

Le comportement attendu est :
- Si le review a des violations bloquantes (`status: 'blocked'`) → le draft reste ou passe à `needs_review`
- Si le review passe (`status: 'passed'`) → le draft passe à `needs_review` (car c'est une étape de review, pas d'approbation)

En fait, le flux est : `generated` → review → `needs_review` (review ajouté) → l'utilisateur approuve → `approved`.

Donc le statut du draft doit être `needs_review` dans les deux cas (bloquant ou non), car le draft vient d'être review. Le bug est **cosmétique** dans le code mais le comportement est correct : le draft doit toujours être en `needs_review` après un review.

**Cependant**, ce qui doit changer c'est l'affichage : un draft avec violations bloquantes ne doit pas pouvoir être approuvé. C'est géré dans `service.ts` → `approveContentDraft()` qui vérifie les violations bloquantes.

### Action

Simplifier le ternaire en `status: 'needs_review'` pour rendre l'intention claire, et ajouter un commentaire explicatif.

---

## B2 : State machine jamais enforce

### Problème

`state-machine.ts` exporte `canTransition()` et `assertTransition()`, mais ces fonctions ne sont jamais appelées dans `service.ts` ou `repository.ts`.

Conséquences :
- Un draft en statut `idea` peut être approuvé directement sans passer par `generated` → `needs_review`
- Un post `scheduled` peut être repassé en `approved` sans annulation
- Les transitions invalides sont silencieusement acceptées

### Corrections nécessaires

1. **Dans `service.ts`** — appeler `assertTransition()` avant chaque changement de statut :
   - `generateIdeaDrafts()` : idea → generated
   - `reviewContentDraft()` : generated → needs_review
   - `approveContentDraft()` : needs_review → approved
   - `createDraftInPostiz()` : approved → scheduled

2. **Dans `repository.ts`** — ajouter une vérification dans `updateDraft()` et `updatePostPlanning()` :
   - Option A : vérifier dans le service uniquement (recommandé)
   - Option B : vérifier dans le repository aussi (double sécurité)

3. **Ajouter les transitions manquantes** :
   - `approved → approved` (annulation de schedule)
   - `scheduled → approved` (cancel schedule)
   - `needs_review → generated` (demander une nouvelle génération)

### Approche retenue

Option A : validation dans le service layer uniquement. Le repository reste un accès données pur. Les transitions sont validées dans `service.ts` avant chaque mutation de statut.

### Tests

Ajouter des tests dans `service.test.ts` qui vérifient :
- Les transitions valides passent
- Les transitions invalides jettent `HttpError('invalid_state')`
- Les transitions edge case (cancel schedule, request variation) fonctionnent