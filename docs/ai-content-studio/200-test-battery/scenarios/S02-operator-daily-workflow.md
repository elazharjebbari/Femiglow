# S02 -- Operator Daily Workflow: Multi-Platform Content Session

## Scenario ID
S02

## Priority
P1

## Type
E2E Serial (multi-iteration)

## Description

An operator creates 3 pieces of content for different platforms (Instagram, TikTok,
LinkedIn) in a single session. This tests the reset/regeneration cycle, verifies that
the brief form clears correctly between generations, and ensures the system handles
sequential content creation without state leakage.

## Preconditions

1. Operator authenticated with admin role
2. AI Engine enabled with at least one provider
3. Sufficient daily budget for 3 generations
4. Previous session state cleared (no pending jobs)

## Step Sequence

### Iteration 1: Instagram Carousel

#### Step 1: Navigate to Create
- **Action**: Navigate to `/admin/content-studio-v2/ai-engine/create`
- **Expected**: Fresh brief form
- **Assertions**:
  - All selects show placeholder values
  - Textarea is empty
  - Generer button disabled

#### Step 2: Fill Instagram Brief
- **Action**: Fill form
- **Data**:
  - Objectif: "Engagement communaute"
  - Plateforme: "Instagram"
  - Format: "Carrousel"
  - Ton: "Authentique / Naturel"
  - Message cle: "3 etapes pour des ongles naturellement lumineux"
  - Focus produit: "Huile Tsubaki FemiGlow"
- **Expected**: Button enabled
- **Assertions**: Generer button NOT disabled

#### Step 3: Generate Instagram Content
- **Action**: Click Generer, wait for result
- **Expected**: Content generated for Instagram carousel
- **Assertions**:
  - Result shows script with multiple scenes (carousel = 3+ images)
  - Caption optimized for Instagram (< 2200 chars)
  - Hashtags relevant to beauty/skincare
  - Quality score >= 0.7
  - Cost tracked
- **MSW Handler**: Returns carousel-optimized result with 3+ images

#### Step 4: Record Instagram Cost
- **Action**: Note the total cost
- **Record**: `cost_instagram = totalCostCents`

### Iteration 2: TikTok Reel

#### Step 5: Reset to Brief
- **Action**: Click "Regenerer" then navigate back, or use handleReset
- **Expected**: Brief form reappears
- **Assertions**:
  - Form is in brief phase
  - Previous content no longer visible
  - Note: form fields may retain values from previous iteration (by design --
    handleReset only changes phase, does not clear form state)

#### Step 6: Fill TikTok Brief
- **Action**: Fill form with TikTok-specific parameters
- **Data**:
  - Objectif: "Notoriete de marque"
  - Plateforme: "TikTok"
  - Format: "Reel / Short video"
  - Ton: "Ludique / Fun"
  - Message cle: "Le secret japonais pour des ongles parfaits en 30 secondes"
  - Focus produit: "Kit Starter FemiGlow"
  - Reference tendance: "#jbeauty #nailcare"
- **Expected**: Button enabled

#### Step 7: Generate TikTok Content
- **Action**: Click Generer, wait for result
- **Expected**: Content optimized for TikTok
- **Assertions**:
  - Script includes hook (attention-grabbing opening)
  - Video-oriented format (scenes with visual descriptions)
  - Short-form caption (TikTok style)
  - Trending hashtags included
  - Quality score >= 0.7
- **MSW Handler**: Returns reel-optimized result with video content

#### Step 8: Record TikTok Cost
- **Record**: `cost_tiktok = totalCostCents`

### Iteration 3: LinkedIn Post

#### Step 9: Reset to Brief Again
- **Action**: Navigate to create page fresh
- **Expected**: Brief form displayed

#### Step 10: Fill LinkedIn Brief
- **Action**: Fill form with LinkedIn-specific parameters
- **Data**:
  - Objectif: "Education produit"
  - Plateforme: "LinkedIn"
  - Format: "Post texte"
  - Ton: "Educatif / Expert"
  - Message cle: "Pourquoi les soins japonais pour les ongles sont l'avenir de la beaute clean"
  - Focus produit: "Gamme FemiGlow professionnelle"
- **Expected**: Button enabled

#### Step 11: Generate LinkedIn Content
- **Action**: Click Generer, wait for result
- **Expected**: Content optimized for LinkedIn
- **Assertions**:
  - Professional tone in caption
  - Longer-form content (LinkedIn allows 3000 chars)
  - Industry-relevant hashtags
  - Quality score >= 0.7
- **MSW Handler**: Returns text-post result with professional tone

#### Step 12: Record LinkedIn Cost
- **Record**: `cost_linkedin = totalCostCents`

### Cross-Iteration Verification

#### Step 13: Verify Total Session Cost
- **Action**: Navigate to Analytics page
- **Expected**: All 3 generations reflected
- **Assertions**:
  - Generations today count >= 3
  - Total cost >= cost_instagram + cost_tiktok + cost_linkedin
  - Recent jobs table shows 3 entries with correct platforms

#### Step 14: Verify No State Leakage
- **Action**: Navigate back to create page
- **Expected**: Clean state
- **Assertions**:
  - No residual result data from previous generations
  - No error messages lingering
  - Brief form accessible

## MSW Handlers Required

```typescript
const dailyWorkflowHandlers = [
  // Three different generate responses
  http.post('/api/admin/ai-engine/generate', ({ request }) => {
    const body = await request.json();
    switch (body.platform) {
      case 'instagram':
        return HttpResponse.json(INSTAGRAM_CAROUSEL_RESULT);
      case 'tiktok':
        return HttpResponse.json(TIKTOK_REEL_RESULT);
      case 'linkedin':
        return HttpResponse.json(LINKEDIN_POST_RESULT);
      default:
        return HttpResponse.json(MOCK_GENERATION_RESULT);
    }
  }),

  // Analytics updated after each generation
  http.get('/api/admin/ai-engine/analytics', () =>
    HttpResponse.json(ANALYTICS_WITH_3_JOBS)),
];
```

## Cleanup

- Reset MSW handler call counters between assertions
- No persistent state to clean (in-memory only)

## Key Verification Points

1. **Format differentiation**: Each platform receives platform-appropriate content
   (carousel = multi-image, reel = video, text_post = long-form text)
2. **State isolation**: Generation 2 does not contain artifacts from generation 1
3. **Cost accumulation**: Session total cost is the sum of individual costs
4. **Analytics accuracy**: All 3 jobs appear in the jobs table with correct metadata
5. **UI resilience**: The form handles 3 consecutive generate/reset cycles without
   degradation or memory leaks
