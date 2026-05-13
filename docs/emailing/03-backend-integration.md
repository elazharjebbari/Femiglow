# 03 — Backend Integration

> Proxy Listmonk, SSO middleware, webhooks Stalwart + Listmonk, transactional sender, API client typé. À lire avant de coder le backend.

## §1 — Vue d'ensemble

Le backend FemiGlow joue 5 rôles :

1. **Émetteur transactionnel direct** : `lib/mail/send.ts` → nodemailer → Stalwart 587.
2. **Pilote Listmonk** : `lib/mail/listmonk/*` → API REST → Listmonk loopback.
3. **Reverse proxy** : `/api/listmonk/[...path]` → `127.0.0.1:9000` (transparent pour le navigateur).
4. **Récepteur de webhooks** : `/api/mail/webhook/{stalwart,listmonk}` → met à jour outbox/campaigns/suppression.
5. **Runner d'automation** : cron + `lib/mail/automation/runner.ts` → orchestration des workflows.

## §2 — Reverse proxy + SSO middleware

### 2.1 — Architecture du proxy

```
Navigateur admin                                             Listmonk Go
─────────────────                                            ────────────
GET /admin/emails/listmonk/admin/campaigns
   │
   ▼
Next.js middleware.ts ──► verifyAdminSession()
   │
   ▼ (session OK)
RSC page /admin/emails/listmonk renders <iframe src="/listmonk/admin/campaigns" />
   │
   ▼
GET /listmonk/admin/campaigns  (route handler proxy)
   │
   ▼
middleware/listmonk-sso.ts ──► injecte:
   - X-Forwarded-User: admin@femiglow-maroc.com
   - X-Forwarded-Email: ...
   - Authorization: Basic <listmonk-api-user>:<listmonk-api-token>
   - X-FemiGlow-Audit-Trace: <ulid>
   │
   ▼ fetch(http://127.0.0.1:9000/admin/campaigns, { headers, body, method })
   │                                                     │
   │                                                     ▼
   │                                              Listmonk traite
   │                                                     │
   ◄─── response (HTML/JSON/JS/CSS) ─────────────────────┘
   │
   ▼ stream → client
```

### 2.2 — Implémentation du proxy

Fichier : `apps/web/src/app/api/listmonk/[...path]/route.ts`

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { logger } from '@/lib/logging/logger';
import { ulid } from 'ulid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LISTMONK_URL = process.env.LISTMONK_INTERNAL_URL ?? 'http://127.0.0.1:9000';
const LISTMONK_USER = process.env.LISTMONK_API_USER!;
const LISTMONK_TOKEN = process.env.LISTMONK_API_TOKEN!;
const BASIC = `Basic ${Buffer.from(`${LISTMONK_USER}:${LISTMONK_TOKEN}`).toString('base64')}`;

const HOP_BY_HOP = new Set([
  'connection','keep-alive','proxy-authenticate','proxy-authorization',
  'te','trailers','transfer-encoding','upgrade','content-length','host',
]);

async function handler(req: NextRequest, ctx: { params: { path: string[] } }) {
  const adminSession = await requireAdmin(req);
  if (!adminSession) return new NextResponse('Unauthorized', { status: 401 });

  const traceId = ulid();
  const path = ctx.params.path.join('/');
  const url = new URL(`${LISTMONK_URL}/${path}`);
  url.search = req.nextUrl.search;

  // headers
  const headers = new Headers();
  for (const [k, v] of req.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
  }
  headers.set('Authorization', BASIC);
  headers.set('X-Forwarded-User', adminSession.email);
  headers.set('X-FemiGlow-Trace', traceId);

  const body = ['GET','HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();

  logger.info('listmonk.proxy.request', {
    method: req.method, path, traceId, user: adminSession.email,
  });

  const res = await fetch(url, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
  }).catch((err) => {
    logger.error('listmonk.proxy.error', { err: String(err), traceId });
    throw err;
  });

  // Streaming response back
  const responseHeaders = new Headers();
  for (const [k, v] of res.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) responseHeaders.set(k, v);
  }

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
```

### 2.3 — Composant iframe sécurisé

Fichier : `apps/web/src/components/admin/emails/ListmonkFrame.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  path: string;                 // ex: '/admin/campaigns'
  className?: string;
  onNavigate?: (path: string) => void;
};

