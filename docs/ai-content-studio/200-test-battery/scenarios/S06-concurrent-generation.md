# S06 -- Concurrent Generation: Dual Session Isolation

## Scenario ID
S06

## Priority
P1

## Type
Integration (parallel execution)

## Description

Two simultaneous content generations must not interfere with each other. Each
generation tracks its own state, cost, progress, and result independently. This
scenario validates state isolation when the same operator (or two different
operators) launch generations at the same time from separate browser tabs.

## Preconditions

1. Operator authenticated with admin role
2. AI Engine enabled with sufficient budget for 2 concurrent generations
3. System supports concurrent job execution (no global lock)
4. Two independent test contexts (tabs, browser windows, or test instances)

## Step Sequence

### Phase 1: Launch Two Generations Simultaneously

#### Step 1: Open Two Create Pages
- **Action**: Open `/admin/content-studio-v2/ai-engine/create` in two contexts
- **Context A** (Tab 1): Instagram Reel
- **Context B** (Tab 2): LinkedIn Post
- **Expected**: Both pages render independently with fresh brief forms
- **Assertions**:
  - Both pages show "Nouvelle generation" heading
  - Both have independent form state (changing one does not affect the other)

#### Step 2: Fill Brief in Context A
- **Data**:
  - Objectif: "Notoriete de marque"
  - Plateforme: "Instagram"
  - Format: "Reel / Short video"
  - Ton: "Ludique / Fun"
  - Message cle: "Generation A - Decouvrez les secrets FemiGlow"
  - Focus produit: "Serum Tsubaki"
- **Expected**: Context A form filled, Generer enabled

#### Step 3: Fill Brief in Context B
- **Data**:
  - Objectif: "Education produit"
  - Plateforme: "LinkedIn"
  - Format: "Post texte"
  - Ton: "Educatif / Expert"
  - Message cle: "Generation B - L'innovation japonaise dans les soins"
  - Focus produit: "Gamme professionnelle"
- **Expected**: Context B form filled, Generer enabled
- **Assertions**: Context A form unchanged (no cross-contamination)

#### Step 4: Launch Both Generations Within 1 Second
- **Action**: Click Generer in Context A, then immediately click Generer in Context B
- **MSW Handlers**:
  ```typescript
  // Handler distinguishes requests by content
  let callId = 0;
  http.post('/api/admin/ai-engine/generate', async ({ request }) => {
    callId++;
    const body = await request.json();

    if (body.platform === 'instagram') {
      // Simulate slower generation for video
      await new Promise(r => setTimeout(r, 100));
      return HttpResponse.json({
        ...MOCK_GENERATION_RESULT,
        jobId: 'job-A-instagram',
        totalCostCents: 45,
        caption: 'Generation A Instagram caption',
        hashtags: ['femiglow', 'reel', 'jbeauty'],
        costTracking: { totalCents: 45, breakdown: { generate_script: 10, generate_video: 25, generate_caption: 10 } },
      });
    } else {
      return HttpResponse.json({
        ...MOCK_GENERATION_RESULT,
        jobId: 'job-B-linkedin',
        totalCostCents: 15,
        caption: 'Generation B LinkedIn caption',
        hashtags: ['beautejaponaise', 'innovation'],
        costTracking: { totalCents: 15, breakdown: { generate_script: 8, generate_caption: 7 } },
      });
    }
  });
  ```
- **Expected**: Both enter generating phase independently

### Phase 2: Independent Progress Tracking

#### Step 5: Verify Context A Progress
- **Assertions**:
  - Context A shows "Pipeline de generation" heading
  - Elapsed timer running independently
  - Pipeline steps progressing
  - No LinkedIn or "Generation B" content visible
- **Expected**: Context A isolated

#### Step 6: Verify Context B Progress
- **Assertions**:
  - Context B shows "Pipeline de generation" heading
  - Elapsed timer running independently (different start time from A)
  - Pipeline steps progressing
  - No Instagram or "Generation A" content visible
- **Expected**: Context B isolated

### Phase 3: Independent Results

