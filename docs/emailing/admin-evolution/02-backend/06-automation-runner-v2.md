# Automation runner V2

> Extension du runner V1 (qui ne supporte que `wait` + `send`) pour
> gérer les nouveaux step types et les `wait_for_event`.

## Architecture step handlers

Pattern : un fichier handler par step kind. Chaque handler implémente :

```typescript
export interface StepHandler<TStep> {
  execute(
    step: TStep,
    run: AutomationRun,
    ctx: ExecutionContext,
  ): Promise<StepResult>;
}

type StepResult =
  | { kind: 'advance'; nextActionAt?: Date }            // continue
  | { kind: 'branch_to'; toIndex: number }              // jump
  | { kind: 'wait'; until: Date }                       // pause
  | { kind: 'wait_for_event'; eventName: string; timeout: Date }
  | { kind: 'complete' }                                // fin run
  | { kind: 'error'; reason: string };                  // fail run
```

## Tick principal

```typescript
// /api/cron/email-automation
async function tickAutomation() {
  // 1. Pick pending runs ready to advance
  const runs = await db.select().from(automationRun)
    .where(and(
      eq(automationRun.status, 'pending'),
      lte(automationRun.next_action_at, sql`now()`),
    ))
    .limit(100);

  for (const run of runs) {
    await advanceRun(run.id);
  }

  // 2. Pick wait_for_event runs that timed out
  const timedOut = await db.select().from(automationRun)
    .where(and(
      eq(automationRun.status, 'waiting_for_event'),
      lt(automationRun.awaiting_until, sql`now()`),
    ))
    .limit(100);

  for (const run of timedOut) {
    await handleEventTimeout(run.id);
  }
}
```

## Advance run

```typescript
async function advanceRun(runId: string) {
  const run = await db.query.automationRun.findFirst({ ... });
  const automation = await db.query.emailAutomation.findFirst({ ... });
  const step = getStepAt(automation.steps, run.currentStep);
  const handler = handlers[step.kind];
  const ctx = await buildContext(run);

  try {
    const result = await handler.execute(step, run, ctx);
    await applyResult(run, result);
  } catch (err) {
    logger.error('automation.step.failed', { runId, stepIndex: run.currentStep, err });
    await db.update(automationRun).set({
      status: 'errored',
      errored_at: sql`now()`,
      errored_reason: String(err),
    }).where(eq(automationRun.id, runId));
  }
}
```

## Handlers spec

### `wait`
```typescript
execute: (step, run) => ({
  kind: 'wait',
  until: new Date(Date.now() + step.durationMs),
})
```
Le `applyResult({ kind: 'wait', until })` :
```typescript
await db.update(automationRun).set({
  next_action_at: until,
  // currentStep ne change pas — on relance le même step
}).where(...);
```
Au prochain tick, ré-exécute wait qui retourne `advance`.

> Variante propre : `wait` retourne `advance` direct avec `nextActionAt`
> dans le futur. Cleaner, je préfère ça :

```typescript
execute: () => ({
  kind: 'advance',
  nextActionAt: new Date(Date.now() + step.durationMs),
})
```
applyResult :
```typescript
await db.update(automationRun).set({
  current_step: run.current_step + 1,
  next_action_at: result.nextActionAt ?? sql`now()`,
});
```

### `send`
```typescript
execute: async (step, run, ctx) => {
  const vars = mapVariables(step.varMappings ?? {}, ctx);
  const outboxId = await sendTransactional({
    template: step.template,
    to: { email: run.recipient_email },
    payload: vars,
    idempotencyKey: `autom-${run.id}-step-${run.current_step}`,
    source: `automation.${ctx.automation.slug}`,
  });
  await appendOutboxId(run.id, outboxId);
  return { kind: 'advance' };
}
```

### `branch`
```typescript
execute: async (step, run, ctx) => {
  const condition = await evaluateRulesAgainstUser(step.condition, ctx.user);
  // Note: on traite ifTrue / ifFalse comme des "sub-séquences"
  // → on inline les steps dans le array principal au moment du create,
  // OU on les stocke comme une structure imbriquée.
  // Décision V1 : structure imbriquée stockée en jsonb. Runner fait le walk.
  return {
    kind: 'branch_to',
    subSteps: condition ? step.ifTrue : step.ifFalse,
  };
}
```
applyResult : pousse les sub-steps sur une pile (stocked dans `run.context.callStack`) et avance dans la sub-séquence.

