# Phase 5 — Step Progression + Bouton Valider

## Objectif
Faire progresser le stepper de manière cohérente avec `draft.status` et débloquer le `postId` via un bouton explicite "Valider et préparer la publication".

## Durée estimée
1.5 j-p (dev) + 0.5 j (tests)

## Dépendances
- Phase 1 (StudioContext.mockMode pour MockBadge)

## Changements

### 1. Refactor `Stepper.tsx`

Supprimer la logique conditionnelle hack :

```ts
// AVANT
if (base === 'visual' && hasMedia && draft.caption.trim().length > 0) return 'validate';

// APRÈS
export function deriveActiveStep(draft: ContentDraft | null | undefined): StepKey {
  if (!draft) return 'frame';
  return STATUS_TO_STEP[draft.status] ?? 'frame';
}
```

Ajouter prop `mockMode` + badge + tooltips :

```tsx
<Stepper draft={draft} mockMode={mockMode} onStepClick={scrollToSection} />

// Inside :
<ol>
  {/* Header avec MockModeBadge si mockMode */}
  {mockMode ? <MockModeBadge /> : null}
  {STEPS.map((step, idx) => (
    <li>
      <button
        disabled={isFuture}
        aria-disabled={isFuture ? 'true' : undefined}
        title={isFuture ? `Complétez l'étape ${STEPS[idx - 1]?.label ?? 'précédente'} pour continuer` : undefined}
        onClick={() => isFuture ? null : onStepClick?.(step.key)}
      >
        ...
      </button>
    </li>
  ))}
</ol>
```

### 2. Auto-review au select variante

`VariantsCompare` ne change pas. C'est le parent (`CreateWorkspace.tsx`) qui ajoute l'appel review.

```tsx
// CreateWorkspace.tsx
async function handleSelectVariant(v: VariantViewModel) {
  selectDraft(v.draft.id);
  upsertDraft(v.draft);

  // Auto-review (status → needs_review)
  try {
    const res = await fetch(`/api/admin/content-studio/drafts/${v.draft.id}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.draft) upsertDraft(json.draft);
    }
  } catch (e) {
    // graceful : sélection conservée même si review échoue
    console.warn('Auto-review failed', e);
  }
}

<VariantsCompare onSelect={handleSelectVariant} ... />
```

### 3. Nouveau composant `ApproveButton.tsx`

Voir `features/F13-approval-postid/spec.md` pour le squelette.

### 4. Intégrer `ApproveButton` dans `PreviewPane`

```tsx
// PreviewPane.tsx
import { ApproveButton } from './ApproveButton';

interface PreviewPaneProps {
  draft: ContentDraft | null;
  media: StudioV2MediaItem | null;
  brandBlocked: boolean;
  onApproved: (post: ContentPost) => void;
  // ... existing
}

return (
  <section data-section="validate">
    {/* ... existing preview render */}

    {/* Bouton Valider */}
    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
      <ApproveButton
        draft={draft}
        hasMedia={Boolean(media)}
        brandBlocked={brandBlocked}
        onApproved={onApproved}
      />
    </div>
  </section>
);
```

### 5. Wiring dans `CreateWorkspace.tsx`

```tsx
function handleApproved(post: ContentPost) {
  upsertPost(post);
  // Optionnel : scroll vers PublishActionGroup
  setTimeout(() => {
    document.querySelector('[aria-label="Publier"]')?.scrollIntoView({ behavior: 'smooth' });
  }, 200);
}

const brandViolations = useMemo(() => fetchReviewViolations(selectedDraftId), [selectedDraftId]);
const brandBlocked = brandViolations.some(v => v.severity === 'blocked');

<PreviewPane
  draft={selectedDraft}
  media={selectedMedia}
  brandBlocked={brandBlocked}
  onApproved={handleApproved}
/>
```

### 6. Scroll behavior

```tsx
function scrollToSection(key: StepKey) {
  const el = document.querySelector(`[data-section="${key}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Focus first interactive element
  const firstInput = el?.querySelector('input,select,textarea,button:not([disabled])') as HTMLElement | null;
  firstInput?.focus();
}

// Marquer les sections :
<section data-section="frame"><IntentionForm /></section>
<section data-section="generate"><VariantsCompare /></section>
<section data-section="visual"><MediaStudio /></section>
<section data-section="validate"><PreviewPane /></section>
```

## Tests

### Component
- `Stepper.test.tsx` : tests mis à jour (drift hack supprimé)
- `ApproveButton.test.tsx` : nouveau (10 tests)
- `VariantsCompare.test.tsx` : ajout test auto-review trigger

### Contract
- `drafts-review.contract.test.ts` : idempotent on already-reviewed
- `drafts-approve.contract.test.ts` : no_media_attached, brand_blocked

### E2E
- `create-step-progression.spec.ts` (S04)
- `create-golden-path.spec.ts` (S01)

## Acceptance

- [ ] Stepper utilise uniquement `draft.status`
- [ ] Sélection variante → auto POST /review → status='needs_review'
- [ ] Bouton "Valider et préparer" visible dans PreviewPane
- [ ] Click Valider → POST /approve → post créé → PublishActionGroup débloqué
- [ ] Cliquer sur step passé scrolle vers la section
- [ ] Steps futurs ont tooltip explicatif
- [ ] 0 fail tests Phase 5
