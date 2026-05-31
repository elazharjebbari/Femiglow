# Test spec — automation-runner (V2)

> File: `apps/web/src/lib/mail/automation/runner-v2.test.ts`

## Structure

```typescript
describe('runner-v2', () => {
  describe('advanceRun', () => {
    describe('step kind: wait', () => { ... });
    describe('step kind: send', () => { ... });
    describe('step kind: branch', () => { ... });
    describe('step kind: tag', () => { ... });
    describe('step kind: update_lead', () => { ... });
    describe('step kind: webhook', () => { ... });
    describe('step kind: wait_for_event', () => { ... });
  });
  
  describe('triggerAutomation', () => { ... });
  describe('frequency (cooldown, quiet hours, daily cap)', () => { ... });
  describe('resume from wait_for_event', () => { ... });
});
```

## Scénarios par step kind

### wait
- duration 1h → nextActionAt = now+1h, currentStep advance
- duration 0 → next_action_at = now (advance immediately)
- duration > 90j → throws (limit)

### send
- template existe → enqueueOutbox called avec template, recipient, vars
- vars auto-mappées (`firstName ← lead.first_name`)
- vars manquantes dans context → log warn, send sans cette var
- template inexistant → status='errored'
- Idempotency : retry du même step → idempotencyKey same, outbox INSERT
  rejeté (existing)

### branch
- Condition true → currentStep avance dans ifTrue sub-séquence
- Condition false → currentStep avance dans ifFalse sub-séquence
- Sub-séquence terminée → revient au step parent + 1
- Condition lance error → status='errored'
- Sub-séquence vide → skip directement

### tag
- action 'add' → INSERT lead_tag
- action 'remove' → DELETE lead_tag
- Tag déjà existant + add → no-op (UNIQUE)
- Tag inexistant + remove → no-op (0 rows affected)
- lead_id absent (recipient pas dans leads) → log warn, skip

### update_lead
- field 'status' value 'churned' → UPDATE leads
- field invalide → throws (validation Zod)
- lead absent → log warn, skip

### webhook
- POST URL valide → 200 → advance
- POST URL valide → 500 → retry 3× exponentiel → status='errored' si all fail
- POST URL invalide → throws immédiat
- Body interpole les vars du context

### wait_for_event
- Met run en status='waiting_for_event', awaiting_event_name set
- Resume : user_event matchant arrive → run status='pending', avance
- Timeout : awaiting_until < now → re-pickup, branche onTimeout='continue' → advance ; 'abort' → status='errored'

## triggerAutomation

- Slug existe + active → run créé
- Slug inexistant → throws
- Slug existe + inactive → skipped: 'inactive'
- trigger_conditions évaluées : si false → skipped: 'conditions_not_met'
- Existant run actif (UNIQUE) → skipped: 'already_running'
- Cooldown période active → skipped: 'cooldown'
- Daily cap atteint → skipped: 'daily_cap_reached'

## Frequency

### Cooldown
- Last run started_at < cooldown_seconds → skipped
- Last run > cooldown ago → triggered

### Quiet hours
- Now in quiet hours (e.g. 03h Maroc) → next_action_at pushed to quiet_hours_end
- Now in active hours → no change
- Disabled → no change

### Daily cap
- Today runs count >= daily_cap → skipped
- 0 daily_cap → unlimited

## Resume from wait_for_event

```typescript
it('resumes runs waiting on matched event', async () => {
  // Pre-state : run X status='waiting_for_event', awaiting='cart.added'
  // Arrivée user_event : cart.added, email matches X.recipient_email
  await onUserEventArrival({ email, event_name: 'cart.added', ... });
  
  // Run X status='pending', advanced
});
```

- Event ne match pas l'awaiting_event_name → run reste en waiting
- Event match mais email différent → no-op
- Event match + awaiting_until < now → no-op (timeout sera traité en cron)

## Idempotency

- Tick runs 2 fois la même run → idempotent (current_step ne saute pas 2 fois)
- Crash en plein advance → status reste 'pending', next tick reprend

## Mocking

- `makeFakeDrizzle` pour DB
- `sendTransactional` mocké en vi.fn pour vérifier calls
- `fetch` (webhook) mocké via MSW

## Couverture

≥ 90% lines, ≥ 85% branches. Chaque step kind a au moins 3 scénarios :
happy + erreur + edge.
