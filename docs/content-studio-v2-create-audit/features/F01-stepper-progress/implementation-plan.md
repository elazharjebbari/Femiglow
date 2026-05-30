# F01 — Implementation Plan

## Fichiers à modifier

1. `apps/web/src/components/admin/content-studio-v2/create/Stepper.tsx`
2. `apps/web/src/components/admin/content-studio-v2/create/CreateWorkspace.tsx`
3. `apps/web/src/components/admin/content-studio-v2/create/Stepper.test.tsx`

## Étapes

### 1. Refactor Stepper.tsx
```tsx
// Remove: deriveActiveStep with hasMedia/caption.trim hack
// Add: mockMode prop, MockModeBadge in header

export function deriveActiveStep(draft: ContentDraft | null | undefined): StepKey {
  if (!draft) return 'frame';
  return STATUS_TO_STEP[draft.status] ?? 'frame';
}

interface StepperProps {
  draft?: ContentDraft | null;
  mockMode?: boolean;
  onStepClick?: (step: StepKey) => void;
}

// In render:
{mockMode ? <MockModeBadge /> : null}
```

### 2. Tooltips on disabled steps
```tsx
<button
  disabled={isFuture}
  aria-disabled={isFuture ? 'true' : undefined}
  title={isFuture ? `Complétez l'étape ${STEPS[idx - 1].label} pour continuer` : undefined}
>
```

### 3. Wire scroll in parent
```tsx
// CreateWorkspace.tsx
function scrollToSection(key: StepKey) {
  const el = document.querySelector(`[data-section="${key}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

<Stepper draft={selectedDraft} mockMode={mockMode} onStepClick={scrollToSection} />

// Mark sections:
<section data-section="frame">...IntentionForm</section>
<section data-section="generate">...VariantsCompare</section>
<section data-section="visual">...MediaStudio</section>
<section data-section="validate">...PreviewPane + PublishActionGroup</section>
```

### 4. Source mockMode
Add to StudioContext :
```tsx
const [mockMode, setMockMode] = useState(false);
useEffect(() => {
  fetch('/api/admin/content-studio/health')
    .then(r => r.json())
    .then(j => setMockMode(j?.mockMode === true))
    .catch(() => {});
}, []);
```

### 5. New component `MockModeBadge.tsx`
```tsx
export function MockModeBadge() {
  return (
    <span
      role="status"
      aria-label="Mode mock activé"
      style={{
        display: 'inline-flex', gap: 6, alignItems: 'center',
        padding: '4px 10px',
        background: 'var(--cs-warning-bg)', color: 'var(--cs-warning)',
        borderRadius: 'var(--cs-radius-full)',
        fontSize: 11, fontWeight: 500,
      }}
    >
      <Sparkles size={12} />
      Mode mock — actions simulées
    </span>
  );
}
```

### 6. Tests
Mettre à jour `Stepper.test.tsx` :
- Retirer tests fondés sur hasMedia/caption
- Ajouter test mockMode badge
- Ajouter test tooltip sur step future

## Validation
- `pnpm vitest run src/components/admin/content-studio-v2/create/Stepper.test.tsx` → 0 fail
- E2E : `e2e/content-studio-v2/create-step-progression.spec.ts` couvre F01
