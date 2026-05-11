# 05 — Plan d'action frontend

Découpage des livrables frontend (côté client/visiteur) en tâches atomiques avec fichiers, contrats, tests et critères de fini.

## 1. Inventaire des livrables

| # | Domaine | Livrable | Localisation |
| --- | --- | --- | --- |
| F1 | Tokens | Tokens CSS spécifiques wall | `apps/web/src/styles/tokens.css` (append) |
| F2 | Tokens | Tailwind extends | `apps/web/tailwind.config.ts` |
| F3 | Composants UI | `RitualCard` (compact + default) | `apps/web/src/components/sections/rituals/RitualCard.tsx` |
| F4 | Composants UI | `RitualsModule` (pur) | `.../RitualsModule.tsx` |
| F5 | Composants UI | `RitualsModuleBound` (RSC) | `.../RitualsModuleBound.tsx` |
| F6 | Composants UI | `RitualsModuleSkeleton` | `.../RitualsModuleSkeleton.tsx` |
| F7 | Composants UI | `RitualsWallDrawer` | `.../RitualsWallDrawer.tsx` |
| F8 | Composants UI | `RitualsWallHeader` | `.../RitualsWallHeader.tsx` |
| F9 | Composants UI | `RitualsWallSummary` | `.../RitualsWallSummary.tsx` |
| F10 | Composants UI | `RitualsWallFilters` | `.../RitualsWallFilters.tsx` |
| F11 | Composants UI | `RitualsWallList` | `.../RitualsWallList.tsx` |
| F12 | Composants UI | `RitualsWallLoadMore` | `.../RitualsWallLoadMore.tsx` |
| F13 | Composants UI | `RitualsWallEmptyState` | `.../RitualsWallEmptyState.tsx` |
| F14 | Composants UI | `RitualsWallFooter` | `.../RitualsWallFooter.tsx` |
| F15 | Composants UI | `RitualPolicyView` | `.../RitualPolicyView.tsx` |
| F16 | Composants UI | `RitualPhotoLightbox` | `.../RitualPhotoLightbox.tsx` |
| F17 | Composants UI | `RitualsWizard` (orchestrateur) | `.../wizard/RitualsWizard.tsx` |
| F18 | Composants UI | `Step1Voice` | `.../wizard/Step1Voice.tsx` |
| F19 | Composants UI | `Step2Details` | `.../wizard/Step2Details.tsx` |
| F20 | Composants UI | `Step3Signature` | `.../wizard/Step3Signature.tsx` |
| F21 | Composants UI | `WizardConfirmation` | `.../wizard/WizardConfirmation.tsx` |
| F22 | Composants UI | `WizardDraftResumeModal` | `.../wizard/WizardDraftResumeModal.tsx` |
| F23 | Composants UI | `WizardFaceAlertModal` | `.../wizard/WizardFaceAlertModal.tsx` |
| F24 | Composants UI | `PhotoUploadZone` | `.../wizard/PhotoUploadZone.tsx` |
| F25 | Composants UI | `PhotoThumbnail` | `.../wizard/PhotoThumbnail.tsx` |
| F26 | Hooks | `useRitualsList` | `apps/web/src/lib/rituals/hooks/use-rituals-list.ts` |
| F27 | Hooks | `useRitualsSummary` | `.../use-rituals-summary.ts` |
| F28 | Hooks | `useRitualWizard` | `.../use-ritual-wizard.ts` |
| F29 | Hooks | `usePhotoUpload` | `.../use-photo-upload.ts` |
| F30 | Hooks | `useTrackRitual` | `.../use-track-ritual.ts` |
| F31 | Hooks | `useDraftStorage` | `.../use-draft-storage.ts` |
| F32 | Hooks | `useWallUrlState` | `.../use-wall-url-state.ts` |
| F33 | Insertion | `RitualsModuleBound` dans `/kit` | `apps/web/src/app/(marketing)/kit/page.tsx` |

## 2. Architecture des composants (résumé)

