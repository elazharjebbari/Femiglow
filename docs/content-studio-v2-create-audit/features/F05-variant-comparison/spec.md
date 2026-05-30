# F05 — Comparaison de Variantes

## Objectif
Permettre à l'opérateur de comparer 3 variantes générées, voir les différences textuelles, les scores brand review, et choisir laquelle continuer à enrichir.

## Comportement attendu
- 3 cartes en grille horizontale (1/3 chacune)
- Pour chaque carte :
  - Badge variantLabel (A/B/C)
  - Score brand review (XX/100) en mono
  - Hook en titre display
  - Caption tronquée (max 220px scroll)
  - Liste des violations brand (warning ou bloquant)
  - Bouton "Choisir cette variante" (primary si non-sélectionnée) ou "Sélectionnée" (secondary check)
  - Bouton "Rejeter" (ghost, ouvre dialog)
- Toggle "Voir les différences" : highlight word-level diff vs variante A

## Effet du clic "Choisir"
1. `selectDraft(id)` dans le contexte
2. **NEW** : `POST /drafts/:id/review` en arrière-plan → met le draft à `needs_review`
3. Stepper avance à 'visual'

## Effet du clic "Rejeter"
1. Dialog avec textarea optionnelle "Raison du rejet"
2. `POST /drafts/:id/reject` avec `{ reason }`
3. Draft retiré de la liste localement

## Comportement actuel
Fichier : `apps/web/src/components/admin/content-studio-v2/create/VariantsCompare.tsx`

Fonctionnel sauf : la sélection ne déclenche PAS `/drafts/:id/review`. Le draft reste à `generated`.

## Gaps
- G05 : pas d'auto-review au select (adressé ici)
- F05-LOCAL-1 : les violations brand sont visibles mais leur sévérité (warning/blocked) n'est pas toujours claire
- F05-LOCAL-2 : pas de tri par score (la variante avec le meilleur score n'est pas mise en avant)

## Propositions

### A — Auto-review au select
Quand l'utilisateur clique "Choisir", appel parallèle `POST /drafts/:id/review` (déjà existant côté backend). Réponse incluse dans le state.

### B — Bouton dédié "Confirmer le choix" en plus
Step explicite : sélection variante → bouton dédié "Confirmer" → review.

### C — Auto-review lazy + visual indicator
Sélection immédiate, review déclenché par un effet quand draft.status='generated' depuis > 500ms après sélection.

## Recommandation
**A** — déclenchement direct au click. Sémantiquement attendu (sélectionner = soumettre au review).

## Implementation

### Fichiers à modifier
1. `apps/web/src/components/admin/content-studio-v2/create/VariantsCompare.tsx`
2. `apps/web/src/components/admin/content-studio-v2/create/CreateWorkspace.tsx`

### CreateWorkspace.tsx
```tsx
async function handleSelectVariant(v: VariantViewModel) {
  selectDraft(v.draft.id);
  upsertDraft(v.draft);
  // Auto-review
  try {
    const res = await fetch(`/api/admin/content-studio/drafts/${v.draft.id}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      upsertDraft(json.draft); // status now 'needs_review'
    }
  } catch (e) {
    // Non-bloquant : on garde la sélection locale même si review échoue
    console.warn('Review failed', e);
  }
}

<VariantsCompare onSelect={handleSelectVariant} ... />
```

### Sort by score
```tsx
const sortedVariants = useMemo(
  () => variants.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
  [variants]
);
```

### Indicateur sévérité
Déjà présent via badges color, mais ajouter un texte explicite : "⚠ Avertissement" ou "🛑 Bloquant".

## Tests
Voir `test-scenarios.yaml`.
