# Plan d'Action Global -- 6 Corrections UX Page Creation AI Engine

**Version:** 1.0
**Date:** 2026-05-27
**Auteur:** Agent (AI-assisted)
**Scope:** `apps/web/src/app/admin/content-studio-v2/ai-engine/create/page.tsx` et composants associes
**Branch:** `feat/create-page-ux-fixes`

---

## Table des matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Graphe de dependances](#2-graphe-de-dependances)
3. [Phase 1 -- P6 Stepper horizontal](#3-phase-1--p6-stepper-horizontal)
4. [Phase 2 -- P5 Mock publish chain](#4-phase-2--p5-mock-publish-chain)
5. [Phase 3 -- P3 Toggle review humaine](#5-phase-3--p3-toggle-review-humaine)
6. [Phase 4 -- P4 Video player](#6-phase-4--p4-video-player)
7. [Phase 5 -- P1 Model Preset Selector](#7-phase-5--p1-model-preset-selector)
8. [Phase 6 -- P2 Section Parametres avances](#8-phase-6--p2-section-parametres-avances)
9. [Budget effort global](#9-budget-effort-global)
10. [Matrice de risques globale](#10-matrice-de-risques-globale)

---

## 1. Vue d'ensemble

### Problemes et ordre d'implementation

| Ordre | ID | Probleme | Severite | Effort |
|-------|----|----------|----------|--------|
| 1 | P6 | Pas de stepper visuel | Modere | S (4h) |
| 2 | P5 | Publish inaccessible | Majeur | S (3h) |
| 3 | P3 | Review toujours verrouillee en mock | Majeur | M (6h) |
| 4 | P4 | Pas de mock video dans le resultat | Majeur | S (4h) |
| 5 | P1 | Pas de choix modele texte | Critique | M (6h) |
| 6 | P2 | Section pliable Parametres avances | Critique | M (8h) |

**Effort total estime:** ~31h (4-5 jours dev)

### Justification de l'ordre

1. **P6 en premier** : le Stepper est la fondation visuelle. Toutes les autres phases en dependent pour le feedback utilisateur.
2. **P5 ensuite** : debloquer la publication permet de tester le parcours complet.
3. **P3 apres P5** : la review necessite le stepper (etape 3) et precede la publication (etape 4).
4. **P4 apres P3** : le video player enrichit le resultat qui arrive apres review.
5. **P1 avant P2** : le ModelPresetSelector est un sous-composant qui sera integre dans P2.
6. **P2 en dernier** : la section pliable est le conteneur qui regroupe P1 + les selecteurs image/video + les toggles.

---

## 2. Graphe de dependances

```
P6 (Stepper)
  |
  +---> P5 (Mock Publish)
  |       |
  |       +---> P3 (Toggle Review)
  |               |
  |               +---> P4 (Video Player)
  |
  +---> P1 (Model Preset Selector)
          |
          +---> P2 (Section Parametres Avances)
                  |
                  +---> [contient P1 + ModelSelector(image) + ModelSelector(video) + toggles]
```

**Dependances strictes:**
- P5 depend de P6 (stepper doit afficher etape 4 "Publication")
- P3 depend de P6 (stepper doit afficher etape 3 "Review")
- P3 depend de P5 (le flow review -> result -> publish doit etre fonctionnel)
- P4 depend de P3 (le resultat video apparait apres review/generation)
- P2 depend de P1 (le ModelPresetSelector est integre dans AdvancedParams)

**Dependances faibles:**
- P4 peut etre fait en parallele de P1 si les interfaces sont pre-definies
- P1 et P3 sont independants l'un de l'autre

---

## 3. Phase 1 -- P6 Stepper horizontal

### 3.1 Objectif

Ajouter un composant `<Stepper>` horizontal en haut de la page creation, affichant 4 etapes numerotees : 1.Brief, 2.Generation, 3.Review, 4.Publication. Le stepper reflete l'etat de la machine `Phase` existante.

### 3.2 Fichiers a creer

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/components/admin/content-studio-v2/ai-engine/Stepper.tsx` | CREER | Composant Stepper 4 etapes |
| `src/components/admin/content-studio-v2/ai-engine/__tests__/Stepper.test.tsx` | CREER | Tests unitaires du Stepper |

### 3.3 Fichiers a modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/app/admin/content-studio-v2/ai-engine/create/page.tsx` | MODIFIER | Importer et afficher le Stepper, mapper Phase vers StepperState |

### 3.4 Implementation detaillee

#### 3.4.1 Composant Stepper.tsx

**Interface:**

```typescript
type StepperStatus = 'pending' | 'active' | 'completed';

interface StepDef {
  label: string;
  status: StepperStatus;
}

interface StepperProps {
  steps: StepDef[];
  mockMode?: boolean;   // Affiche badge "Mode Mock" si true
}
```

**Constantes des etapes:**

```typescript
const STEP_LABELS = ['Brief', 'Generation', 'Review', 'Publication'] as const;
```

**Mapping Phase -> StepperStatus:**

```typescript
function mapPhaseToSteps(phase: Phase): StepDef[] {
  const phaseIndex: Record<Phase, number> = {
    brief: 0,
    generating: 1,
    review: 2,
    reviewing: 2,
    result: 3,
    error: -1,  // Conserve l'etat courant
  };
  const active = phaseIndex[phase];
  return STEP_LABELS.map((label, i) => ({
    label,
    status: i < active ? 'completed' : i === active ? 'active' : 'pending',
  }));
}
```

**Rendu visuel:**
- Conteneur flex horizontal avec `gap: 0`
- Chaque etape : cercle 32px + label en dessous
- Entre chaque etape : ligne horizontale 2px
- Couleurs :
  - `pending`: cercle `var(--cs-border)`, label `var(--cs-fg-muted)`
  - `active`: cercle `var(--cs-accent)` avec pulse animation, label `var(--cs-fg-primary)` bold
  - `completed`: cercle `var(--cs-success)` avec checkmark SVG, label `var(--cs-fg-secondary)`
- Lignes :
  - Avant etape active : `var(--cs-success)` (segment complete)
  - Apres etape active : `var(--cs-border)` (segment futur)

#### 3.4.2 Integration dans page.tsx

**Avant (ligne 727-762):**

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 880, margin: '0 auto' }}>
    <header>...</header>
    {phase === 'brief' && (...)}
```

**Apres:**

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 880, margin: '0 auto' }}>
    <header>...</header>
    <Stepper steps={mapPhaseToSteps(phase)} mockMode={isMockMode} />
    {phase === 'brief' && (...)}
```

Le `isMockMode` sera une constante derivee de la config (ou `true` en dev).

### 3.5 Criteres d'acceptation

- [ ] Le Stepper s'affiche en haut de page sous le header
- [ ] L'etape "Brief" est active au chargement initial
- [ ] L'etape "Generation" est active pendant `phase === 'generating'`
- [ ] L'etape "Review" est active pendant `phase === 'review' || phase === 'reviewing'`
- [ ] L'etape "Publication" est active pendant `phase === 'result'`
- [ ] Les etapes completees affichent un checkmark vert
- [ ] Les etapes futures sont grisees
- [ ] En `phase === 'error'`, le stepper conserve le dernier etat valide
- [ ] Le badge "Mode Mock" s'affiche quand `mockMode === true`
- [ ] Le composant est responsive (labels en dessous des cercles sur mobile)
- [ ] Le composant passe tous les tests unitaires

### 3.6 Evaluation des risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Collision CSS avec les styles CS v2 existants | Faible | Faible | Utiliser inline styles exclusivement (pattern existant) |
| Le mapping Phase -> Step casse si un nouveau Phase est ajoute | Moyenne | Faible | TypeScript exhaustive check dans le switch |
| Espace vertical insuffisant sur petits ecrans | Faible | Moyenne | Labels responsifs, taille reduite sous 640px |

### 3.7 Procedure de rollback

1. Supprimer l'import du `Stepper` dans `page.tsx`
2. Supprimer la ligne `<Stepper ... />` dans le JSX
3. Supprimer le fichier `Stepper.tsx` et son test
4. Aucune modification de schema DB ou d'API

---

## 4. Phase 2 -- P5 Mock publish chain

### 4.1 Objectif

Faire en sorte que la section PublishSection soit toujours visible apres une generation reussie, meme en mode mock. Le handler mock `/generate` doit retourner un `bridgeResult` avec des IDs fictifs, et le handler mock `/publish` doit retourner un succes simule.

### 4.2 Fichiers a creer

Aucun nouveau fichier. Modifications uniquement.

### 4.3 Fichiers a modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/test/msw/ai-engine-handlers.ts` | MODIFIER | S'assurer que `MOCK_GENERATION_RESULT.bridgeResult` et le handler `POST /publish` sont corrects (deja present) |
| `src/app/api/admin/ai-engine/generate/route.ts` | VERIFIER | Le route reel bridge deja, pas de changement |
| `src/app/admin/content-studio-v2/ai-engine/create/page.tsx` | MODIFIER | Forcer `bridgeResult` mock quand le backend n'en renvoie pas |
| `src/components/admin/content-studio-v2/ai-engine/GenerationResult.tsx` | MODIFIER | Ajouter badge "Mode Mock" dans PublishSection quand `draftId` commence par 'mock-' |

### 4.4 Implementation detaillee

#### 4.4.1 Enrichir la reponse generate cote client

Le MSW handler retourne deja un `bridgeResult: { ideaId: 'ci_test001', briefId: 'cb_test001', draftId: 'cd_test001' }`. Le probleme est que la page production (via le vrai route handler) ne bridge pas en mode mock car `bridgeToContentStudio()` echoue.

**Solution dans page.tsx -- apres reception de `data` dans `handleGenerate()`:**

```typescript
// Apres: const data = await res.json();
// S'assurer qu'un bridgeResult existe pour le flow complet
const effectiveBridgeResult = data.bridgeResult ?? {
  ideaId: `mock-idea-${Date.now()}`,
  briefId: `mock-brief-${Date.now()}`,
  draftId: `mock-draft-${Date.now()}`,
};
```

#### 4.4.2 Badge "Mode Mock" dans PublishSection

```tsx
// Dans PublishSection, si draftId commence par "mock-" ou contient "test"
const isMock = draftId.startsWith('mock-') || draftId.includes('test');

// Afficher un badge discret en haut a droite
{isMock && (
  <span style={{
    position: 'absolute', top: 12, right: 12,
    padding: '2px 8px', borderRadius: 'var(--cs-radius-sm)',
    background: 'rgba(245, 158, 11, 0.12)',
    color: '#f59e0b',
    fontSize: 'var(--cs-text-xs)',
    fontWeight: 500,
  }}>
    Mode Mock
  </span>
)}
```

#### 4.4.3 Mock publish handler enrichi

Le handler MSW existe deja (ligne 173-175 de `ai-engine-handlers.ts`). Il retourne `{ success: true, postId: 'post-001' }`. On l'enrichit:

```typescript
http.post(`${BASE}/publish`, async ({ request }) => {
  const body = await request.json() as Record<string, unknown>;
  const mode = (body.mode as string) ?? 'now';
  return HttpResponse.json({
    success: true,
    status: mode === 'now' ? 'published' : 'scheduled',
    postId: `mock-post-${Date.now()}`,
    draftId: body.draftId,
    message: mode === 'now'
      ? 'Contenu publie avec succes (mock)'
      : `Contenu planifie (mock)`,
  });
}),
```

### 4.5 Criteres d'acceptation

- [ ] La section "Publier" est visible apres chaque generation reussie
- [ ] Le bouton "Publier maintenant" fonctionne et affiche un message de succes
- [ ] Le mode "Planifier" fonctionne avec un datetime-local
- [ ] Un badge discret "Mode Mock" est visible quand le draftId est fictif
- [ ] Le publish handler MSW retourne un succes simule
- [ ] Le badge "Mode Mock" n'apparait PAS quand le draftId est un UUID reel
- [ ] Les tests E2E du golden path (brief -> generate -> publish) passent

### 4.6 Evaluation des risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Le fallback bridgeResult masque un vrai bug backend | Moyenne | Moyenne | Ne fallback que si `data.bridgeResult` est null/undefined, pas sur erreur |
| L'operateur confond mock et production | Faible | Haute | Badge "Mode Mock" toujours visible, couleur orange distinctive |
| Le publish mock diverge de l'API reelle | Faible | Faible | Le mock retourne le meme schema que le handler reel |

### 4.7 Procedure de rollback

1. Retirer le fallback `effectiveBridgeResult` dans `handleGenerate()`
2. Retirer le badge "Mode Mock" dans `PublishSection`
3. Restaurer le handler publish simple dans MSW
4. La condition `{bridgeResult && <PublishSection>}` redevient bloquante

---

## 5. Phase 3 -- P3 Toggle review humaine

### 5.1 Objectif

Ajouter un toggle "Review humaine avant publication" dans le formulaire. Quand active, la generation passe toujours par la phase `'review'` avec un `reviewPayload` mock realiste. Les boutons Approuver/Modifier/Rejeter fonctionnent en mode mock.

### 5.2 Fichiers a creer

Aucun nouveau fichier composant (le toggle est un simple `<input type="checkbox">`).

### 5.3 Fichiers a modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/app/admin/content-studio-v2/ai-engine/create/page.tsx` | MODIFIER | Ajouter state `humanReviewEnabled`, toggle UI, logique review mock dans `handleGenerate()` |
| `src/test/msw/ai-engine-handlers.ts` | MODIFIER | Ajouter handler conditionnel qui retourne `status: 'review'` quand le body contient `humanReviewRequired: true` |

### 5.4 Implementation detaillee

#### 5.4.1 Nouveau state dans page.tsx

```typescript
const [humanReviewEnabled, setHumanReviewEnabled] = useState(false);
```

#### 5.4.2 Toggle UI (temporairement en bas du formulaire brief, sera deplace dans P2)

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
  <input
    type="checkbox"
    id="human-review-toggle"
    checked={humanReviewEnabled}
    onChange={(e) => setHumanReviewEnabled(e.target.checked)}
    style={{ accentColor: 'var(--cs-accent)' }}
  />
  <label htmlFor="human-review-toggle" style={{
    fontSize: 'var(--cs-text-sm)',
    color: 'var(--cs-fg-secondary)',
    cursor: 'pointer',
  }}>
    Review humaine avant publication
  </label>
</div>
```

#### 5.4.3 Logique review dans handleGenerate()

```typescript
// Apres: const data = await res.json();

// Si review humaine activee ET le backend n'a pas deja impose une review
if (humanReviewEnabled && data.status !== 'review') {
  // Generer un reviewPayload mock a partir du resultat
  const mockReviewPayload: ReviewPayload = {
    jobId: data.jobId ?? `mock-job-${Date.now()}`,
    script: data.script ?? null,
    caption: data.caption ?? 'Caption mock pour review...',
    hashtags: data.hashtags ?? ['femiglow', 'beaute'],
    images: data.images ?? [],
    videos: data.videos ?? [],
    qualityScores: data.qualityScores ?? { text_quality: 0.88, brand_compliance: 0.92 },
    moderationResult: data.moderationResult ?? { safe: true, flags: [] },
  };

  simulateProgress(() => {
    setReviewJobId(data.jobId ?? `mock-job-${Date.now()}`);
    setReviewPayload(mockReviewPayload);
    setTotalCost(data.totalCostCents ?? data.costTracking?.totalCents);
    // Stocker le resultat pour l'utiliser apres approbation
    setPendingResult(data);
    setPhase('review');
  });
  return;
}
```

#### 5.4.4 Gestion de l'approbation mock

Ajouter un nouveau state pour stocker le resultat en attente de review:

```typescript
const [pendingResult, setPendingResult] = useState<GenerationResultData | null>(null);
```

Modifier `handleReviewDecision()` pour gerer le cas mock:

```typescript
const handleReviewDecision = useCallback(async (decision: string, feedback?: string) => {
  // Si on a un pendingResult (review mock), l'utiliser directement
  if (pendingResult && decision === 'approved') {
    setResult(pendingResult);
    const effectiveBridge = pendingResult.bridgeResult ?? {
      ideaId: `mock-idea-${Date.now()}`,
      briefId: `mock-brief-${Date.now()}`,
      draftId: `mock-draft-${Date.now()}`,
    };
    setBridgeResult(effectiveBridge);
    setContentStudioUrl(pendingResult.contentStudioUrl ?? null);
    setPhase('result');
    setPendingResult(null);
    return;
  }

  if (pendingResult && decision === 'rejected') {
    // Retourner au brief
    handleReset();
    return;
  }

  if (pendingResult && decision === 'edit_requested') {
    // Simuler une re-generation avec les feedbacks
    setReviewSubmitting(true);
    setTimeout(() => {
      setReviewSubmitting(false);
      // Rester en review avec le meme payload (simule une re-generation)
    }, 1500);
    return;
  }

  // ... code existant pour le vrai backend ...
}, [reviewJobId, pendingResult, handleReset]);
```

#### 5.4.5 Modification du body POST /generate

```typescript
body: JSON.stringify({
  objective: form.objective,
  platform: form.platform,
  format: form.format,
  tone: form.tone,
  keyMessage: form.keyMessage,
  productFocus: form.productFocus || undefined,
  trendReference: form.trendReference || undefined,
  humanReviewRequired: humanReviewEnabled,   // <-- NOUVEAU
}),
```

#### 5.4.6 Handler MSW conditionnel

```typescript
http.post(`${BASE}/generate`, async ({ request }) => {
  const body = await request.json() as Record<string, unknown>;
  if (body.humanReviewRequired) {
    return HttpResponse.json({
      ...MOCK_GENERATION_RESULT,
      status: 'review',
      jobId: 'mock-review-job-001',
      reviewPayload: {
        script: MOCK_GENERATION_RESULT.script,
        caption: MOCK_GENERATION_RESULT.caption,
        hashtags: MOCK_GENERATION_RESULT.hashtags,
        images: MOCK_GENERATION_RESULT.images,
        qualityScores: MOCK_GENERATION_RESULT.qualityScores,
      },
    });
  }
  return HttpResponse.json(MOCK_GENERATION_RESULT);
}),
```

### 5.5 Criteres d'acceptation

- [ ] Le toggle "Review humaine" est visible dans le formulaire brief
- [ ] Quand le toggle est OFF, la generation va directement au resultat (comportement actuel)
- [ ] Quand le toggle est ON, la generation passe par la phase review
- [ ] Le ReviewPanel affiche le contenu genere (script, caption, hashtags, images, scores)
- [ ] Le bouton "Approuver" transitionne vers le resultat final
- [ ] Le bouton "Rejeter" retourne au brief
- [ ] Le bouton "Demander des modifications" affiche un textarea et reste en review
- [ ] Le stepper affiche l'etape 3 (Review) comme active pendant la review
- [ ] Le `humanReviewRequired` est envoye dans le body POST /generate
- [ ] Le handler MSW retourne `status: 'review'` quand `humanReviewRequired: true`

### 5.6 Evaluation des risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Le state `pendingResult` n'est pas nettoye sur reset | Faible | Moyenne | Ajouter `setPendingResult(null)` dans `handleReset()` |
| Le toggle est invisible s'il est trop bas dans le formulaire | Moyenne | Faible | Sera deplace dans P2 (AdvancedParams), position temporaire visible |
| Le reviewPayload mock est incomplet | Faible | Faible | Utiliser les vraies donnees du resultat genere |

### 5.7 Procedure de rollback

1. Retirer `humanReviewEnabled` state et son toggle
2. Retirer la logique `if (humanReviewEnabled ...)` dans `handleGenerate()`
3. Retirer `pendingResult` state et sa logique dans `handleReviewDecision()`
4. Retirer `humanReviewRequired` du body POST
5. Restaurer le handler MSW original (sans condition)

---

## 6. Phase 4 -- P4 Video player

### 6.1 Objectif

Ajouter une section "Videos" dans `GenerationResult` qui affiche un `<video>` player HTML natif pour chaque video generee. Le mock MSW doit fournir une URL video fictive. Les metadonnees (duree, resolution, provider) sont affichees en badges.

### 6.2 Fichiers a creer

Aucun nouveau fichier composant (le player est integre directement dans GenerationResult).

### 6.3 Fichiers a modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/components/admin/content-studio-v2/ai-engine/GenerationResult.tsx` | MODIFIER | Ajouter le type `videos` dans l'interface, section VideoPlayer dans le rendu |
| `src/test/msw/ai-engine-handlers.ts` | MODIFIER | Ajouter des videos mock dans `MOCK_GENERATION_RESULT.videos` |

### 6.4 Implementation detaillee

#### 6.4.1 Enrichir l'interface GenerationResultData

```typescript
export interface VideoAsset {
  assetId: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  provider?: string;
}

export interface GenerationResultData {
  script?: { ... };
  caption?: string;
  hashtags?: string[];
  images?: string[];
  videos?: VideoAsset[];     // <-- NOUVEAU
  qualityScores?: Record<string, number>;
  costBreakdown?: { label: string; amountCents: number }[];
  totalCostCents?: number;
}
```

#### 6.4.2 Section Videos dans GenerationResult

Apres la section `images` (CollapsibleSection "Visuels"), ajouter:

```tsx
{videos && videos.length > 0 && (
  <CollapsibleSection
    title={`Videos (${videos.length})`}
    icon={<Film size={14} />}
    defaultOpen
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {videos.map((video, i) => (
        <div
          key={video.assetId ?? i}
          style={{
            borderRadius: 'var(--cs-radius)',
            overflow: 'hidden',
            border: '1px solid var(--cs-border-hair)',
            background: 'var(--cs-bg-sunken)',
          }}
        >
          {video.url ? (
            <video
              controls
              preload="metadata"
              style={{ width: '100%', display: 'block', maxHeight: 480 }}
            >
              <source src={video.url} type={video.mimeType ?? 'video/mp4'} />
              Votre navigateur ne supporte pas la lecture video.
            </video>
          ) : (
            <div style={{
              height: 200, display: 'grid', placeItems: 'center',
              color: 'var(--cs-fg-muted)', fontSize: 'var(--cs-text-sm)',
            }}>
              Video non disponible
            </div>
          )}
          <div style={{
            display: 'flex', gap: 8, padding: '10px 14px',
            alignItems: 'center', flexWrap: 'wrap',
          }}>
            {video.durationMs != null && (
              <Badge tone="clay" size="sm">
                {(video.durationMs / 1000).toFixed(1)}s
              </Badge>
            )}
            {video.width && video.height && (
              <Badge tone="clay" size="sm">
                {video.width}x{video.height}
              </Badge>
            )}
            {video.provider && (
              <Badge tone="accent" size="sm">
                {video.provider}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  </CollapsibleSection>
)}
```

#### 6.4.3 Mock video dans MSW handlers

```typescript
const MOCK_GENERATION_RESULT = {
  // ... champs existants ...
  videos: [
    {
      assetId: 'mock-video-001',
      url: '/_media/ai-engine/mock/test-video.mp4',
      mimeType: 'video/mp4',
      width: 1080,
      height: 1920,
      durationMs: 15000,
      provider: 'mock',
    },
  ],
  // ...
};
```

Note: L'URL `/_media/ai-engine/mock/test-video.mp4` pointe vers un fichier genere par FFmpeg (deja implemente dans `generate-video.ts`). En l'absence du fichier, le player affichera un message d'erreur natif du navigateur, ce qui est acceptable en mode mock.

### 6.5 Criteres d'acceptation

- [ ] La section "Videos" s'affiche quand `result.videos` est un tableau non-vide
- [ ] Chaque video est rendue avec un player `<video>` natif avec controles
- [ ] Le badge de duree s'affiche (ex: "15.0s")
- [ ] Le badge de resolution s'affiche (ex: "1080x1920")
- [ ] Le badge provider s'affiche (ex: "mock", "higgsfield")
- [ ] La section ne s'affiche PAS quand `result.videos` est vide ou undefined
- [ ] Le player est responsive (width: 100%, max-height: 480px)
- [ ] L'import `Film` de lucide-react est ajoute
- [ ] Les tests existants de GenerationResult ne cassent pas

### 6.6 Evaluation des risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Le fichier video mock n'existe pas au chemin attendu | Haute | Faible | Le player HTML5 affiche un message d'erreur natif |
| Le player video charge automatiquement une grosse video | Faible | Moyenne | `preload="metadata"` limite le chargement initial |
| Le layout est casse en vertical (video 9:16) | Moyenne | Faible | `max-height: 480px` et `width: 100%` contiennent le player |

### 6.7 Procedure de rollback

1. Retirer la section `{videos && videos.length > 0 && ...}` dans GenerationResult
2. Retirer le type `VideoAsset` et le champ `videos` de l'interface
3. Retirer les videos du MOCK_GENERATION_RESULT (remettre `videos: []`)
4. Retirer l'import `Film` de lucide-react

---

## 7. Phase 5 -- P1 Model Preset Selector

### 7.1 Objectif

Creer un composant `<ModelPresetSelector>` offrant 4 presets : Auto, Rapide, Premium, Personnalise. Le preset selectionne determine le modele LLM envoye dans le body POST `/generate`. Le mode "Personnalise" ouvre le `ModelSelector` existant filtre `capability=text`.

### 7.2 Fichiers a creer

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/components/admin/content-studio-v2/ai-engine/ModelPresetSelector.tsx` | CREER | Composant segmented control 4 boutons |
| `src/components/admin/content-studio-v2/ai-engine/__tests__/ModelPresetSelector.test.tsx` | CREER | Tests unitaires |

### 7.3 Fichiers a modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/app/admin/content-studio-v2/ai-engine/create/page.tsx` | MODIFIER | Ajouter state `textModelPreset` et `textModelCustom`, envoyer dans POST body |

### 7.4 Implementation detaillee

#### 7.4.1 Interface du composant

```typescript
type ModelPreset = 'auto' | 'fast' | 'premium' | 'custom';

interface ModelPresetSelectorProps {
  value: ModelPreset;
  onChange: (preset: ModelPreset) => void;
  customModel?: string;
  onCustomModelChange?: (model: string) => void;
  capability?: string;   // Pour filtrer le ModelSelector en mode custom
  providerType?: string; // Pour le ModelSelector
  label?: string;
}
```

#### 7.4.2 Mapping preset vers modele

```typescript
const PRESET_MODELS: Record<Exclude<ModelPreset, 'custom'>, { model: string; label: string; description: string }> = {
  auto: {
    model: '',  // Le backend decide
    label: 'Auto',
    description: 'Le systeme choisit le meilleur modele',
  },
  fast: {
    model: 'gpt-4o-mini',
    label: 'Rapide',
    description: 'Modele rapide et economique',
  },
  premium: {
    model: 'claude-sonnet-4-20250514',
    label: 'Premium',
    description: 'Modele le plus performant',
  },
};
```

#### 7.4.3 Rendu du composant

**Segmented control (4 boutons en ligne):**

```tsx
<div style={{ display: 'flex', gap: 0, border: '1px solid var(--cs-border)', borderRadius: 'var(--cs-radius)' }}>
  {(['auto', 'fast', 'premium', 'custom'] as const).map((preset, idx, arr) => (
    <button
      key={preset}
      type="button"
      onClick={() => onChange(preset)}
      style={{
        flex: 1,
        padding: '8px 12px',
        border: 'none',
        borderLeft: idx > 0 ? '1px solid var(--cs-border)' : 'none',
        borderRadius: idx === 0
          ? 'var(--cs-radius-sm) 0 0 var(--cs-radius-sm)'
          : idx === arr.length - 1
            ? '0 var(--cs-radius-sm) var(--cs-radius-sm) 0'
            : '0',
        background: value === preset ? 'var(--cs-accent-bg)' : 'var(--cs-bg-elevated)',
        color: value === preset ? 'var(--cs-accent)' : 'var(--cs-fg-secondary)',
        fontWeight: value === preset ? 600 : 400,
        fontSize: 'var(--cs-text-sm)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all var(--cs-motion-fast) var(--cs-easing)',
      }}
    >
      {PRESET_LABELS[preset]}
    </button>
  ))}
</div>

{/* ModelSelector en mode custom */}
{value === 'custom' && (
  <div style={{ marginTop: 10 }}>
    <ModelSelector
      providerType={providerType ?? 'openai'}
      selectedModels={customModel ? [customModel] : []}
      onModelsChange={(models) => onCustomModelChange?.(models[0] ?? '')}
      capabilityFilter={capability ?? 'text'}
    />
  </div>
)}
```

#### 7.4.4 Integration dans page.tsx

**Nouveaux states:**

```typescript
const [textModelPreset, setTextModelPreset] = useState<ModelPreset>('auto');
const [textModelCustom, setTextModelCustom] = useState('');
```

**Nouveau champ dans le body POST:**

```typescript
body: JSON.stringify({
  // ... champs existants ...
  textModel: textModelPreset === 'custom'
    ? textModelCustom
    : PRESET_MODELS[textModelPreset]?.model ?? '',
}),
```

**Position dans le formulaire brief (temporaire, sera deplace dans P2):**
- Apres le select "Ton" et avant "Message cle"

### 7.5 Criteres d'acceptation

- [ ] Le segmented control affiche 4 boutons : Auto, Rapide, Premium, Personnalise
- [ ] Le bouton selectionne a un fond accent et un texte bold
- [ ] Cliquer sur "Auto" envoie `textModel: ''` (le backend decide)
- [ ] Cliquer sur "Rapide" envoie `textModel: 'gpt-4o-mini'`
- [ ] Cliquer sur "Premium" envoie `textModel: 'claude-sonnet-4-20250514'`
- [ ] Cliquer sur "Personnalise" ouvre le ModelSelector avec `capability=text`
- [ ] Le modele selectionne dans le ModelSelector est envoye dans le body
- [ ] Le composant est accessible (keyboard navigation, focus visible)
- [ ] Le composant est responsive (empile sur mobile si necessaire)
- [ ] Les tests unitaires couvrent tous les presets et le mode custom

### 7.6 Evaluation des risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Les noms de modeles deviennent obsoletes (nouvelles versions) | Haute | Faible | Les presets sont des constantes facilement mises a jour |
| Le ModelSelector ne trouve aucun modele pour le provider | Faible | Moyenne | Le ModelSelector gere deja le cas vide avec un message d'erreur |
| Le backend ignore le champ `textModel` | Haute | Faible | En mode mock, le backend MSW l'ignore. En prod, il faudra modifier le schema zod du route handler |

### 7.7 Procedure de rollback

1. Retirer l'import et le rendu du `ModelPresetSelector` dans page.tsx
2. Retirer les states `textModelPreset` et `textModelCustom`
3. Retirer `textModel` du body POST
4. Supprimer `ModelPresetSelector.tsx` et son test

---

## 8. Phase 6 -- P2 Section Parametres avances

### 8.1 Objectif

Creer une section `<CollapsibleSection>` "Parametres avances" en bas du formulaire brief. Cette section regroupe:
1. Modele texte (P1 -- ModelPresetSelector)
2. Modele image (ModelSelector capability=image)
3. Modele video (ModelSelector capability=video, conditionnel)
4. Toggle "Generer les visuels" (on/off)
5. Toggle "Review humaine avant publication" (P3)

### 8.2 Fichiers a creer

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/components/admin/content-studio-v2/ai-engine/AdvancedParams.tsx` | CREER | Section pliable avec tous les parametres avances |
| `src/components/admin/content-studio-v2/ai-engine/__tests__/AdvancedParams.test.tsx` | CREER | Tests unitaires |

### 8.3 Fichiers a modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/app/admin/content-studio-v2/ai-engine/create/page.tsx` | MODIFIER | Deplacer le toggle review et le ModelPresetSelector dans AdvancedParams, ajouter les nouveaux states (imageModel, videoModel, generateVisuals) |

### 8.4 Implementation detaillee

#### 8.4.1 Interface du composant

```typescript
interface AdvancedParamsProps {
  // Modele texte
  textModelPreset: ModelPreset;
  onTextModelPresetChange: (preset: ModelPreset) => void;
  textModelCustom: string;
  onTextModelCustomChange: (model: string) => void;
  // Modele image
  imageModel: string;
  onImageModelChange: (model: string) => void;
  // Modele video
  videoModel: string;
  onVideoModelChange: (model: string) => void;
  showVideoModel: boolean;  // false pour text_post et infographic
  // Toggles
  generateVisuals: boolean;
  onGenerateVisualsChange: (v: boolean) => void;
  humanReviewEnabled: boolean;
  onHumanReviewEnabledChange: (v: boolean) => void;
}
```

#### 8.4.2 Structure du rendu

```tsx
export function AdvancedParams(props: AdvancedParamsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      border: '1px solid var(--cs-border-hair)',
      borderRadius: 'var(--cs-radius)',
      marginTop: 18,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '12px 18px', background: 'var(--cs-bg-base)',
          border: 'none', cursor: 'pointer',
          fontSize: 'var(--cs-text-sm)', fontWeight: 500,
          fontFamily: 'var(--cs-font-display)', color: 'var(--cs-fg-secondary)',
          textAlign: 'left',
        }}
      >
        <Settings size={14} style={{ color: 'var(--cs-fg-muted)' }} />
        <span style={{ flex: 1 }}>Parametres avances</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div style={{
          padding: '20px 18px', background: 'var(--cs-bg-elevated)',
          display: 'flex', flexDirection: 'column', gap: 20,
          borderTop: '1px solid var(--cs-border-hair)',
        }}>
          {/* Modele texte */}
          <div>
            <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)', display: 'block', marginBottom: 8 }}>
              Modele de texte
            </label>
            <ModelPresetSelector
              value={props.textModelPreset}
              onChange={props.onTextModelPresetChange}
              customModel={props.textModelCustom}
              onCustomModelChange={props.onTextModelCustomChange}
              capability="text"
            />
          </div>

          {/* Modele image */}
          <div>
            <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)', display: 'block', marginBottom: 8 }}>
              Modele d'image
            </label>
            <ModelSelector
              providerType="openai"
              selectedModels={props.imageModel ? [props.imageModel] : []}
              onModelsChange={(m) => props.onImageModelChange(m[0] ?? '')}
              capabilityFilter="image"
            />
          </div>

          {/* Modele video (conditionnel) */}
          {props.showVideoModel && (
            <div>
              <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)', display: 'block', marginBottom: 8 }}>
                Modele video
              </label>
              <ModelSelector
                providerType="higgsfield"
                selectedModels={props.videoModel ? [props.videoModel] : []}
                onModelsChange={(m) => props.onVideoModelChange(m[0] ?? '')}
                capabilityFilter="video"
              />
            </div>
          )}

          {/* Toggle generer visuels */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="generate-visuals-toggle"
              checked={props.generateVisuals}
              onChange={(e) => props.onGenerateVisualsChange(e.target.checked)}
              style={{ accentColor: 'var(--cs-accent)' }}
            />
            <label htmlFor="generate-visuals-toggle" style={{
              fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)', cursor: 'pointer',
            }}>
              Generer les visuels
            </label>
          </div>

          {/* Toggle review humaine */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="human-review-toggle"
              checked={props.humanReviewEnabled}
              onChange={(e) => props.onHumanReviewEnabledChange(e.target.checked)}
              style={{ accentColor: 'var(--cs-accent)' }}
            />
            <label htmlFor="human-review-toggle" style={{
              fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)', cursor: 'pointer',
            }}>
              Review humaine avant publication
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 8.4.3 Visibilite conditionnelle du modele video

Le selecteur de modele video est masque pour les formats `text_post` et `infographic` :

```typescript
const showVideoModel = !['text_post', 'infographic'].includes(form.format);
```

#### 8.4.4 Nouveaux states dans page.tsx

```typescript
const [imageModel, setImageModel] = useState('');
const [videoModel, setVideoModel] = useState('');
const [generateVisuals, setGenerateVisuals] = useState(true);
```

#### 8.4.5 Body POST enrichi

```typescript
body: JSON.stringify({
  objective: form.objective,
  platform: form.platform,
  format: form.format,
  tone: form.tone,
  keyMessage: form.keyMessage,
  productFocus: form.productFocus || undefined,
  trendReference: form.trendReference || undefined,
  humanReviewRequired: humanReviewEnabled,
  textModel: resolveTextModel(textModelPreset, textModelCustom),
  imageModel: imageModel || undefined,
  videoModel: videoModel || undefined,
  generateVisuals,
}),
```

#### 8.4.6 Migration : retirer les elements temporaires de P1 et P3

Lors de l'implementation de P2, les elements suivants sont DEPLACES (pas dupliques) :
- Le toggle "Review humaine" (ajoute en P3) est retire du formulaire brief et place dans AdvancedParams
- Le ModelPresetSelector (ajoute en P1, s'il etait place temporairement dans le brief) est retire et place dans AdvancedParams

### 8.5 Criteres d'acceptation

- [ ] La section "Parametres avances" est visible en bas du formulaire brief
- [ ] La section est fermee par defaut
- [ ] Cliquer sur le header ouvre/ferme la section avec animation
- [ ] Le ModelPresetSelector texte fonctionne (Auto/Rapide/Premium/Custom)
- [ ] Le ModelSelector image est present avec `capability=image`
- [ ] Le ModelSelector video est present avec `capability=video`
- [ ] Le ModelSelector video est MASQUE quand format = text_post ou infographic
- [ ] Le toggle "Generer les visuels" fonctionne (on/off)
- [ ] Le toggle "Review humaine" fonctionne (on/off)
- [ ] Tous les parametres sont envoyes dans le body POST /generate
- [ ] Le toggle review du P3 n'est plus duplique dans le formulaire principal
- [ ] Le ModelPresetSelector du P1 n'est plus duplique dans le formulaire principal
- [ ] La section est responsive (champs empiles sur mobile)
- [ ] Les tests unitaires couvrent tous les cas

### 8.6 Evaluation des risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| La section pliable est invisible/ignoree par l'operateur | Moyenne | Moyenne | Ajouter un compteur "N parametres personnalises" dans le header ferme |
| Trop de champs dans la section (surcharge cognitive) | Faible | Moyenne | Regroupement logique par sous-titres, spacing genereux |
| Le ModelSelector charge des modeles au premier ouverture, causant un lag | Faible | Faible | Le ModelSelector a un cache interne (deja implemente) |
| Le format change apres avoir selectionne un modele video | Faible | Faible | Reset le videoModel quand le format passe a text_post/infographic |
| Deplacer le toggle review de P3 casse les tests de P3 | Moyenne | Moyenne | Mettre a jour les selecteurs de test pour chercher dans AdvancedParams |

### 8.7 Procedure de rollback

1. Retirer l'import et le rendu de `AdvancedParams` dans page.tsx
2. Remettre le toggle review humaine dans le formulaire brief (etat P3)
3. Remettre le ModelPresetSelector dans le formulaire brief (etat P1)
4. Retirer les states `imageModel`, `videoModel`, `generateVisuals`
5. Retirer les champs correspondants du body POST
6. Supprimer `AdvancedParams.tsx` et son test

---

## 9. Budget effort global

| Phase | Composant | Tests | Integration | Total |
|-------|-----------|-------|-------------|-------|
| P6 Stepper | 2h | 1h | 1h | **4h** |
| P5 Mock Publish | 1h | 1h | 1h | **3h** |
| P3 Toggle Review | 2h | 2h | 2h | **6h** |
| P4 Video Player | 2h | 1h | 1h | **4h** |
| P1 Model Preset | 3h | 1.5h | 1.5h | **6h** |
| P2 Advanced Params | 3h | 2h | 3h | **8h** |
| **TOTAL** | **13h** | **8.5h** | **9.5h** | **31h** |

**Temps reel estime avec debug + review:** 4-5 jours developpeur

### Repartition par type de fichier

| Type | Crees | Modifies |
|------|-------|----------|
| Composants TSX | 3 | 2 |
| Tests TSX | 3 | 1 |
| Handlers MSW | 0 | 1 |
| Routes API | 0 | 0 (schema zod eventuel) |
| Types | 0 | 1 |

---

## 10. Matrice de risques globale

### Risques techniques

| ID | Risque | Probabilite | Impact | Phase | Mitigation |
|----|--------|-------------|--------|-------|------------|
| R1 | Le refactoring de page.tsx (927 lignes) introduit des regressions | Haute | Haute | Toutes | Tests unitaires et E2E a chaque phase, commits atomiques |
| R2 | Le composant ModelSelector ne fonctionne pas avec capability=text | Faible | Moyenne | P1 | Le composant gere deja le filtre capability, teste en P1 |
| R3 | Le state machine `Phase` ne supporte pas les transitions ajoutees | Faible | Haute | P3, P5 | Le type `Phase` est un union, pas de garde stricte |
| R4 | La mock video n'existe pas et le player video affiche une erreur | Haute | Faible | P4 | Acceptable en mock, le player affiche un message natif |
| R5 | L'ordre des phases cree des conflits de merge | Moyenne | Moyenne | P1-P6 | Chaque phase modifie des zones differentes du fichier |

### Risques UX

| ID | Risque | Probabilite | Impact | Phase | Mitigation |
|----|--------|-------------|--------|-------|------------|
| U1 | L'operateur ne decouvre jamais les parametres avances | Moyenne | Moyenne | P2 | Compteur de customisations dans le header ferme |
| U2 | L'operateur confond mode mock et production | Faible | Haute | P5 | Badge "Mode Mock" distinctif et permanent |
| U3 | Le stepper prend trop d'espace vertical sur mobile | Faible | Faible | P6 | Design responsif, labels condenses sur <640px |
| U4 | Trop de choix de modeles desoriente l'operateur | Faible | Moyenne | P1, P2 | Le preset "Auto" est selectionne par defaut |

### Plan de mitigation global

1. **Chaque phase produit un commit atomique** testable independamment
2. **Les tests sont ecrits AVANT l'implementation** (TDD light)
3. **Un build check (`npm run build`) est execute apres chaque phase**
4. **Un test E2E golden path est execute apres les phases P3, P5, P6**
5. **Le rollback de chaque phase est documente et testable en < 5 min**
