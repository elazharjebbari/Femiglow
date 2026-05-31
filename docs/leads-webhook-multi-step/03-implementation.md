# 3. Plan d'implémentation

Découpé en 6 milestones séquentiels, avec M6 dédié à la configuration et à la visualisation admin.

## M1 — Extensions schéma (≈30 min)

### M1.1 — Migration SQL

Créer `drizzle/migrations/00XX_lead_step1_abandon.sql` :

```sql
-- Anti-doublon webhook step 2 (PATCH adresse)
ALTER TABLE chat_lead ADD COLUMN step2_webhook_at timestamp;

-- Anti-doublon webhook step 1 abandon (cron scanner)
ALTER TABLE chat_lead ADD COLUMN step1_abandon_webhook_at timestamp;

-- Index pour scanner (partial index sur les leads à traiter)
CREATE INDEX idx_chat_lead_step1_abandon_pending
  ON chat_lead (lead_captured_at)
  WHERE address_completed_at IS NULL
    AND purchased_at IS NULL
    AND step1_abandon_webhook_at IS NULL;
```

### M1.2 — Schéma Drizzle TypeScript

`lib/chat/db/schema.ts` (autour de la ligne 530, section chat_lead) :

```ts
step2WebhookAt: timestamp('step2_webhook_at'),
step1AbandonWebhookAt: timestamp('step1_abandon_webhook_at'),
```

### M1.3 — Seed setting timeout

Dans `drizzle/migrations/00XX_lead_step1_abandon.sql` (suite) :

```sql
INSERT INTO tracking_settings (key, value, updated_at)
VALUES ('lead.step1_abandon_timeout_minutes', '5'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO tracking_settings (key, value, updated_at)
VALUES ('lead.step2_webhook_enabled', 'true'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
```

### M1.4 — Test migration

```bash
psql -d femiglow -c "\d chat_lead" | grep -E "step1_abandon|step2_webhook"
psql -d femiglow -c "SELECT key, value FROM tracking_settings WHERE key LIKE 'lead.%';"
```

---

## M2 — Payload format enrichi (≈45 min)

### M2.1 — Étendre le schéma Zod payload

`lib/webhooks/outbound/payload.ts` :

```ts
export const conversationMessageSchema = z.object({
  role: z.enum(['user', 'bot', 'assistant', 'system']),
  name: z.string().max(80).optional(),
  text: z.string().max(4000),
  ts: z.string().datetime({ offset: true }),
});
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

export const outboundPayloadSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_:.-]+$/).max(120),
  ref: z.string().max(100).optional(),
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(4).max(40),
  source: z.string().max(60).optional(),                       // ← nouveau
  conversation: z.array(conversationMessageSchema).max(50).optional(), // ← nouveau
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(80).optional(),
  email: z.string().email().max(200).optional(),
  total_price: z.number().min(0).optional(),
  currency: z.string().length(3).default('MAD'),
  quantity: z.number().int().min(1).default(1),
  product_name: z.string().max(300).optional(),
  product_variant: z.string().max(200).optional(),
  product_sku: z.string().max(100).optional(),
  note: z.string().max(2000).optional(),
  source_channel: z.string().max(60).optional(),
  ip: z.string().max(64).optional(),
});
```

### M2.2 — Helper de mapping conversation

Nouveau fichier `lib/webhooks/outbound/helpers/conversation.ts` :

```ts
import type { ConversationMessage } from '../payload';

interface SnapshotMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  at: string;
}

export function buildConversationFromSnapshot(
  snapshot: SnapshotMessage[] | null | undefined,
  userName: string | null,
  opts?: { maxMessages?: number; maxTextLen?: number },
): ConversationMessage[] | undefined {
  if (!snapshot || snapshot.length === 0) return undefined;
  const maxMessages = opts?.maxMessages ?? 50;
  const maxTextLen = opts?.maxTextLen ?? 4000;
  const sliced = snapshot.slice(-maxMessages); // garde les N derniers
  return sliced
    .filter((m) => m.role !== 'system' && m.role !== 'tool')
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('bot' as const),
      name: m.role === 'user' ? userName ?? 'Visiteur' : 'Assistant',
      text: m.content.slice(0, maxTextLen),
      ts: m.at,
    }));
}
```

### M2.3 — Tests unitaires helper

