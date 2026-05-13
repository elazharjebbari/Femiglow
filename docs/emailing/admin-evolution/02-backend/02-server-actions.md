# Server actions (Next.js)

> Pour les mutations admin-only, on préfère les Server Actions (RSC)
> aux endpoints API. Plus simple, mieux typé, audit auto.

## Convention

```typescript
'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { withAudit } from '@/lib/audit';

const Input = z.object({ ... });

export const myAction = withAudit('event.name', async (formData: FormData | object) => {
  const session = await requireAdmin('/admin/emails/...');
  const input = Input.parse(/* extract */);

  // ... logique
  
  return { ok: true, data };
});
```

## Catalogue par phase

### M5.1 — Transactional

| Action | Fichier | Audit event |
|---|---|---|
| `searchOutboxAction(input)` | `mail/transactional/actions.ts` | – (lecture) |
| `retryOutboxAction(id)` | (existant) | `emailing.outbox.retried` |
| `bulkRetryAction(ids)` | new | `emailing.outbox.bulk_retried` |
| `bulkSuppressAction(ids)` | new | `emailing.suppression.bulk_added` |
| `saveViewAction(scope, name, state)` | `mail/admin-views/actions.ts` | `emailing.view.saved` |
| `deleteViewAction(id)` | idem | `emailing.view.deleted` |

### M5.3 — Audiences

| Action | Audit event |
|---|---|
| `createAudienceAction(input)` | `emailing.audience.created` |
| `updateAudienceAction(id, input)` | `emailing.audience.updated` |
| `deleteAudienceAction(id)` | `emailing.audience.deleted` |
| `previewSizeAction(rules)` | – |
| `previewSampleAction(rules)` | – |
| `snapshotAudienceAction(id)` | `emailing.audience.snapshot_started` |

### M5.4 — Campaigns

| Action | Audit event |
|---|---|
| `setCampaignAudienceAction(campaignId, audienceId)` | `emailing.campaign.audience_set` |
| `setCampaignAudienceAdHocAction(campaignId, rules)` | idem |
| `finalizeCampaignV2Action(campaignId)` | `emailing.campaign.finalized` |

### M5.5 — Automations

| Action | Audit event |
|---|---|
| `createAutomationAction(input)` | `emailing.automation.created` |
| `updateAutomationAction(id, input)` | `emailing.automation.updated` |
| `toggleAutomationAction(id, active)` | `emailing.automation.toggled` |
| `deleteAutomationAction(id)` | `emailing.automation.deleted` |
| `cloneAutomationAction(id)` | `emailing.automation.cloned` |
| `cancelRunAction(runId, reason?)` | `emailing.automation.run_cancelled` |

## Pattern d'audit log

Le helper `withAudit(event, fn)` :
1. Capture `session.email` via `requireAdmin()`
2. Capture les inputs (sanitized — pas de PII verbose)
3. Exécute la fn
4. Si OK : INSERT `admin_audit_log` (event, actor, target, payload, success=true)
5. Si erreur : INSERT (success=false, error)
6. Re-throw l'erreur

```typescript
// lib/audit.ts
export function withAudit<TIn, TOut>(
  event: string,
  fn: (input: TIn) => Promise<TOut>,
): (input: TIn) => Promise<TOut> {
  return async (input) => {
    const session = await requireAdmin();
    const startedAt = Date.now();
    try {
      const result = await fn(input);
      await insertAuditLog({ event, actor: session.email,
        payload: sanitize(input), success: true, durationMs: Date.now()-startedAt });
      return result;
    } catch (err) {
      await insertAuditLog({ event, actor: session.email,
        payload: sanitize(input), success: false, error: String(err) });
      throw err;
    }
  };
}
```
