# S01 -- Golden Path: Complete Operator Journey

## Scenario ID
S01

## Priority
P0

## Type
E2E Serial (full integration)

## Description

The golden path tests the complete operator journey through the AI Engine from
initial login through content creation to publication and analytics verification.
This is the most critical business scenario -- if this path fails, the product
is fundamentally broken.

## Preconditions

1. Operator is authenticated with admin role
2. AI Engine is enabled (`AI_ENGINE_ENABLED=true`)
3. At least one provider configured (OpenAI with valid API key)
4. Knowledge base seeded with FemiGlow brand collection (brand-femiglow)
5. Daily budget not exhausted (`dailyCents > 0`)
6. Quality threshold set to 0.7
7. Human review optional or enabled (`AI_ENGINE_HUMAN_REVIEW_REQUIRED=true`)

## Step Sequence

### Step 1: Navigate to AI Engine Dashboard
- **Action**: Navigate to `/admin/content-studio-v2/ai-engine`
- **Expected**: Dashboard page loads with provider status cards
- **Assertions**:
  - Page title "AI Engine" visible
  - At least one provider shows "Configure" or "Sain" status
  - Sidebar shows AI Engine sub-navigation items
- **MSW Handler**: `http.get('/api/admin/ai-engine/health')`

### Step 2: Verify Configuration
- **Action**: Click "Config" in sidebar or navigate to `/admin/content-studio-v2/ai-engine/config`
- **Expected**: Configuration page loads with providers list
- **Assertions**:
  - OpenAI provider listed with "Configure" status
  - Quality threshold displayed (0.7)
  - Budget settings visible
- **MSW Handler**: `http.get('/api/admin/ai-engine/config/providers')`

### Step 3: Verify Knowledge Base
- **Action**: Navigate to `/admin/content-studio-v2/ai-engine/knowledge`
- **Expected**: Knowledge collections listed
- **Assertions**:
  - "Brand guidelines FemiGlow" collection visible
  - Document count > 0
  - Chunk count > 0
- **MSW Handler**: `http.get('/api/admin/ai-engine/knowledge')`

### Step 4: Navigate to Create Page
- **Action**: Click "Generer" in sidebar or navigate to `/admin/content-studio-v2/ai-engine/create`
- **Expected**: Brief form displayed
- **Assertions**:
  - "Nouvelle generation" heading visible
  - "Brief creatif" section visible
  - All 7 form fields rendered
  - Generer button visible but disabled

### Step 5: Fill Creative Brief
- **Action**: Complete the brief form
- **Data**:
  - Objectif: "Engagement communaute"
  - Plateforme: "Instagram"
  - Format: "Carrousel"
  - Ton: "Premium / Luxe"
  - Message cle: "Le rituel FemiGlow pour des ongles lumineux"
  - Focus produit: "Kit de soin FemiGlow"
  - Reference tendance: (leave empty)
- **Expected**: Form fields populated, Generate button enabled
- **Assertions**:
  - Generer button no longer disabled
  - All required fields show selected values
  - Sparkles icon visible on button

### Step 6: Launch Generation
- **Action**: Click "Generer" button
- **Expected**: Pipeline progress appears
- **Assertions**:
  - Brief form disappears
  - "Pipeline de generation" heading appears
  - First step status changes to "running" (spinner icon)
  - Elapsed timer starts ticking
- **MSW Handler**: `http.post('/api/admin/ai-engine/generate')` returns success or review

### Step 7: Observe Pipeline Progress
- **Action**: Wait for pipeline to complete
- **Expected**: Steps progress sequentially
- **Assertions**:
  - Each step transitions: pending -> running -> done
  - Green checkmarks accumulate
  - Connector lines turn green
  - Duration displayed per completed step
  - Total elapsed time displayed
- **Timeout**: 120 seconds