`lib/webhooks/outbound/helpers/conversation.test.ts` :
- snapshot vide / null → undefined
- snapshot user-only → role 'user', name=firstName
- snapshot assistant-only → role 'bot', name='Assistant'
- snapshot mixed → ordre conservé
- snapshot > 50 messages → tronqué aux 50 derniers
- snapshot avec system/tool → filtrés
- text > 4000 chars → tronqué

---

## M3 — Builders + routes (≈2h)

### M3.1 — Modifier `from-chat-lead.ts`

Ajouter dans le payload :

```ts
import { buildConversationFromSnapshot } from '../helpers/conversation';

// dans la fonction de build :
const conversation = buildConversationFromSnapshot(
  lead.snapshotMessages,
  lead.firstName,
);

const payload = {
  id: `chat-lead:${lead.id}`,
  full_name: composeFullName(lead.firstName),
  phone: …,
  source: lead.source ?? 'chat',
  conversation,                            // ← ajout
  email: lead.email ?? undefined,
  note: …,
  source_channel: `chat:${lead.triggerReason}`,
  quantity: 1,
  currency: 'MAD',
  ip: ip ?? undefined,
};
```

### M3.2 — Nouveau builder `from-wizard-step2.ts`

`lib/webhooks/outbound/sources/from-wizard-step2.ts` (nouveau) :

```ts
import { dispatchOutbound } from '../dispatcher';
import { buildConversationFromSnapshot } from '../helpers/conversation';
import type { ChatLeadRow } from '@/lib/chat/db/schema-types';

export async function dispatchLeadStep2Webhook(args: {
  lead: ChatLeadRow;
  ip?: string;
}): Promise<void> {
  const { lead, ip } = args;
  if (lead.step2WebhookAt) return; // déjà envoyé
  if (!lead.addressCompletedAt) return; // pas encore step2

  // Inclure conversation si le lead a une origine chat
  const conversation = lead.snapshotMessages
    ? buildConversationFromSnapshot(lead.snapshotMessages, lead.firstName)
    : undefined;

  const payload = {
    id: `lead-step2:${lead.id}`,
    full_name: composeFullName(lead.firstName, lead.lastName),
    phone: formatPhoneForWebhook(lead.phoneE164 ?? lead.phoneRaw),
    source: lead.source ?? 'wizard',
    source_channel: lead.formId ?? lead.source ?? 'wizard',
    conversation,
    address: composeAddress(lead.shippingAddressLine1, lead.shippingAddressLine2),
    city: lead.shippingCity,
    country: COUNTRY_LABEL[lead.shippingCountry ?? 'MA'],
    email: lead.email ?? undefined,
    note: lead.shippingNotes ?? undefined,
    quantity: 1,
    currency: lead.cartCurrency ?? 'MAD',
    ip,
  };

  await dispatchOutbound({
    source: 'lead-step2',
    sourceId: lead.id,
    idempotencyKey: `lead-step2:${lead.id}`,
    eventName: 'lead.step2_completed',
    payload,
  });

  // Stamp anti-doublon (best effort, le UNIQUE INDEX log côté DB fait foi)
  await wizardLeadRepo.stampStep2Webhook(lead.id);
}
```

### M3.3 — Appel depuis route address

Modifier `/app/api/checkout/lead/[leadId]/address/route.ts` :

```ts
// après PATCH chat_lead réussi
const lead = await wizardLeadRepo.findById(leadId);
if (lead && (await isStep2WebhookEnabled())) {
  // fire-and-forget
  dispatchLeadStep2Webhook({ lead, ip: getClientIp(req) }).catch((err) => {
    logger.warn('lead.step2 webhook failed (fire-and-forget)', { err, leadId });
  });
}
```

### M3.4 — Nouveau builder `from-wizard-step1-abandon.ts`