```
                          /kit page (RSC)
                                │
                                ▼
                      <RitualsModuleBound>     (server fetch summary + featured)
                                │
                                ▼
                      <RitualsModule>          (pur, props injectées)
                          │       │
                          │       │
              <RitualCard compact> × 3
                          │
                          ▼
                    "Lire les N rituels →"     (button)
                                │
                                ▼ click
                      <RitualsWallDrawer>      (dynamic import, CSR)
                          │
                ┌─────────┼─────────┬──────────┬──────────┐
                ▼         ▼         ▼          ▼          ▼
        <Header>  <Summary>  <Filters>  <List>     <Footer>
                                          │
                                          ▼
                                <RitualCard default> × N
                                          │
                                <RitualsWallLoadMore>
                          │
                          ▼ click "Partager"
                      <RitualsWizard>          (orchestrateur)
                          │
              <DraftResumeModal>?
                          │
              ┌───────────┼───────────────────┐
              ▼           ▼          ▼          ▼
          <Step1Voice><Step2Details><Step3Signature><WizardConfirmation>
                          │
                  <FaceAlertModal>?
                  <PhotoUploadZone>
                  <PhotoThumbnail> × 3
```

## 3. Phase F1-F2 — Tokens design

### 3.1 Référence

Cf. `↗ annexes/decisions-design-tokens.md` (catalogue complet).

### 3.2 Checklist

- [ ] Ajouter le bloc `/* === Rituals Wall === */` à la fin de `apps/web/src/styles/tokens.css`.
- [ ] Étendre `tailwind.config.ts` avec spacings, fontSize, colors, transitionDuration spécifiques.
- [ ] Vérifier qu'aucun token globalement utilisé n'est altéré (no breaking change).

### 3.3 Test visuel

Storybook story `Tokens/Wall` qui rend chaque token en plot visible :

```tsx
<div className="bg-ritual-card-bg border-[1.5px] border-ritual-card-border p-ritual-card">
  card sample
</div>
```

### 3.4 DoD

- ✓ Tokens disponibles dans Tailwind.
- ✓ Storybook story affiche correctement.

## 4. Phase F3 — RitualCard

### 4.1 Props

```ts
type RitualCardProps = {
  data: RitualTestimonialPublic;
  variant: 'compact' | 'default';
  onPhotoClick?: (photoIndex: number) => void;
  onImpression?: () => void;
  isHighlighted?: boolean;
};
```

### 4.2 Comportements

| Variant | Photo position | Photo size | Texte position |
| --- | --- | --- | --- |
| `compact` | Au-dessus | 100 % largeur, ratio 4:5 | Sous photo |
| `default` | Float left | 80 × 80 px | Wrap autour |

### 4.3 Tests Vitest

`apps/web/src/components/sections/rituals/__tests__/RitualCard.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { RitualCard } from '../RitualCard';

const fixture = {
  publicSlug: 'amal-001',
  body: 'Trois mois et l’ongle a retrouvé sa nervure...',
  wouldRecommend: 'oui',
  ritualTags: ['ongles-plus-lisses'],
  signature: {
    firstName: 'Amal',
    city: 'Rabat',
    initiatedSince: '2026-02',
    isAnonymous: false,
    verifiedPurchase: true,
  },
  language: 'fr',
  photos: [],
  publishedAt: '2026-05-01T10:00:00Z',
};

describe('RitualCard variant=compact', () => {
  it('affiche la citation', () => {
    render(<RitualCard data={fixture} variant="compact" />);
    expect(screen.getByText(/Trois mois et l’ongle/)).toBeInTheDocument();
  });

  it('affiche la signature avec nom et ville', () => {
    render(<RitualCard data={fixture} variant="compact" />);
    expect(screen.getByText(/Amal, Rabat/)).toBeInTheDocument();
    expect(screen.getByText(/Initiée depuis février 2026/i)).toBeInTheDocument();
  });

  it('affiche le badge Reviendrait si signal oui', () => {
    render(<RitualCard data={fixture} variant="compact" />);
    expect(screen.getByText('Reviendrait')).toBeInTheDocument();
  });

  it('cache le badge si signal hesite', () => {
    render(<RitualCard data={{ ...fixture, wouldRecommend: 'hesite' }} variant="compact" />);
    expect(screen.queryByText('Reviendrait')).not.toBeInTheDocument();
  });

  it('affiche signature anonyme si isAnonymous', () => {
    render(<RitualCard data={{
      ...fixture,
      signature: { ...fixture.signature, firstName: null, isAnonymous: true }
    }} variant="compact" />);
    expect(screen.getByText(/Une initiée, Rabat/)).toBeInTheDocument();
  });

  it('passe l’audit axe-core', async () => {
    const { container } = render(<RitualCard data={fixture} variant="compact" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### 4.4 DoD

- ✓ 7+ tests verts.
- ✓ Story Storybook avec 6 variantes.
- ✓ axe-core sans violation.

## 5. Phase F4-F6 — Module compact

### 5.1 `RitualsModuleBound` (RSC)

```tsx
// apps/web/src/components/sections/rituals/RitualsModuleBound.tsx
import { Suspense } from 'react';
import { getRitualSummary, listRituals } from '@/lib/db/queries/rituals';
import { RitualsModule } from './RitualsModule';
import { RitualsModuleSkeleton } from './RitualsModuleSkeleton';

