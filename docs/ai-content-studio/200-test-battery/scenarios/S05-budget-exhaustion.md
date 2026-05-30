# S05 -- Budget Exhaustion: Mid-Generation Budget Limit

## Scenario ID
S05

## Priority
P1

## Type
Unit + E2E

## Description

This scenario tests the budget guard mechanism when the daily budget limit is hit
during a generation. The system must stop cleanly, report accurate costs up to the
point of failure, and prevent further spending. The cost ledger must remain accurate
despite the interrupted generation.

## Preconditions

1. Operator authenticated with admin role
2. AI Engine enabled with budget configuration:
   - `dailyCents: 1000` (10.00 MAD daily limit)
   - `maxPerJobCents: 100` (1.00 MAD per job limit)
3. Current daily spend close to limit (e.g., 990 centimes used, 10 remaining)
4. Brief form ready to fill

## Step Sequence

### Phase 1: Budget Near Exhaustion

#### Step 1: Verify Budget State
- **Action**: Check analytics or config to confirm budget status
- **Expected**: Daily cost shows 9.90 MAD of 10.00 MAD used
- **Assertions**:
  - Cost today is close to daily limit
  - System is still accepting generations (budget not yet exceeded)
- **MSW Handler**: Analytics returns costTodayCents: 990

#### Step 2: Fill and Generate (Budget Will Be Exceeded)
- **Action**: Fill brief form and click Generer
- **Data**: Standard brief (any valid configuration)
- **MSW Handler**:
  ```typescript
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json({
      error: {
        code: 'budget_exceeded',
        message: 'Budget quotidien depasse. Limite: 10.00 MAD, utilise: 10.23 MAD. La generation a ete arretee au noeud generate_images.',
        dailyLimitCents: 1000,
        dailyUsedCents: 1023,
        stoppedAtNode: 'generate_images',
        partialCostCents: 33,
      }
    }, { status: 429 }))
  ```
- **Expected**: Error phase with budget information

#### Step 3: Verify Budget Error Display
- **Assertions**:
  - "Erreur de generation" heading visible
  - Error message mentions "Budget quotidien depasse"
  - Limit amount visible: "10.00 MAD"
  - Used amount visible: "10.23 MAD"
  - Node where generation stopped is mentioned: "generate_images"
  - Partial cost is communicated (0.33 MAD for this job)
  - "Reessayer" button visible
  - "Modifier le brief" button visible
- **Expected**: Actionable budget error with full financial context

### Phase 2: Budget Guard -- Pre-Generation Block

#### Step 4: Attempt Retry (Budget Still Exceeded)
- **Action**: Click "Reessayer"
- **MSW Handler** (same 429 response):
  ```typescript
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json({
      error: {
        code: 'budget_exceeded',
        message: 'Budget quotidien depasse. Aucune generation possible jusqu\'a demain.',
        dailyLimitCents: 1000,
        dailyUsedCents: 1023,
      }
    }, { status: 429 }))
  ```
- **Expected**: Error displayed again (budget still exceeded)
- **Assertions**:
  - Error message clearly states no generation possible
  - Mentions "jusqu'a demain" (until tomorrow)
  - No partial progress shown (generation never started)

#### Step 5: Verify Cost Ledger Accuracy
- **Action**: Navigate to analytics page
- **MSW Handler**: Analytics returns updated costs
  ```typescript
  http.get('/api/admin/ai-engine/analytics', () =>
    HttpResponse.json({
      overview: {
        generationsToday: 12,
        costTodayCents: 1023,  // includes partial cost from interrupted job
        // ...
      },
      recentJobs: [
        {
          id: 'job-interrupted',
          status: 'failed',
          platform: 'instagram',
          format: 'carousel',
          totalCostCents: '33',  // partial cost correctly recorded
          durationMs: 8500,      // partial duration
          createdAt: new Date().toISOString(),
        },
        // ... previous successful jobs
      ]
    }))
  ```
