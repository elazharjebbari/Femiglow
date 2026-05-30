# S03 -- Error Recovery Cascade: Multi-Provider Failure Chain

## Scenario ID
S03

## Priority
P0

## Type
E2E Serial (error simulation)

## Description

This scenario simulates a cascade of provider failures: OpenAI fails with a 500
error, then Anthropic returns a 429 rate limit, then Google returns a budget
exceeded error. The system must handle each failure gracefully, display actionable
error messages, and allow the operator to retry until success. This validates the
error handling pipeline across the entire generation flow.

## Preconditions

1. Operator authenticated with admin role
2. AI Engine enabled
3. All three providers (OpenAI, Anthropic, Google) configured
4. Brief form will be pre-filled for each attempt

## Step Sequence

### Phase 1: OpenAI Provider Timeout (500)

#### Step 1: Fill Brief and Generate
- **Action**: Navigate to create page, fill required fields, click Generer
- **Data**: Standard brief (objective: engagement, platform: instagram, format: post, tone: empowering, keyMessage: "Test error recovery")
- **MSW Handler**:
  ```typescript
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json(
      { error: { code: 'provider_error', message: 'OpenAI: Request timed out after 30s', provider: 'openai' } },
      { status: 500 }
    ))
  ```
- **Expected**: Error phase displayed

#### Step 2: Verify OpenAI Error Display
- **Assertions**:
  - "Erreur de generation" heading visible
  - Error message mentions "OpenAI" or "timed out"
  - AlertTriangle icon visible (amber circle)
  - "Reessayer" button visible with RefreshCw icon
  - "Modifier le brief" button visible
- **Expected**: Actionable error with provider identification

#### Step 3: Operator Clicks Retry -- Anthropic Rate Limited (429)
- **Action**: Click "Reessayer"
- **MSW Handler** (replace previous):
  ```typescript
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json(
      { error: { code: 'rate_limited', message: 'Anthropic: Rate limit exceeded. Retry after 60s', provider: 'anthropic', retryAfterMs: 60000 } },
      { status: 429 }
    ))
  ```
- **Expected**: Error phase displayed again

#### Step 4: Verify Anthropic Rate Limit Error
- **Assertions**:
  - Error message mentions "rate limit" or "429"
  - Message mentions "Anthropic" provider
  - Error message is different from the OpenAI error (not stale)
  - Retry button still available
- **Expected**: Rate limit communicated clearly

#### Step 5: Operator Clicks Retry -- Google Budget Exceeded (429)
- **Action**: Click "Reessayer" again
- **MSW Handler** (replace previous):
  ```typescript
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json(
      { error: { code: 'budget_exceeded', message: 'Google: Budget quotidien depasse (limite: 10.00 MAD, utilise: 10.23 MAD)', provider: 'google' } },
      { status: 429 }
    ))
  ```
- **Expected**: Error phase displayed again

#### Step 6: Verify Google Budget Error
- **Assertions**:
  - Error message mentions "budget" or "depasse"
  - Message includes budget figures (10.00 MAD, 10.23 MAD)
  - "Reessayer" button still available
  - "Modifier le brief" button still available
- **Expected**: Budget exhaustion clearly communicated with amounts

### Phase 2: Recovery

#### Step 7: Operator Modifies Brief (Lower Complexity)
- **Action**: Click "Modifier le brief"
- **Expected**: Brief form reappears
- **Assertions**:
  - Brief phase active
  - Form fields accessible
  - Generer button state reflects form validity

#### Step 8: Adjust Brief and Retry
- **Action**: Change format to "Post texte" (lower cost), re-fill any cleared fields, click Generer
- **MSW Handler** (replace with success):
  ```typescript
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json({
      ...MOCK_GENERATION_RESULT,
      costTracking: { totalCents: 3, breakdown: { generate_script: 2, generate_caption: 1 } },
    }))
  ```
- **Expected**: Generation succeeds

#### Step 9: Verify Successful Recovery
- **Assertions**:
  - Pipeline progress appears and completes
  - "Contenu genere" heading visible
  - Script, caption, hashtags present
  - Cost displayed (lower than typical due to text-only format)
  - No lingering error messages
- **Expected**: Full recovery after cascade failure

### Phase 3: Error State Cleanup Verification

#### Step 10: Verify Clean State After Recovery
- **Assertions**:
  - No error banners visible
  - No "Erreur de generation" text anywhere
  - Result phase properly rendered
  - All action buttons functional (Regenerer, Utiliser ce contenu)
- **Expected**: Error state fully cleaned up

## MSW Handler Sequence

The test requires sequential handler replacement to simulate the cascade:

```typescript
// Attempt 1: OpenAI fails
server.use(
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json({ error: { code: 'provider_error', message: 'OpenAI: Request timed out after 30s' } }, { status: 500 }),
    { once: true }
  )
);

// Attempt 2: Anthropic rate limited
server.use(
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json({ error: { code: 'rate_limited', message: 'Anthropic: Rate limit exceeded' } }, { status: 429 }),
    { once: true }
  )
);

// Attempt 3: Google budget exceeded
server.use(
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json({ error: { code: 'budget_exceeded', message: 'Google: Budget quotidien depasse' } }, { status: 429 }),
    { once: true }
  )
);

// Attempt 4: Success (fallback to default handler or new success handler)
server.use(
  http.post('/api/admin/ai-engine/generate', () =>
    HttpResponse.json(MOCK_GENERATION_RESULT)
  )
);
```

Alternative approach using `fetchSpy` call counting:
```typescript
let callCount = 0;
fetchSpy.mockImplementation(() => {
  callCount++;
  switch (callCount) {
    case 1: return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'OpenAI timeout' }) });
    case 2: return Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({ error: 'Anthropic rate limited' }) });
    case 3: return Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({ error: 'Google budget exceeded' }) });
    default: return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_GENERATION_RESULT) });
  }
});
```

## Cleanup

- Reset MSW handlers to defaults after test
- Reset fetchSpy if using manual mock approach
- No persistent state affected

## Key Verification Points

1. **Error message freshness**: Each retry shows the NEW error, not the previous one
2. **Error message specificity**: Provider name and error type are visible
3. **Retry idempotency**: Multiple retries do not corrupt state
4. **Reset capability**: "Modifier le brief" restores form without losing context
5. **Recovery completeness**: After success, no error artifacts remain
6. **Action availability**: Both retry and reset buttons available after every error
7. **No infinite loops**: System does not automatically retry (operator controls retries)

## Failure Modes Tested

| Error Code | HTTP Status | Provider | User-Facing Message |
|---|---|---|---|
| provider_error | 500 | OpenAI | "OpenAI: Request timed out after 30s" |
| rate_limited | 429 | Anthropic | "Anthropic: Rate limit exceeded" |
| budget_exceeded | 429 | Google | "Google: Budget quotidien depasse" with amounts |