export async function RitualsModuleBound({ productKey }: { productKey: string }) {
  const [summary, featured] = await Promise.all([
    getRitualSummary(productKey),
    listRituals({ productKey, featured: true, limit: 3 }),
  ]);

  // Fallback si moins de 3 featured
  if (featured.items.length < 3) {
    const fallback = await listRituals({
      productKey,
      withPhotos: true,
      sort: 'recent',
      limit: 3 - featured.items.length,
    });
    featured.items = [...featured.items, ...fallback.items];
  }

  if (featured.items.length === 0) return null; // Pas de témoignages → pas de module

  return <RitualsModule summary={summary} cards={featured.items.slice(0, 3)} />;
}

export function RitualsModuleSuspense({ productKey }: { productKey: string }) {
  return (
    <Suspense fallback={<RitualsModuleSkeleton />}>
      <RitualsModuleBound productKey={productKey} />
    </Suspense>
  );
}
```

### 5.2 Insertion `/kit`

```tsx
// apps/web/src/app/(marketing)/kit/page.tsx
import { RitualsModuleSuspense } from '@/components/sections/rituals/RitualsModuleBound';

export default function KitPage() {
  return (
    <>
      {/* Hero ... */}
      {/* Composition slow reveal ... */}

      <RitualsModuleSuspense productKey="pack-femiglow" />

      {/* Comparatif ... */}
      {/* FAQ ... */}
    </>
  );
}
```

### 5.3 Tests

```tsx
import { render, screen } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { rest } from 'msw';
import { RitualsModule } from '../RitualsModule';

describe('RitualsModule', () => {
  it('rend 3 cards et le lien', () => {
    const summary = { totalCount: 26, ouiCount: 24, ... };
    const cards = [card1, card2, card3];
    render(<RitualsModule summary={summary} cards={cards} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Lire les 26 rituels/ })).toBeInTheDocument();
  });

  it('singularise si 1 témoignage', () => {
    const summary = { totalCount: 1, ouiCount: 1 };
    render(<RitualsModule summary={summary} cards={[card1]} />);
    expect(screen.getByText(/Une initiée a partagé son rituel/)).toBeInTheDocument();
  });

  it('empty state si 0 témoignage', () => {
    render(<RitualsModule summary={{ totalCount: 0 }} cards={[]} />);
    expect(screen.getByText(/La maison écoute/)).toBeInTheDocument();
  });
});
```

### 5.4 DoD

- ✓ Module rendu sur `/kit` en dev.
- ✓ Lighthouse `/kit` LCP non dégradé.

## 6. Phase F7-F15 — Drawer et ses sous-composants

### 6.1 `RitualsWallDrawer` (orchestrateur)

```tsx
'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useWallUrlState } from '@/lib/rituals/hooks/use-wall-url-state';
import { useRitualsSummary } from '@/lib/rituals/hooks/use-rituals-summary';
import { useTrackRitual } from '@/lib/rituals/hooks/use-track-ritual';