- **Assertions**:
  - Daily cost shows 10.23 MAD (includes the partial cost)
  - Interrupted job appears in recent jobs with status "Echoue"
  - Interrupted job cost is 0.33 MAD (partial cost recorded accurately)
  - Other jobs' costs unchanged
  - Total = sum of all job costs (ledger balanced)
- **Expected**: Cost ledger accurately reflects interrupted generation

### Phase 3: Per-Job Budget Limit

#### Step 6: Test Per-Job Limit (Separate from Daily)
- **Action**: Reset daily budget context, attempt expensive generation
- **MSW Handler**:
  ```typescript
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json({
      error: {
        code: 'job_budget_exceeded',
        message: 'Cout maximum par generation depasse. Limite: 1.00 MAD, estime: 1.45 MAD.',
        jobLimitCents: 100,
        estimatedCostCents: 145,
      }
    }, { status: 429 }))
  ```
- **Expected**: Error displayed
- **Assertions**:
  - Error mentions per-job limit
  - Estimated cost shown (1.45 MAD)
  - Job limit shown (1.00 MAD)
  - Suggestion to simplify the brief or change format
- **Expected**: Per-job guard prevents over-spending

### Phase 4: Zero Budget Configuration

#### Step 7: Set Budget to Zero
- **Action**: Configure daily budget to 0
- **MSW Handler**:
  ```typescript
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json({
      error: {
        code: 'budget_exceeded',
        message: 'Budget quotidien fixe a 0. Aucune generation autorisee.',
        dailyLimitCents: 0,
        dailyUsedCents: 0,
      }
    }, { status: 429 }))
  ```
- **Expected**: Generation blocked immediately
- **Assertions**:
  - Error message mentions budget is 0
  - No generation started
  - No cost incurred

### Phase 5: Budget Recovery (Next Day)

#### Step 8: Simulate Budget Reset
- **Action**: (Conceptual) Daily budget resets at midnight
- **MSW Handler**: Generate endpoint returns success again
- **Expected**: Generation succeeds
- **Assertions**:
  - Pipeline runs to completion
  - Result displayed
  - Daily cost starts fresh
- **Expected**: Budget cycle resets correctly

## MSW Handlers Required

```typescript
const budgetExhaustionHandlers = [
  // Dynamic handler that checks call count
  http.post('/api/admin/ai-engine/generate', ({ request }) => {
    if (budgetExhausted) {
      return HttpResponse.json({
        error: { code: 'budget_exceeded', message: 'Budget quotidien depasse' }
      }, { status: 429 });
    }
    return HttpResponse.json(MOCK_GENERATION_RESULT);
  }),

  // Analytics with accurate cost tracking
  http.get('/api/admin/ai-engine/analytics', () =>
    HttpResponse.json(ANALYTICS_WITH_BUDGET_DATA)),

  // Error handlers
  aiEngineErrorHandlers.generate429,
];
```

## Cleanup

- Reset budget state in MSW handlers
- Clear any cost tracking variables

## Key Verification Points

1. **Clean stop**: Generation halts at the budget boundary, not in the middle of an API call
2. **Partial cost accuracy**: The cost of the interrupted job is correctly calculated
   (only includes costs for nodes that actually executed)
3. **Ledger integrity**: Total daily cost = sum of all job costs (successful + partial)
4. **Node identification**: The stopped-at node is identified in the error message
5. **No over-spend**: After budget exceeded, no further API calls are made
6. **Per-job limit**: Separate from daily limit, prevents single expensive generations
7. **Zero budget**: Setting budget to 0 effectively disables generation
8. **Recovery**: Budget resets allow generation to resume
9. **User messaging**: All error messages include specific MAD amounts and are actionable

## Financial Assertions

| Metric | Expected Value |
|---|---|
| Daily limit | 10.00 MAD (1000 centimes) |
| Pre-interruption spend | 9.90 MAD (990 centimes) |
| Interrupted job cost | 0.33 MAD (33 centimes) |
| Post-interruption total | 10.23 MAD (1023 centimes) |
| Over-budget amount | 0.23 MAD (23 centimes) |
| Subsequent attempts cost | 0.00 MAD (no API calls made) |