### `tag`
```typescript
execute: async (step, run, ctx) => {
  if (step.action === 'add') {
    await applyTag(ctx.user.leadId, step.tag, 'automation', ctx.automation.slug);
  } else {
    await removeTag(ctx.user.leadId, step.tag);
  }
  return { kind: 'advance' };
}
```

### `update_lead`
```typescript
execute: async (step, run, ctx) => {
  await updateLeadField(ctx.user.leadId, step.field, step.value);
  return { kind: 'advance' };
}
```

### `webhook`
```typescript
execute: async (step, run, ctx) => {
  const body = interpolate(step.body, ctx);
  const res = await fetch(step.url, {
    method: step.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { kind: 'error', reason: `Webhook returned ${res.status}` };
  }
  return { kind: 'advance' };
}
```

### `wait_for_event`
```typescript
execute: (step, run, ctx) => ({
  kind: 'wait_for_event',
  eventName: step.eventName,
  timeout: new Date(Date.now() + step.timeoutMs),
})
```
applyResult :
```typescript
await db.update(automationRun).set({
  status: 'waiting_for_event',
  awaiting_event_name: result.eventName,
  awaiting_until: result.timeout,
});
```

### Event reception → resume

Quand un `user_event` arrive (via bridge), un handler dédié check :
```typescript
async function resumeWaitingRuns(event: UserEvent) {
  const candidates = await db.select().from(automationRun)
    .where(and(
      eq(automationRun.status, 'waiting_for_event'),
      eq(automationRun.awaiting_event_name, event.event_name),
      eq(automationRun.recipient_email, event.email),
      gt(automationRun.awaiting_until, sql`now()`),
    ));
  
  for (const run of candidates) {
    await db.update(automationRun).set({
      status: 'pending',
      awaiting_event_name: null,
      awaiting_until: null,
      next_action_at: sql`now()`,
      current_step: run.current_step + 1,
    }).where(eq(automationRun.id, run.id));
  }
}
```

## Quiet hours

Si `automation.quiet_hours_enabled = true` et le `nextActionAt` calculé
tombe entre `quiet_hours_end` et `quiet_hours_start` (tz), décale au
`quiet_hours_start` du jour suivant.

```typescript
function applyQuietHours(scheduled: Date, automation: Automation): Date {
  if (!automation.quiet_hours_enabled) return scheduled;
  
  const tz = automation.quiet_hours_tz;
  const local = toZonedTime(scheduled, tz);
  const start = parseTime(automation.quiet_hours_start);
  const end = parseTime(automation.quiet_hours_end);
  
  if (local.hours < start || local.hours >= end) {
    // déplacer à start du jour suivant
    return setTime(addDays(local, local.hours < start ? 0 : 1), start);
  }
  return scheduled;
}
```

## Cooldown

Au moment de `triggerAutomation()` :
```typescript
if (automation.cooldown_seconds > 0) {
  const recentRun = await db.query.automationRun.findFirst({
    where: and(
      eq(automationRun.automation_id, automation.id),
      eq(automationRun.recipient_email, context.email),
      gte(automationRun.started_at, 
        sql`now() - interval '${automation.cooldown_seconds} seconds'`),
    ),
    orderBy: desc(automationRun.started_at),
  });
  if (recentRun) {
    logger.info('automation.trigger.cooldown_skipped', { 
      automationId: automation.id, email: context.email,
    });
    return { skipped: 'cooldown' };
  }
}
```

## Daily cap

Avant chaque run advance :
```typescript
if (automation.daily_cap) {
  const todayCount = await countTodayRuns(automation.id);
  if (todayCount >= automation.daily_cap) {
    return { skipped: 'daily_cap_reached' };
  }
}
```

## Tests

Voir [11-tests/01-jest-unit/automation-runner.test.spec.md](../11-tests/01-jest-unit/automation-runner.test.spec.md). Couverture exhaustive par step kind + edge cases timing/cooldown/quiet hours.