### Step 8: Review Content (if HITL enabled)
- **Action**: If status='review', examine the ReviewPanel
- **Expected**: Review panel with content preview
- **Assertions**:
  - "Revue humaine requise" heading visible
  - Script hook text non-empty and in French
  - Caption > 100 characters
  - At least 3 hashtags displayed with # prefix
  - Quality scores visible (brand_alignment, clarity, etc.)
  - All scores >= 0.65
- **MSW Handler**: `http.post('/api/admin/ai-engine/jobs/:id/review')`

### Step 9: Approve Content
- **Action**: Click "Approuver" button
- **Expected**: Content approved, result phase displays
- **Assertions**:
  - "Contenu genere" heading appears
  - Script section with hook, scenes, CTA
  - Caption with copy button
  - Hashtag badges
  - Quality score bars
  - Cost breakdown table

### Step 10: Verify Quality Scores
- **Action**: Inspect quality scores section
- **Expected**: All scores meet threshold
- **Assertions**:
  - brand_alignment >= 0.7
  - clarity >= 0.7
  - overall/average >= 0.7
  - Score bars color-coded correctly

### Step 11: Verify Cost
- **Action**: Inspect cost breakdown
- **Expected**: Cost accurately tracked
- **Assertions**:
  - Total cost displayed in MAD
  - Breakdown shows individual node costs
  - Sum of breakdown equals total

### Step 12: Publish Content
- **Action**: Click "Publier maintenant" and then the Publier button
- **Expected**: Content published successfully
- **Assertions**:
  - Green success banner appears
  - Text "Contenu publie avec succes" visible
- **MSW Handler**: `http.post('/api/admin/ai-engine/publish')`

### Step 13: Verify Library Link
- **Action**: Click "Voir dans la Bibliotheque"
- **Expected**: Navigation to Content Studio library with highlight
- **Assertions**:
  - Link href contains `/admin/content-studio-v2/library?highlight=`
  - Draft ID embedded in URL

### Step 14: Check Analytics
- **Action**: Navigate to `/admin/content-studio-v2/ai-engine/analytics`
- **Expected**: Analytics reflect the completed generation
- **Assertions**:
  - Generations count incremented
  - Cost total updated
  - Recent jobs table contains new entry with status "Termine"
  - Job shows correct platform (instagram) and format (carousel)
- **MSW Handler**: `http.get('/api/admin/ai-engine/analytics')`

## MSW Handlers Required

```typescript
const goldenPathHandlers = [
  http.get('/api/admin/ai-engine/health', () => HttpResponse.json(MOCK_HEALTH)),
  http.get('/api/admin/ai-engine/config/providers', () => HttpResponse.json(MOCK_PROVIDERS)),
  http.get('/api/admin/ai-engine/knowledge', () => HttpResponse.json(MOCK_COLLECTIONS)),
  http.post('/api/admin/ai-engine/generate', () => HttpResponse.json(MOCK_GENERATION_RESULT)),
  http.post('/api/admin/ai-engine/jobs/:id/review', () => HttpResponse.json({ ...MOCK_GENERATION_RESULT, status: 'completed' })),
  http.post('/api/admin/ai-engine/publish', () => HttpResponse.json({ success: true, postId: 'post-001' })),
  http.get('/api/admin/ai-engine/analytics', () => HttpResponse.json(MOCK_ANALYTICS_WITH_NEW_JOB)),
];
```

## Cleanup

- No persistent state to clean (MSW handlers auto-reset between tests)
- If using real API: delete generated content and job records
- Reset generation counter if testing count assertions

## Failure Modes

| Step | Failure | Impact | Recovery |
|---|---|---|---|
| 6 | API returns 500 | Blocks generation | Error phase with retry |
| 7 | Pipeline timeout | Infinite spinner | Manual page refresh |
| 8 | Review payload empty | Cannot evaluate content | Skip HITL, approve blind |
| 9 | Approval API fails | Stuck in review | Retry approval |
| 12 | Publish fails | Content not deployed | Error banner, retry |
| 14 | Analytics stale | Metrics don't reflect | Manual refresh |