export function RitualsWallDrawer() {
  const { isOpen, view, filters, scrollTo, close, setView, setFilters } = useWallUrlState();
  const { data: summary } = useRitualsSummary('pack-femiglow', { enabled: isOpen });
  const track = useTrackRitual();

  useEffect(() => {
    if (isOpen) {
      track('ritual_wall_open', { entry_point: detectEntryPoint() });
    }
  }, [isOpen]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="ritual-overlay" />
        <Dialog.Content
          className="ritual-drawer"
          aria-describedby={undefined}
        >
          {view === 'list' && (
            <>
              <RitualsWallHeader onClose={close} />
              <RitualsWallSummary summary={summary} />
              <RitualsWallFilters value={filters} onChange={setFilters} />
              <RitualsWallList filters={filters} scrollTo={scrollTo} />
              <RitualsWallFooter onShareClick={() => setView('wizard')} />
            </>
          )}
          {view === 'wizard' && (
            <RitualsWizard onClose={close} onSuccess={() => setView('list')} />
          )}
          {view === 'policy' && (
            <RitualPolicyView onBack={() => setView('list')} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### 6.2 Tests

```tsx
describe('RitualsWallDrawer', () => {
  it('s’ouvre quand l’URL contient ?wall=open', async () => {
    renderWithRouter(<RitualsWallDrawer />, { searchParams: '?wall=open' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ESC ferme le drawer', async () => {
    const router = createMockRouter();
    renderWithRouter(<RitualsWallDrawer />, { router, searchParams: '?wall=open' });
    await userEvent.keyboard('{Escape}');
    expect(router.replace).toHaveBeenCalledWith(expect.not.stringContaining('wall='));
  });

  it('focus trap actif (Tab boucle)', async () => {
    renderWithRouter(<RitualsWallDrawer />, { searchParams: '?wall=open' });
    const closeBtn = screen.getByRole('button', { name: /Fermer/i });
    closeBtn.focus();
    // tab through filters, list, load more, share, cta buy, policy link → back to close
    for (let i = 0; i < 10; i++) {
      await userEvent.tab();
    }
    expect(document.activeElement).toBe(closeBtn); // boucle
  });

  it('passe en mode wizard sur click Partager mon rituel', async () => {
    renderWithRouter(<RitualsWallDrawer />, { searchParams: '?wall=open' });
    await userEvent.click(screen.getByRole('button', { name: /Partager mon rituel/i }));
    expect(screen.getByText(/Étape 1 — Votre voix/)).toBeInTheDocument();
  });
});
```

### 6.3 DoD

- ✓ Drawer accessible (axe-core vert).
- ✓ URL state synchro.
- ✓ Tests verts.

## 7. Phase F17-F25 — Wizard et sous-composants

### 7.1 `RitualsWizard` orchestrateur

```tsx
'use client';
import { useRitualWizard } from '@/lib/rituals/hooks/use-ritual-wizard';
import { useDraftStorage } from '@/lib/rituals/hooks/use-draft-storage';

export function RitualsWizard({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { state, setBody, setSignal, setTags, addPhoto, removePhoto, setSignature, submit, goToStep } = useRitualWizard();
  const { hasDraft, restore, discard } = useDraftStorage();
  const [showResumeModal, setShowResumeModal] = useState(hasDraft);

  return (
    <>
      {showResumeModal && (
        <WizardDraftResumeModal
          onResume={() => { restore(); setShowResumeModal(false); }}
          onRestart={() => { discard(); setShowResumeModal(false); }}
          onDismiss={() => setShowResumeModal(false)}
        />
      )}
      {state.step === 1 && <Step1Voice state={state} onUpdate={setBody} onSignalChange={setSignal} onContinue={() => goToStep(2)} onSubmitNow={() => submit()} onBack={onClose} />}
      {state.step === 2 && <Step2Details ... />}
      {state.step === 3 && <Step3Signature ... />}
      {state.step === 'confirmation' && <WizardConfirmation onContinue={onSuccess} />}
    </>
  );
}
```

### 7.2 Hook `useRitualWizard`

```ts
type WizardState = {
  step: 1 | 2 | 3 | 'confirmation';
  body: string;
  wouldRecommend: 'oui' | 'hesite' | 'non' | null;
  ritualTags: string[];
  photos: PhotoState[];
  authorFirstName: string;
  authorCity: string;
  initiatedSince: { month: number; year: number } | null;
  isAnonymous: boolean;
  emailToken: string | null;
  isSubmitting: boolean;
  submitError: string | null;
};

export function useRitualWizard() {
  const [state, setState] = useState<WizardState>(initialState);
  const track = useTrackRitual();

  // Auto-save
  useEffect(() => {
    const id = setInterval(() => {
      saveDraft(state);
    }, 15000);
    return () => clearInterval(id);
  }, [state]);

  const setBody = (body: string) => {
    const { sanitized, hadEmojis } = sanitizeBodyClient(body);
    if (hadEmojis) {
      showToast('Les émoticônes ne sont pas dans notre grammaire.');
      track('ritual_submit_emoji_stripped', { count: countEmojis(body) });
    }
    setState((s) => ({ ...s, body: sanitized }));
  };

  const submit = async () => {
    setState((s) => ({ ...s, isSubmitting: true }));
    try {
      const result = await fetch('/api/rituals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFromState(state)),
      });
      if (!result.ok) throw new Error((await result.json()).error.code);
      setState((s) => ({ ...s, step: 'confirmation', isSubmitting: false }));
      track('ritual_submit_success', { /* ... */ });
      clearDraft();
    } catch (e: any) {
      setState((s) => ({ ...s, isSubmitting: false, submitError: e.message }));
      track('ritual_submit_error', { error_code: e.message });
    }
  };

  return { state, setBody, setSignal: (...), ... };
}
```

### 7.3 Tests Step1Voice

```tsx
describe('Step1Voice', () => {
  it('compteur de mots évolue en temps réel', async () => {
    render(<Step1Voice {...defaultProps} />);
    const textarea = screen.getByRole('textbox', { name: /Qu’est-ce que le rituel/ });
    await userEvent.type(textarea, 'Trois mois et l’ongle');
    expect(screen.getByText('5 / 50 mots')).toBeInTheDocument();
  });

  it('emoji retiré + toast affiché', async () => {
    render(<Step1Voice {...defaultProps} />);
    const textarea = screen.getByRole('textbox', { name: /Qu’est-ce que le rituel/ });
    await userEvent.type(textarea, 'Super 😊');
    expect(textarea).toHaveValue('Super ');
    expect(screen.getByText(/Les émoticônes ne sont pas/)).toBeInTheDocument();
  });

  it('bouton Continuer disabled si body < 50 caractères', () => {
    render(<Step1Voice {...defaultProps} state={{ body: 'court', wouldRecommend: null }} />);
    expect(screen.getByRole('button', { name: /Continuer/ })).toBeDisabled();
  });

  it('bouton Continuer enabled si body >= 50 et signal choisi', async () => {
    const state = { body: 'a'.repeat(50), wouldRecommend: 'oui' };
    render(<Step1Voice {...defaultProps} state={state} />);
    expect(screen.getByRole('button', { name: /Continuer/ })).toBeEnabled();
  });

  it('click Soumettre tel quel appelle onSubmitNow', async () => {
    const onSubmitNow = vi.fn();
    const state = { body: 'a'.repeat(50), wouldRecommend: 'oui' };
    render(<Step1Voice {...defaultProps} state={state} onSubmitNow={onSubmitNow} />);
    await userEvent.click(screen.getByText('Soumettre tel quel →'));
    expect(onSubmitNow).toHaveBeenCalled();
  });

  it('axe-core passe sur tous les états', async () => {
    const { container } = render(<Step1Voice {...defaultProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

### 7.4 DoD wizard

- ✓ Toutes les étapes implémentées.
- ✓ Tests Vitest > 90 % couverture.
- ✓ Brouillon localStorage 7 jours.
- ✓ Pré-remplissage depuis emailToken.
- ✓ Storybook 8 stories minimum.

## 8. Phase F26-F32 — Hooks

### 8.1 `useRitualsList`

```ts
export function useRitualsList(productKey: string, filters: WallFilters) {
  return useInfiniteQuery({
    queryKey: ['rituals', 'list', productKey, filters],
    queryFn: ({ pageParam }) => fetchRitualList({ productKey, ...filters, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (last) => last.meta.nextCursor,
    staleTime: 60_000,
  });
}
```

### 8.2 `usePhotoUpload`

```ts
export function usePhotoUpload() {
  const [uploads, setUploads] = useState<PhotoUploadState[]>([]);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('PHOTO_TOO_LARGE');
    }

    const compressed = await compressClient(file, 0.85);
    const formData = new FormData();
    formData.append('photo', compressed);

    const local = { id: crypto.randomUUID(), status: 'uploading' as const, progress: 0 };
    setUploads((u) => [...u, local]);

    try {
      const res = await fetch('/api/rituals/upload-photo', { method: 'POST', body: formData });
      const data = await res.json();
      setUploads((u) => u.map(x => x.id === local.id ? { ...x, status: 'processing', blobKey: data.blobKey, thumbUrl: data.thumbUrl } : x));
      // Poll for face status
      const result = await pollFacesStatus(data.blobKey);
      setUploads((u) => u.map(x => x.id === local.id ? { ...x, status: result.facesStatus.toLowerCase() } : x));
    } catch (e) {
      setUploads((u) => u.map(x => x.id === local.id ? { ...x, status: 'error', error: e.message } : x));
    }
  };

  return { uploads, upload };
}
```

### 8.3 `useWallUrlState`

```ts
export function useWallUrlState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const wallParam = searchParams.get('wall');
  const isOpen = wallParam !== null;
  const view = wallParam?.startsWith('share') ? 'wizard' :
               wallParam === 'policy' ? 'policy' : 'list';

  const close = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('wall');
    router.replace(`${pathname}?${newParams.toString()}`);
  };

  const setView = (newView: 'list' | 'wizard' | 'policy') => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('wall', newView === 'list' ? 'open' : newView === 'wizard' ? 'share' : 'policy');
    router.replace(`${pathname}?${newParams.toString()}`);
  };

  return { isOpen, view, close, setView, /* ... */ };
}
```

### 8.4 Tests hooks

Chaque hook a son fichier `*.test.tsx` avec Testing Library `renderHook` + MSW pour les hooks de fetch.

## 9. Phase F33 — Insertion `/kit`

### 9.1 Patch minimal

```tsx
// apps/web/src/app/(marketing)/kit/page.tsx
+ import { RitualsModuleSuspense } from '@/components/sections/rituals/RitualsModuleBound';
+ import { RitualsWallDrawer } from '@/components/sections/rituals/RitualsWallDrawer';

  export default function KitPage() {
    return (
      <>
        <HeroProduit />
        <CompositionReveal />
+       <RitualsModuleSuspense productKey="pack-femiglow" />
        <ComparatifTable />
        <FAQAccordion />
        <CtaFinalProduit />
+       <RitualsWallDrawer />
      </>
    );
  }
```

### 9.2 Test E2E smoke

`apps/web/e2e/rituals-kit-module.spec.ts` :

```ts
test('module compact visible sur /kit', async ({ page }) => {
  await page.goto('/kit');
  await expect(page.getByRole('heading', { name: /Les voix de la maison/ })).toBeVisible();
  await expect(page.locator('[data-testid="ritual-module-card"]')).toHaveCount(3);
});

test('drawer ouvre depuis le module', async ({ page }) => {
  await page.goto('/kit');
  await page.click('text=Lire les');
  await expect(page.getByRole('dialog', { name: /Rituels partagés/ })).toBeVisible();
});
```

### 9.3 DoD

- ✓ Module visible sur `/kit`.
- ✓ Drawer s'ouvre.
- ✓ Smoke E2E vert.

## 10. Charge frontend récapitulative

| Phase | Charge |
| --- | --- |
| F1-F2 Tokens | 0,5 j |
| F3 RitualCard | 1 j |
| F4-F6 Module + RSC + Skeleton | 1 j |
| F7-F15 Drawer + sous-composants | 3 j |
| F16 Lightbox | 0,5 j |
| F17-F25 Wizard | 3 j |
| F26-F32 Hooks | 1 j |
| F33 Insertion + integration | 0,5 j |
| **Total** | **~10,5 j** |

## 11. Synthèse — règles d'or frontend

1. **RSC pour le module compact, CSR pour le drawer**, dynamic import strict.
2. **Pas de fetch côté composant pur** : seuls les `*Bound` ou les hooks `use*` fetch.
3. **React Query pour tout state serveur**, jamais Zustand pour ça.
4. **`prefers-reduced-motion` respecté** dans toutes les animations via Framer Motion `useReducedMotion`.
5. **Storybook story par composant** avec axe-core en background.
6. **Tests Vitest avec `@testing-library/react` + `vitest-axe`** pour chaque composant.
7. **URL state via `useSearchParams` + `router.replace`** pas via push (évite l'historique pollué).
8. **localStorage uniquement pour le brouillon wizard**, jamais pour la liste.
9. **Composants `*Bound` testés via MSW**, composants purs testés avec fixtures.
10. **Aucune classe Tailwind inline > 8 utilities** : extraire en composants ou en classes nommées si plus long.