Idem que step2 mais payload minimal (pas d'address, pas de note, juste full_name/phone/source/gclid/ip).

### M3.5 — Cron scanner

`lib/webhooks/outbound/lead-step1-abandon-scanner.ts` (nouveau) :

```ts
import { db } from '@/lib/db/client';
import { chatLead } from '@/lib/chat/db/schema';
import { and, isNull, lt, sql } from 'drizzle-orm';
import { dispatchLeadStep1AbandonWebhook } from './sources/from-wizard-step1-abandon';
import { getLeadStep1AbandonTimeoutMinutes } from '@/lib/tracking/settings';

export async function scanAndDispatchStep1Abandons(): Promise<{
  scanned: number; dispatched: number; failed: number;
}> {
  const timeoutMin = await getLeadStep1AbandonTimeoutMinutes(); // default 5
  const threshold = new Date(Date.now() - timeoutMin * 60_000);

  const leads = await db
    .select()
    .from(chatLead)
    .where(
      and(
        lt(chatLead.leadCapturedAt, threshold),
        isNull(chatLead.addressCompletedAt),
        isNull(chatLead.purchasedAt),
        isNull(chatLead.step1AbandonWebhookAt),
        // safety : pas de chat lead pure (déjà géré par from-chat-lead)
        // → on ne traite que les leads wizard (source IN wizard_*)
        sql`source LIKE 'wizard_%'`,
      ),
    )
    .limit(100);

  let dispatched = 0;
  let failed = 0;
  for (const lead of leads) {
    try {
      await dispatchLeadStep1AbandonWebhook({ lead });
      dispatched++;
    } catch (err) {
      logger.warn('step1_abandon webhook failed', { err, leadId: lead.id });
      failed++;
    }
  }
  return { scanned: leads.length, dispatched, failed };
}
```

### M3.6 — Endpoint cron

`app/api/cron/lead-step1-abandon/route.ts` (nouveau) :

```ts
export async function POST(req: Request) {
  await assertCronSecret(req); // header X-Cron-Secret check
  const result = await scanAndDispatchStep1Abandons();
  return Response.json(result);
}
```

### M3.7 — Cron schedule

Ajouter dans `app/api/cron/tick/route.ts` (tick principal toutes les 60s) :

```ts
const step1Abandons = await scanAndDispatchStep1Abandons().catch(…);
```

Ou si plus simple : crontab système toutes les 5 minutes appelle `/api/cron/lead-step1-abandon`.

---

## M4 — Settings admin UI (≈1h)

### M4.1 — Helper de lecture settings

`lib/tracking/settings/lead-settings.ts` (nouveau) :

```ts
import { getTrackingSettings } from '@/lib/tracking/settings/repository';

const CACHE_TTL = 60_000;
let cache: { value: number; expiresAt: number } | null = null;

export async function getLeadStep1AbandonTimeoutMinutes(): Promise<number> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const settings = await getTrackingSettings();
  const raw = settings['lead.step1_abandon_timeout_minutes'];
  const minutes = typeof raw === 'number' ? raw : 5;
  const clamped = Math.max(1, Math.min(60, minutes));
  cache = { value: clamped, expiresAt: Date.now() + CACHE_TTL };
  return clamped;
}

export async function isStep2WebhookEnabled(): Promise<boolean> {
  const settings = await getTrackingSettings();
  const raw = settings['lead.step2_webhook_enabled'];
  return raw !== false; // default true
}

export function invalidateLeadSettingsCache() {
  cache = null;
}
```

### M4.2 — Server action update setting

`app/admin/tracking/settings/actions.ts` :

```ts
'use server';

import { invalidateLeadSettingsCache } from '@/lib/tracking/settings/lead-settings';
import { setTrackingSetting } from '@/lib/tracking/settings/repository';
import { revalidatePath } from 'next/cache';

export async function updateLeadStep1Timeout(minutes: number) {
  if (minutes < 1 || minutes > 60) {
    return { ok: false, error: 'Doit être entre 1 et 60 minutes' };
  }
  await setTrackingSetting('lead.step1_abandon_timeout_minutes', minutes);
  invalidateLeadSettingsCache();
  revalidatePath('/admin/tracking/settings');
  return { ok: true };
}
```

### M4.3 — Composant UI

`components/admin/tracking/settings/LeadAbandonTimeoutSetting.tsx` (nouveau) :

Champ number 1-60, bouton "Sauvegarder", toast feedback, tooltip explicatif.

### M4.4 — Page admin

Insérer dans `/admin/tracking/settings/page.tsx` :
- Section "Leads — gestion abandon"
- Toggle "Webhook step 2 activé"
- Input "Délai abandon step 1 (minutes)"

---

## M5 — Documentation in-app (≈30 min)

### M5.1 — Section help panel

Ajouter dans `TrackingHelpPanel.tsx` (ou nouveau panel similaire) une section "Webhook leads multi-step" expliquant :
- Les 4 events (`lead.step1_abandoned`, `lead.step2_completed`, `order.completed`, `chat_lead.created`)
- Quel event fire quand
- Format payload
- Setting timeout

### M5.2 — Lien depuis page lead/webhook

Page `/admin/leads/webhooks` (peut être à créer) :
- Liste des derniers logs `outbound_webhook_log`
- Filtrable par status / source / event
- Bouton retry par ligne
- Lien vers la doc

---

---

## M6 — Admin UI : config + visualisation leads/webhook (≈4h)

Cette milestone est détaillée intégralement dans [`06-ui-ux-integration.md`](./06-ui-ux-integration.md) avec wireframes, charte graphique, composants et flow data. Récap ici des sous-tâches ordonnées.

### M6.1 — API endpoints (≈45 min)

- `GET /api/admin/leads` : enrichir la réponse avec `journey` (step1Done/step2Done/purchaseDone/dataPct/abandonedAt) et `webhookSummary` (lastStatus/lastEvent/failedCount/pendingCount). Joindre `outbound_webhook_log` via sous-requête lateral.
- `GET /api/admin/leads/kpi` (nouveau) : compteurs 24h pour les 4 KPI cards + ratio step1→step2 et step2→purchase.
- `GET /api/admin/leads/funnel` (nouveau) : stats 7j pour le mini-funnel (drop-off par étape).
- `GET /api/admin/leads/[id]/webhook-history` (nouveau) : tous les logs `outbound_webhook_log WHERE source_id = leadId` ordonnés desc.
- `GET /api/admin/webhooks/logs` (nouveau) : liste paginée tous logs avec filtres (source/event/status/date).
- `GET /api/admin/webhooks/health` (nouveau) : `{ urlConfigured, secretConfigured, successRate24h, failedCount24h, lastSentAt }`.
- `POST /api/admin/webhooks/retry` (nouveau) : `{ logId }` → re-dispatch avec idempotencyKey suffixé `:retry-<n>`.
- `POST /api/admin/webhooks/test` (nouveau) : envoie payload dummy `{ id: test:<ts>, … }` pour valider la chaîne réseau.

### M6.2 — Composants atomiques (≈1h15)

Créer dans cet ordre :
1. `components/admin/webhooks/WebhookStatusBadge.tsx` (~30 lignes) — map status → badge stone/emerald/rose/amber. Pattern copié de `StatusBadge` emails.
2. `components/admin/leads/JourneyDots.tsx` (~40 lignes) — 3 dots SVG remplis/vides + label + tooltip.
3. `components/admin/leads/JourneyTimeline.tsx` (~120 lignes) — `<ol>` sémantique avec cercles connectés.
4. `components/admin/leads/LeadFunnelMini.tsx` (~80 lignes) — 3 bars CSS pure avec animation width.
5. `components/admin/leads/LeadKpiCards.tsx` (~60 lignes) — 4 cards cliquables (filtrent la table via URL params).
6. `components/admin/webhooks/WebhookSummaryList.tsx` (~80 lignes) — utilise `WebhookStatusBadge`.
7. `components/admin/webhooks/WebhookHealthBadge.tsx` (~100 lignes) — pattern `HealthBadge` emails.

### M6.3 — Drawer historique webhook (≈45 min)

`components/admin/leads/LeadWebhookHistoryDrawer.tsx` (~200 lignes)
- Pattern slide-in droite copié de `ConversationQuickView` (Esc, focus trap, body scroll lock)
- Lazy fetch `/api/admin/leads/[id]/webhook-history` on-open
- Affiche : event name, status, tentatives, payload JSON (avec bouton "Copier"), signature HMAC, bouton "Rejouer"
- Bouton "Rejouer" → POST `/api/admin/webhooks/retry` + toast feedback

### M6.4 — Page `/admin/leads` enrichie (≈30 min)

Modifier `app/admin/leads/page.tsx` :
- Ajouter au-dessus des filtres : `<LeadKpiCards stats={kpi} />` + `<LeadFunnelMini stats={funnel} />`
- Ajouter dans le filtre : select "Parcours" (step1/step2/purchase/abandon) + select "Webhook" (sent/pending/failed)
- Ajouter dans la table 2 colonnes : `<JourneyDots>` + `<WebhookStatusBadge clickable onClick={openDrawer} />`
- Wire le drawer en bas de page

### M6.5 — Page `/admin/leads/[id]` enrichie (≈45 min)

Modifier `app/admin/leads/[id]/page.tsx` :
- Ajouter section "Parcours wizard" avec `<JourneyTimeline>` + métadonnées (durée, étape d'abandon, données saisies/manquantes)
- Ajouter section "Livraisons webhook" avec `<WebhookSummaryList>` + bouton "Voir détail" qui ouvre le drawer
- Réutiliser le même `LeadWebhookHistoryDrawer` qu'en M6.4

### M6.6 — Page `/admin/tracking/settings` enrichie (≈30 min)

Modifier `app/admin/tracking/settings/page.tsx` :
- Ajouter en bas la section "Leads → Webhook outbound" avec :
  - `<WebhookHealthBadge summary={health} />` (cf. M6.1)
  - `<LeadsWebhookSettingsForm initialSettings={settings} />` (nouveau composant, ~150 lignes, pattern `ConsentBannerSettingsForm`)
  - Bouton "Envoyer un payload test" (POST `/api/admin/webhooks/test`)
  - Sous-section "Logs récents" : 4 derniers logs + lien "Voir tous →" vers `/admin/tracking/webhooks/logs`

Composant `LeadsWebhookSettingsForm` :
- Toggle `lead.step2_webhook_enabled` (checkbox immédiat)
- Toggle `lead.step1_abandon_enabled` (checkbox immédiat — nouveau setting)
- Input number `lead.step1_abandon_timeout_minutes` (range 1-60, debounce 500ms, save inline)
- Section read-only : URL endpoint + secret masqué (bouton "Afficher" 10s)

### M6.7 — Nouvelle page `/admin/tracking/webhooks/logs` (≈45 min)

- `app/admin/tracking/webhooks/logs/page.tsx` (nouveau)
- Wrap dans `TrackingShell` avec nouvel onglet "Logs"
- Composant `components/admin/webhooks/WebhookLogsTable.tsx` (~120 lignes)
- Filtres URL params (source, event, status, dateRange)
- KPI inline (total/sent/failed/skipped/latency p50/p95)
- Au clic sur ligne → ouvre le même `LeadWebhookHistoryDrawer` (par log.id)

### M6.8 — Étendre `GlobalCommandPalette` (≈15 min)

Ajouter 3 commandes Cmd-K :
- "Settings webhooks leads" → `/admin/tracking/settings#leads-webhook`
- "Voir logs webhook" → `/admin/tracking/webhooks/logs`
- "Rejouer derniers failed" → action: POST batch retry (avec confirmation modal)

### M6.9 — Tests E2E ajoutés (cf. `04-tests.md` §4.5)

3 nouveaux scénarios E2E :
- `admin-leads-journey-view.spec.ts` : ouvre /admin/leads, vérifie KPI cards + colonnes journey/webhook
- `admin-lead-detail-webhook.spec.ts` : ouvre /admin/leads/[id], vérifie timeline + drawer historique + retry button
- `admin-tracking-settings-leads.spec.ts` : toggle setting timeout + envoie payload test + vérifie webhook reçu

---

## Récap dépendances

```
M1 — schema migration            (bloque M2, M3, M6)
   ↓
M2 — payload schema + helper     (bloque M3)
   ↓
M3 — builders + routes + cron    (bloque M4, M6.1)
   ↓
M4 — admin settings backend       (bloque M6.6)
   ↓
M5 — doc                          (indépendant)
   ↓
M6 — admin UI integration         (dépend M3 + M4)
```

## Time estimate

| Milestone | Estimation | Cumul |
|---|---|---|
| M1 — schema | 30 min | 0:30 |
| M2 — payload | 45 min | 1:15 |
| M3 — builders + routes + cron | 2:00 | 3:15 |
| M4 — admin settings backend | 1:00 | 4:15 |
| M5 — doc | 30 min | 4:45 |
| M6 — admin UI integration | 4:00 | 8:45 |
| &nbsp;&nbsp;M6.1 — API endpoints | 0:45 | |
| &nbsp;&nbsp;M6.2 — Composants atomiques | 1:15 | |
| &nbsp;&nbsp;M6.3 — Drawer historique | 0:45 | |
| &nbsp;&nbsp;M6.4 — `/admin/leads` enrichie | 0:30 | |
| &nbsp;&nbsp;M6.5 — `/admin/leads/[id]` enrichie | 0:45 | |
| &nbsp;&nbsp;M6.6 — `/admin/tracking/settings` enrichie | 0:30 | |
| &nbsp;&nbsp;M6.7 — `/admin/tracking/webhooks/logs` | 0:45 | |
| &nbsp;&nbsp;M6.8 — CommandPalette | 0:15 | |
| Tests (cf. 04-tests.md) | 2:30 | **11:15** |