#### Step 7: Context B Completes First (Text is Faster)
- **Action**: Advance timers for Context B
- **Expected**: Context B shows result
- **Assertions**:
  - "Contenu genere" heading in Context B
  - Caption: "Generation B LinkedIn caption"
  - Hashtags: "beautejaponaise", "innovation"
  - Cost: 0.15 MAD (15 centimes)
  - Platform-specific content (text post format)
  - Context A still in generating phase (not affected by B's completion)
- **Expected**: B completes independently

#### Step 8: Context A Completes Later (Video Takes Longer)
- **Action**: Advance timers for Context A
- **Expected**: Context A shows result
- **Assertions**:
  - "Contenu genere" heading in Context A
  - Caption: "Generation A Instagram caption"
  - Hashtags: "femiglow", "reel", "jbeauty"
  - Cost: 0.45 MAD (45 centimes) -- higher due to video
  - Platform-specific content (reel format with video references)
- **Expected**: A completes with correct data

### Phase 4: Cost Isolation

#### Step 9: Verify Individual Job Costs
- **Assertions**:
  - Context A total cost: 0.45 MAD
  - Context B total cost: 0.15 MAD
  - No cost bleed between contexts
  - Cost breakdowns are different (A has video nodes, B does not)
- **Expected**: Costs tracked per-job

#### Step 10: Verify Combined Analytics
- **Action**: Navigate to analytics in either context
- **MSW Handler**:
  ```typescript
  http.get('/api/admin/ai-engine/analytics', () =>
    HttpResponse.json({
      overview: {
        generationsToday: 2,
        costTodayCents: 60,  // 45 + 15
        successRate: 100,
        // ...
      },
      recentJobs: [
        { id: 'job-A-instagram', status: 'completed', platform: 'instagram', format: 'reel', totalCostCents: '45', durationMs: 12000, createdAt: '...' },
        { id: 'job-B-linkedin', status: 'completed', platform: 'linkedin', format: 'text_post', totalCostCents: '15', durationMs: 6000, createdAt: '...' },
      ]
    }))
  ```
- **Assertions**:
  - Total generations: 2
  - Total cost: 0.60 MAD (45 + 15)
  - Both jobs appear in recent jobs table
  - Job A: instagram/reel, 0.45 MAD
  - Job B: linkedin/text_post, 0.15 MAD
  - Jobs have different durations
- **Expected**: Analytics aggregates correctly

### Phase 5: State Reset Isolation

#### Step 11: Reset Context A Without Affecting Context B
- **Action**: In Context A, click "Regenerer" or navigate to create page
- **Expected**: Context A resets to brief phase
- **Assertions**:
  - Context A shows fresh brief form
  - Context B still shows result (if user hasn't navigated away)
- **Expected**: Reset is context-local

### Phase 6: Concurrent HITL Review

#### Step 12: Both Generations Enter Review Phase
- **Action**: Launch two new generations that both return `status: 'review'`
- **MSW Handlers**:
  ```typescript
  http.post('/api/admin/ai-engine/generate', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      status: 'review',
      jobId: body.platform === 'instagram' ? 'review-job-A' : 'review-job-B',
      reviewPayload: {
        caption: body.platform === 'instagram' ? 'Review A caption' : 'Review B caption',
        hashtags: [body.platform],
        qualityScores: { brand_alignment: 0.82 },
      }
    });
  });
  ```
- **Expected**: Both contexts show review panel
- **Assertions**:
  - Context A review shows "Review A caption" and "#instagram"
  - Context B review shows "Review B caption" and "#linkedin"
  - Review decisions are independent

#### Step 13: Approve A, Reject B
- **Action**: Approve in Context A, Reject in Context B
- **MSW Handlers**:
  ```typescript
  http.post('/api/admin/ai-engine/jobs/:id/review', async ({ params, request }) => {
    const body = await request.json();
    if (params.id === 'review-job-A') {
      return HttpResponse.json({ status: 'completed', caption: 'Approved A content' });
    } else {
      return HttpResponse.json({ status: 'review', jobId: 'review-job-B-v2', reviewPayload: { caption: 'Regenerated B content' } });
    }
  });
  ```
- **Expected**:
  - Context A transitions to result phase with "Approved A content"
  - Context B remains in review phase with "Regenerated B content"
  - Decisions do not cross-contaminate

## MSW Handlers Required

```typescript
const concurrentHandlers = [
  // Platform-aware generate handler
  http.post('/api/admin/ai-engine/generate', platformAwareHandler),

  // Job-aware review handler
  http.post('/api/admin/ai-engine/jobs/:id/review', jobAwareReviewHandler),

  // Aggregated analytics
  http.get('/api/admin/ai-engine/analytics', () =>
    HttpResponse.json(COMBINED_ANALYTICS)),
];
```

## Cleanup

- Close both test contexts
- Reset MSW handlers
- Clear any shared state

## Key Verification Points

1. **State isolation**: Each generation maintains independent state (form, progress, result)
2. **Cost isolation**: Each job tracks its own cost; no cost bleed between jobs
3. **Progress isolation**: Pipeline progress in one context doesn't affect the other
4. **Result isolation**: Results contain only the content for their respective brief
5. **Timer isolation**: Elapsed timers run independently with different start times
6. **Review isolation**: HITL decisions in one context don't affect the other
7. **Analytics aggregation**: Combined view correctly sums both jobs
8. **Reset isolation**: Resetting one context doesn't affect the other
9. **No race conditions**: Simultaneous API calls resolve to correct contexts
10. **Job ID uniqueness**: Each generation gets a unique jobId

## Implementation Notes

### Vitest Approach (Unit Tests)

For unit tests, concurrent generations can be tested by rendering two independent
component instances:

```typescript
const { container: containerA } = render(<AIEngineCreatePage />);
const { container: containerB } = render(<AIEngineCreatePage />);

// Fill and generate in both
// Verify results independently using within(containerA) and within(containerB)
```

### Playwright Approach (E2E Tests)

For E2E tests, use two browser pages:

```typescript
const pageA = await context.newPage();
const pageB = await context.newPage();

await pageA.goto('/admin/content-studio-v2/ai-engine/create');
await pageB.goto('/admin/content-studio-v2/ai-engine/create');

// Fill forms in parallel
await Promise.all([
  fillBriefInPage(pageA, instagramBrief),
  fillBriefInPage(pageB, linkedinBrief),
]);

// Generate simultaneously
await Promise.all([
  pageA.click('button:has-text("Generer")'),
  pageB.click('button:has-text("Generer")'),
]);

// Verify results independently
await expect(pageA.locator('text=Generation A')).toBeVisible();
await expect(pageB.locator('text=Generation B')).toBeVisible();
```