export function ListmonkFrame({ path, className, onNavigate }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMessage(evt: MessageEvent) {
      if (evt.origin !== window.location.origin) return;
      if (evt.data?.type === 'listmonk:navigate' && typeof evt.data.path === 'string') {
        onNavigate?.(evt.data.path);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onNavigate]);

  return (
    <iframe
      ref={ref}
      title="Listmonk"
      src={`/api/listmonk${path}`}
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      className={cn(
        'h-[calc(100vh-9rem)] w-full rounded-lg border border-stone-200 bg-white',
        className,
      )}
    />
  );
}
```

### 2.4 — Sécurité

- **`sandbox`** : on autorise `same-origin` parce que le proxy renvoie depuis le même domaine. Pas de `allow-top-navigation`.
- **Aucun token Listmonk côté client** : tout passe par le proxy, qui injecte l'auth.
- **CSP** : ajouter `frame-src 'self'` dans `next.config.mjs` headers.
- **CSRF** : déjà géré par le middleware `requireAdmin` (session cookie SameSite=Strict).
- **Rate limit** : appliquer le rate-limit existant `lib/rate-limit/` sur `/api/listmonk/*` (100 req/min/user pour ne pas étouffer le proxy).

### 2.5 — Theming léger CSS

Pour atténuer le saut visuel Listmonk natif vs admin FemiGlow, on injecte un CSS custom via la route admin Listmonk (settings → custom CSS). Suffit pour :
- couleurs primaires (sauge brand)
- font-family (déjà partagée si Google Fonts)
- masquer le logo Listmonk natif et le remplacer par "FemiGlow Emails"

Cf. `09-infrastructure-setup.md` §6 pour le CSS exact.

## §3 — Transactional sender

### 3.1 — Module `lib/mail/`

```
lib/mail/
├── client.ts          ← nodemailer transport
├── send.ts            ← sendTransactional() — entrée publique
├── outbox.ts          ← retry runner + DLQ
├── suppression.ts     ← check before send
├── render.ts          ← react-email → { html, text }
├── catalog.ts         ← inventaire typé des templates
├── templates/         ← composants React
└── listmonk/          ← API client (broadcast/automation)
```

### 3.2 — `client.ts`

```ts
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';

let _transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    socketTimeout: 30_000,
    connectionTimeout: 10_000,
  });
  return _transporter;
}

export async function verifySmtp(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

### 3.3 — `send.ts`

```ts
import { ulid } from 'ulid';
import { db } from '@/db';
import { emailOutbox, emailSuppression } from '@/db/schema/emails';
import { getTransporter } from './client';
import { renderTemplate } from './render';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';

export type SendInput<TSlug extends keyof TemplateRegistry> = {
  template: TSlug;
  to: { email: string; name?: string };
  payload: TemplateRegistry[TSlug];
  idempotencyKey: string;
  scheduledFor?: Date;
  source?: string;
  createdByUserId?: string;
};

export async function sendTransactional<TSlug extends keyof TemplateRegistry>(
  input: SendInput<TSlug>,
): Promise<{ outboxId: string; status: 'queued' | 'suppressed' | 'duplicate' }> {
  const toEmail = input.to.email.toLowerCase().trim();

  // 1. Suppression check
  const suppressed = await db.select().from(emailSuppression).where(eq(emailSuppression.email, toEmail)).limit(1);
  if (suppressed.length > 0) {
    logger.info('mail.send.suppressed', { template: input.template, email: toEmail, reason: suppressed[0].reason });
    return { outboxId: '', status: 'suppressed' };
  }

  // 2. Idempotency
  const existing = await db.select().from(emailOutbox).where(eq(emailOutbox.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing.length > 0) {
    return { outboxId: existing[0].id, status: 'duplicate' };
  }

  // 3. Render
  const meta = getTemplateMeta(input.template);
  const { html, text, subject } = await renderTemplate(input.template, input.payload);

  // 4. INSERT outbox
  const id = ulid();
  await db.insert(emailOutbox).values({
    id,
    idempotencyKey: input.idempotencyKey,
    template: input.template,
    templateVersion: meta.version,
    toEmail,
    toName: input.to.name ?? null,
    fromEmail: getSettings().fromEmail,
    replyTo: getSettings().replyTo,
    subject,
    payloadJson: input.payload as any,
    status: input.scheduledFor ? 'pending' : 'pending',
    scheduledFor: input.scheduledFor ?? null,
    source: input.source ?? null,
    createdByUserId: input.createdByUserId ?? null,
  });

  // 5. Immediate attempt (fire-and-forget); cron picks up if fails
  if (!input.scheduledFor) {
    void attemptSend(id).catch((err) => logger.error('mail.send.immediate_attempt_failed', { id, err: String(err) }));
  }

  logAuditEvent({ category: 'mail.send', action: 'queued', subjectId: id, meta: { template: input.template, to: toEmail } });
  return { outboxId: id, status: 'queued' };
}

export async function attemptSend(outboxId: string): Promise<void> {
  // Atomic claim: status pending|failed → sending
  // ... (cf. outbox.ts pour le détail FOR UPDATE SKIP LOCKED)
  // Render + send via nodemailer + update outbox
}
```

### 3.4 — `outbox.ts` — runner cron

```ts
import { db } from '@/db';
import { emailOutbox } from '@/db/schema/emails';
import { sql } from 'drizzle-orm';
import { computeBackoff } from './backoff';

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;

export async function pickAndProcessBatch(): Promise<{ picked: number; succeeded: number; failed: number }> {
  // Lock + claim batch
  const rows = await db.execute(sql`
    UPDATE email_outbox
    SET status = 'sending', updated_at = now()
    WHERE id IN (
      SELECT id FROM email_outbox
      WHERE status IN ('pending', 'failed')
        AND (next_retry IS NULL OR next_retry <= now())
        AND attempts < max_attempts
        AND (scheduled_for IS NULL OR scheduled_for <= now())
      ORDER BY next_retry NULLS FIRST, created_at ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `);

  let succeeded = 0;
  let failed = 0;
  for (const row of rows.rows) {
    try {
      await deliver(row);
      succeeded++;
    } catch (err) {
      const nextAttempts = row.attempts + 1;
      const reachedMax = nextAttempts >= MAX_ATTEMPTS;
      await db.update(emailOutbox).set({
        status: reachedMax ? 'dlq' : 'failed',
        attempts: nextAttempts,
        nextRetry: reachedMax ? null : new Date(Date.now() + computeBackoff(nextAttempts)),
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      }).where(eq(emailOutbox.id, row.id));
      failed++;
    }
  }
  return { picked: rows.rows.length, succeeded, failed };
}
```

### 3.5 — Backoff

```ts
// computeBackoff(attempt) → ms
// Exponentiel + jitter, plafonné à 1 h
export function computeBackoff(attempt: number): number {
  const base = Math.min(60_000 * 2 ** (attempt - 1), 3_600_000); // 1m, 2m, 4m, 8m, 16m, ..., max 60m
  const jitter = Math.random() * 0.3 * base;
  return Math.round(base + jitter);
}
```

### 3.6 — Endpoint cron

`apps/web/src/app/api/cron/email-outbox/route.ts` :

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!verifyCronAuth(req)) return new Response('Unauthorized', { status: 401 });
  const result = await pickAndProcessBatch();
  return Response.json(result);
}
```

Déclaré dans `femiglow-cron-email-outbox.service` (systemd, toutes les 60 s). **Prérequis : les crons FemiGlow doivent être réparés (cf. M0)**.

## §4 — Webhooks Stalwart

### 4.1 — Configuration côté Stalwart

Via la console admin Stalwart ou `stalwart-cli` :

```bash
stalwart-cli create webhook \
  --url "https://admin.femiglow-maroc.com/api/mail/webhook/stalwart" \
  --events "message.delivered,message.queued,message.delivery-failed,message.delivery-deferred,auth.failure" \
  --auth-header "Authorization: Bearer ${FEMIGLOW_STALWART_WEBHOOK_SECRET}"
```

### 4.2 — Endpoint receveur

`apps/web/src/app/api/mail/webhook/stalwart/route.ts` :

```ts
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { emailOutbox, emailEvent, emailSuppression } from '@/db/schema/emails';
import { eq, and } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

const SECRET = process.env.FEMIGLOW_STALWART_WEBHOOK_SECRET!;

const eventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('message.queued'),  queueId: z.string(), messageId: z.string(), rcpt: z.array(z.string()), size: z.number(), ts: z.string() }),
  z.object({ event: z.literal('message.delivered'), queueId: z.string(), messageId: z.string(), rcpt: z.string(), ts: z.string() }),
  z.object({ event: z.literal('message.delivery-failed'), queueId: z.string(), messageId: z.string(), rcpt: z.string(), errorCode: z.number(), reason: z.string(), ts: z.string() }),
  z.object({ event: z.literal('message.delivery-deferred'), queueId: z.string(), messageId: z.string(), rcpt: z.string(), nextRetry: z.string(), ts: z.string() }),
  z.object({ event: z.literal('auth.failure'), user: z.string(), ip: z.string(), ts: z.string() }),
]);

export async function POST(req: NextRequest) {
  // Auth
  const auth = req.headers.get('Authorization') ?? '';
  const expected = `Bearer ${SECRET}`;
  if (!constantTimeEqual(auth, expected)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const raw = await req.json();
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return new Response('Bad payload', { status: 400 });
  const evt = parsed.data;

  // Look up outbox via messageId
  if ('messageId' in evt) {
    const outbox = await db.select().from(emailOutbox).where(eq(emailOutbox.smtpMessageId, evt.messageId)).limit(1);
    if (outbox.length === 0) {
      // Could be Listmonk's send — pass through
      return new Response('Unknown messageId, ignored', { status: 202 });
    }
    const o = outbox[0];

    if (evt.event === 'message.delivered') {
      await db.update(emailOutbox).set({ status: 'delivered', deliveredAt: new Date(evt.ts), updatedAt: new Date() }).where(eq(emailOutbox.id, o.id));
      await db.insert(emailEvent).values({ outboxId: o.id, type: 'delivered', source: 'stalwart', ts: new Date(evt.ts), rawJson: evt as any });
    } else if (evt.event === 'message.delivery-failed') {
      const isHard = evt.errorCode >= 500 && evt.errorCode < 600;
      await db.update(emailOutbox).set({
        status: isHard ? 'bounced_permanent' : 'bounced_soft',
        bouncedAt: new Date(evt.ts),
        bounceReason: evt.reason,
        bounceType: isHard ? 'hard' : 'soft',
        updatedAt: new Date(),
      }).where(eq(emailOutbox.id, o.id));
      await db.insert(emailEvent).values({ outboxId: o.id, type: isHard ? 'bounced_hard' : 'bounced_soft', source: 'stalwart', ts: new Date(evt.ts), rawJson: evt as any });
      if (isHard) {
        await db.insert(emailSuppression).values({ email: o.toEmail, reason: 'hard_bounce', detail: evt.reason, source: 'stalwart' }).onConflictDoNothing();
      }
    } else if (evt.event === 'message.delivery-deferred') {
      await db.insert(emailEvent).values({ outboxId: o.id, type: 'retried', source: 'stalwart', ts: new Date(evt.ts), rawJson: evt as any });
    }
  } else if (evt.event === 'auth.failure') {
    // Audit alert
    logger.warn('mail.smtp.auth_failure', { user: evt.user, ip: evt.ip });
  }
  return new Response('OK', { status: 200 });
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
```

## §5 — Webhooks Listmonk

Configuration Listmonk : Settings → Webhooks → ajouter URL `https://admin.femiglow-maroc.com/api/mail/webhook/listmonk` avec secret HMAC. Events souscrits :
- `subscriber.created`, `subscriber.updated`, `subscriber.unsubscribed`
- `campaign.started`, `campaign.completed`
- `subscriber.bounced`, `subscriber.complained`

`apps/web/src/app/api/mail/webhook/listmonk/route.ts` : parse + dispatch sur les tables miroir (`email_campaign_link`, `email_subscriber_link`, `email_suppression`).

Validation HMAC : `X-Listmonk-Signature: sha256=...` calculé sur body avec `LISTMONK_WEBHOOK_SECRET`.

## §6 — Réception programmatique (non-objectif M0-M5)

Si plus tard on veut traiter automatiquement des mails entrants (ex. tickets support, replies threadées) :

```bash
# Côté Stalwart : webhook ciblé message.received pour un compte
stalwart-cli create webhook \
  --url "https://admin.femiglow-maroc.com/api/mail/webhook/inbound" \
  --events "message.received" \
  --filter "rcpt=support@femiglow-maroc.com" \
  --auth-header "Authorization: Bearer ${SECRET}"
```

Endpoint FemiGlow : parse MIME (via `mailparser`), match `In-Reply-To` ↔ `Message-ID` outbox/campaign → crée un ticket / log dans une table `mail_inbound`. Pas implémenté M0-M5, juste documenté pour évolution future.

## §7 — API client Listmonk typé

`apps/web/src/lib/mail/listmonk/client.ts` :

```ts
import { z } from 'zod';
import { env } from '@/lib/env';

const BASE = env.LISTMONK_INTERNAL_URL;
const AUTH = `Basic ${Buffer.from(`${env.LISTMONK_API_USER}:${env.LISTMONK_API_TOKEN}`).toString('base64')}`;

async function lm<T>(path: string, init?: RequestInit, schema?: z.ZodSchema<T>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: AUTH, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ListmonkApiError(res.status, path, text);
  }
  const data = await res.json();
  return schema ? schema.parse(data) : (data as T);
}

export const listmonk = {
  campaigns: {
    list: () => lm<{ data: { results: Campaign[] } }>('/api/campaigns'),
    create: (input: NewCampaign) => lm('/api/campaigns', { method: 'POST', body: JSON.stringify(input) }),
    get: (id: number) => lm<{ data: Campaign }>(`/api/campaigns/${id}`),
    update: (id: number, patch: Partial<Campaign>) => lm(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    schedule: (id: number, sendAt: Date) => lm(`/api/campaigns/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'scheduled', send_at: sendAt.toISOString() }) }),
    cancel: (id: number) => lm(`/api/campaigns/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) }),
  },
  lists: {
    list: () => lm<{ data: { results: List[] } }>('/api/lists?per_page=all'),
    create: (input: NewList) => lm('/api/lists', { method: 'POST', body: JSON.stringify(input) }),
  },
  subscribers: {
    upsert: (input: NewSubscriber) => lm('/api/subscribers', { method: 'POST', body: JSON.stringify(input) }),
    bulkAdd: (emails: string[], listIds: number[]) => lm('/api/subscribers/lists', { method: 'PUT', body: JSON.stringify({ ids: emails, target_list_ids: listIds }) }),
    blocklist: (email: string) => lm(`/api/subscribers/blocklist`, { method: 'PUT', body: JSON.stringify({ ids: [email] }) }),
  },
  templates: {
    list: () => lm<{ data: Template[] }>('/api/templates'),
    create: (input: NewTemplate) => lm('/api/templates', { method: 'POST', body: JSON.stringify(input) }),
  },
  transactional: {
    send: (input: TxSend) => lm('/api/tx', { method: 'POST', body: JSON.stringify(input) }),
  },
};

export class ListmonkApiError extends Error {
  constructor(public status: number, public path: string, public body: string) {
    super(`Listmonk ${status} on ${path}: ${body}`);
  }
}
```

## §8 — Cron jobs ajoutés

| Service systemd | Fréquence | Rôle |
|---|---|---|
| `femiglow-cron-email-outbox.service` | toutes les 60 s | Pickup batch outbox, attempt send |
| `femiglow-cron-email-suppression-sync.service` | toutes les 5 min | Sync `email_suppression` ↔ Listmonk blocklist (bidirectionnel) |
| `femiglow-cron-email-audience-sync.service` | toutes les 5 min | Refresh `email_audience_link.subscriberCount` depuis Listmonk |
| `femiglow-cron-email-automation.service` | toutes les 60 s | Avancer les `email_automation_run` |
| `femiglow-cron-email-mv-refresh.service` | toutes les 5 min | `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_email_*` |
| `femiglow-cron-email-prune.service` | quotidien | Purge snapshots > 90 j, events > 180 j |

Tous suivent le pattern existant `femiglow-cron-tick.service`. **Cf. `09-infrastructure-setup.md` §5** pour les unit files.

## §9 — Sécurité backend

- **Secrets** : tous dans `apps/web/.env` (chmod 600). Variables ajoutées :
  ```
  SMTP_HOST=127.0.0.1
  SMTP_PORT=587
  SMTP_USER=noreply@femiglow-maroc.com
  SMTP_PASSWORD=<généré>
  MAIL_FROM=FemiGlow <noreply@femiglow-maroc.com>
  MAIL_REPLY_TO=info@femiglow-maroc.com
  LISTMONK_INTERNAL_URL=http://127.0.0.1:9000
  LISTMONK_API_USER=femiglow-app
  LISTMONK_API_TOKEN=<généré>
  LISTMONK_WEBHOOK_SECRET=<généré>
  FEMIGLOW_STALWART_WEBHOOK_SECRET=<généré>
  ```
- **Validation** : Zod sur toutes les entrées (API publiques ET webhooks).
- **Rate limit** : `/api/admin/emails/*` → 60 req/min/user ; `/api/mail/webhook/*` → 600 req/min/IP (Stalwart peut burster).
- **Audit log** : tout INSERT campaign / template / send manuel → `logAuditEvent({ category: 'mail.*' })`.
- **TLS only** : reject any plaintext SMTP (port 25 inbound only, jamais utilisé en émission interne).

## §10 — Références

- `apps/web/src/lib/webhooks/engine.ts` — pattern engine réutilisable
- `apps/web/src/lib/webhooks/backoff.ts` — pattern exponentiel + jitter à factoriser
- `apps/web/src/lib/admin/auth.ts` — `requireAdmin()` existant
- `apps/web/src/lib/audit/log-event.ts` — audit log existant
- `apps/web/src/lib/rate-limit/` — rate limiter existant
- Listmonk API docs : https://listmonk.app/docs/apis/apis/
- Stalwart webhooks docs : https://stalw.art/docs/server/webhooks
