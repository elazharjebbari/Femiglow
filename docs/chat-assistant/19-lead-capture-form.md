# 19 — Formulaire de capture de leads in-chat

> *Plan d'action — UI/UX, design, data, frontend, backend, tracking, sécurité, runbook — pour pousser un formulaire « prénom + téléphone » dans la conversation, le connecter au webhook et au datalayer, et le rattacher à la session qui l'a déclenché.*
>
> Doc parent : `00-cahier-des-charges.md`. Stratégie éditoriale (quand proposer le formulaire) : `18-instructions-knowledge-strategy.md` §6.3. Tracking global : `docs/tracking/`.

---

## 1. Objectif & contraintes

### 1.1 Objectif business

> *Capter le numéro WhatsApp du visiteur quand l'IA atteint sa limite, pour qu'un agent humain reprenne la main et confirme la commande.*

C'est **l'événement de conversion principal** du chat — supérieur en valeur à un `add_to_cart`. Le tunnel d'achat est fermé par l'agent humain (`+212 630 035 905`, lun-sam 9 h-17 h, Avenue Patrice Lumumba, Rabat Hassan).

### 1.2 Contraintes invariantes

| # | Contrainte | Implication |
|---|---|---|
| C1 | Pas de pop-up intrusive, pas de timer, pas de notification « offre » | Le formulaire est **inline dans la conversation**, sous forme de bulle agent enrichie |
| C2 | Une seule offre de formulaire par session par défaut | Anti-collant — si ignoré, plus de proposition pendant ≥ 4 messages |
| C3 | Pas de demande d'email obligatoire | Numéro suffit — l'email reste opt-in dans une étape ultérieure |
| C4 | RGPD : consentement explicite affiché, pas de case pré-cochée | `consent_version` stocké ; pas de tracking sans accord |
| C5 | Sécurité : rate-limit, validation côté serveur, anti-spam, vérif format MA | Cf. §7 |
| C6 | Réversible : visiteur peut « ignorer » → la conversation continue normalement | UX clé — pas de blocage |
| C7 | Connecté : `chat_lead.session_id` + `chat_lead.message_id` lient au contexte | Cf. §3 |
| C8 | Conversion datalayer : `generate_lead` émis au submit avec `value`, `currency`, `lead_id` | Cf. §6 |
| C9 | Webhook sortant : POST `LEAD_WEBHOOK_URL` (configurable admin) avec retry | Cf. §5.4 |
| C10 | Multilingue (FR/AR-RTL/AR-MA) sans fork visuel | Le composant lit `chatStore.language` |

### 1.3 Hors scope (pour cette V1)

- Pas de relance automatique par SMS / WhatsApp depuis le serveur (l'agent humain le fait manuellement).
- Pas de formulaire long (adresse, code postal) — uniquement prénom + téléphone + (optionnel) message court.
- Pas de double opt-in.

---

## 2. Architecture

```
                       ┌────────────────────────────────┐
                       │  ChatPanel (existing)          │
                       │  ├── ChatHeader                │
                       │  ├── MessageList               │
                       │  │     └── LeadFormBubble  NEW │   ← composant inline
                       │  └── ChatComposer              │
                       └─────────────┬──────────────────┘
                                     │ submit
                                     ▼
                       ┌────────────────────────────────┐
                       │ POST /api/chat/lead/contact    │   ← NEW route
                       │  Zod validate · rate-limit     │
                       │  insert chat_lead              │
                       │  emit conv event               │
                       │  fire webhook (queued)         │
                       │  emit datalayer generate_lead  │
                       └─────────────┬──────────────────┘
                                     │
                       ┌─────────────▼──────────────────┐
                       │ Webhook outbound  (background) │
                       │  retry × 3 expo                │
                       │  signature HMAC-SHA-256        │
                       └────────────────────────────────┘

  Triggers (côté orchestrator) :
    - intent contact_request / b2b / objection répétée / frustration
    - shouldOfferLeadForm(session, history) → true
  → l'orchestrator émet un évent SSE `lead-form-offer` consommé par le widget,
    qui ajoute une bulle LeadFormBubble dans la conversation.
```

---

## 3. Modèle de données

### 3.1 Nouvelle table `chat_lead`

À ajouter dans `apps/web/src/lib/chat/db/schema.ts` :

```ts
export const chatLead = pgTable(
  'chat_lead',
  {
    id: text('id').primaryKey(), // cl_xxxxxxxx
    sessionId: text('session_id')
      .notNull()
      .references(() => chatSession.id, { onDelete: 'cascade' }),
    // Message qui a *déclenché* l'offre (ou null si offert au seuil temporel)
    triggeringMessageId: text('triggering_message_id'),
    triggerReason: text('trigger_reason', {
      enum: [
        'explicit-request',
        'out-of-knowledge',
        'objection-repeat',
        'long-no-progress',
        'frustration',
        'after-hours',
        'b2b',
        'manual',
      ],
    }).notNull(),
    firstName: text('first_name').notNull(),
    phoneE164: text('phone_e164').notNull(), // normalisé +212XXXXXXXXX
    phoneRaw: text('phone_raw').notNull(),   // tel que tapé
    note: text('note'),                       // message libre court (optionnel)
    consentVersion: text('consent_version').notNull(), // ex: 'v1-2026-05'
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    visitorId: text('visitor_id').notNull(),
    fingerprintHash: text('fingerprint_hash'),
    page: text('page'),
    referrer: text('referrer'),
    utm: jsonb('utm').$type<Record<string, string>>(),
    language: text('language').notNull(), // 'fr' | 'ar' | 'ar-MA'
    intentAtCapture: text('intent_at_capture'),
    snapshotMessages: jsonb('snapshot_messages').$type<Array<{
      role: 'user' | 'assistant';
      content: string;
      at: string;
    }>>(),
    // Webhook lifecycle
    webhookStatus: text('webhook_status', {
      enum: ['pending', 'sent', 'failed', 'disabled'],
    })
      .notNull()
      .default('pending'),
    webhookAttempts: integer('webhook_attempts').notNull().default(0),
    webhookLastError: text('webhook_last_error'),
    webhookSentAt: timestamp('webhook_sent_at', { withTimezone: true }),
    // CRM lifecycle (optionnel — futur)
    handledBy: text('handled_by'),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    outcome: text('outcome', {
      enum: ['pending', 'reached', 'no-answer', 'converted', 'discarded'],
    })
      .notNull()
      .default('pending'),
    convertedOrderId: text('converted_order_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('chat_lead_session_idx').on(t.sessionId, t.createdAt),
    visitorIdx: index('chat_lead_visitor_idx').on(t.visitorId),
    outcomeIdx: index('chat_lead_outcome_idx').on(t.outcome, t.createdAt),
    webhookIdx: index('chat_lead_webhook_idx').on(t.webhookStatus, t.createdAt),
    phoneIdx: index('chat_lead_phone_idx').on(t.phoneE164),
  }),
);

export type ChatLeadRow = typeof chatLead.$inferSelect;
export type ChatLeadInsert = typeof chatLead.$inferInsert;
```

### 3.2 Lien fort avec `chat_session`

`chat_session.convertedOrderId` reste le slot de conversion finale (paiement confirmé). Le **lead** est une étape antérieure : on ajoute deux helpers en repo :

```ts
// repos/session.ts
export const sessionRepo = {
  // ...
  async markLeadCaptured(sessionId: string, leadId: string) {
    await db
      .update(chatSession)
      .set({ utm: sql`jsonb_set(coalesce(utm, '{}'::jsonb), '{leadId}', to_jsonb(${leadId}::text))` })
      .where(eq(chatSession.id, sessionId));
  },
};
```

### 3.3 Vues d'analyse (optionnelles, P1)

Vue matérialisée `chat_lead_funnel` à ajouter à `02-data.md` :

```sql
CREATE MATERIALIZED VIEW chat_lead_funnel AS
SELECT
  date_trunc('day', s.opened_at) AS day,
  count(distinct s.id) AS sessions,
  count(distinct e.session_id) FILTER (WHERE e.type = 'chat_lead_form_offered') AS offered,
  count(distinct e.session_id) FILTER (WHERE e.type = 'chat_lead_form_view')    AS viewed,
  count(distinct l.id) AS submitted,
  count(distinct l.id) FILTER (WHERE l.outcome = 'converted') AS converted
FROM chat_session s
LEFT JOIN chat_conversation_event e ON e.session_id = s.id
LEFT JOIN chat_lead l ON l.session_id = s.id
GROUP BY 1;
```

---

## 4. UI / UX & design

### 4.1 Forme du formulaire — bulle agent enrichie

Pas de modal, pas d'overlay. Le formulaire est rendu **dans la `MessageList`** comme une bulle de rôle `assistant` enrichie (variant `lead-form`) — la conversation continue de scroller naturellement.

```
┌──── Conversation ────────────────────────────────┐
│  …                                                │
│  · Visiteur : « Je veux parler à quelqu'un »      │
│                                                   │
│  · Agent  ┌────────────────────────────────────┐  │
│           │ Une conseillère peut vous rappeler.│  │
│           │                                    │  │
│           │ Prénom                             │  │
│           │ ┌──────────────────────────┐       │  │
│           │ │ Sara                     │       │  │
│           │ └──────────────────────────┘       │  │
│           │                                    │  │
│           │ Téléphone (WhatsApp)               │  │
│           │ ┌──┬───────────────────────┐       │  │
│           │ │MA│ 6 30 03 59 05         │       │  │
│           │ └──┴───────────────────────┘       │  │
│           │                                    │  │
│           │ ☐ J'accepte d'être contactée par   │  │
│           │   FemiGlow (RGPD).                 │  │
│           │                                    │  │
│           │ [   Demander un rappel    ]        │  │
│           │                                    │  │
│           │ Ignorer                            │  │
│           └────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

Variantes :
- **État succès** (après submit) : la bulle se transforme en : « Merci. Une conseillère vous rappelle dans la journée. » + horaires si hors plage.
- **État erreur réseau** : message d'erreur inline + bouton réessayer.

### 4.2 Tokens visuels (théme chat)

Réutilise les tokens existants (`chat_theme_preset.tokens`) — pas de nouveau token. Le formulaire s'inscrit dans la bulle assistant : fond crème (`--chat-surface`), texte encre (`--chat-text`), accent sauge (`--chat-accent`) pour le bouton primaire.

Espacements : `padding 16` extérieur, `gap 12` entre champs. Bord `radius 12`. Pas d'ombre interne.

### 4.3 Écriture — variations de copy

| Trigger | FR (texte de la bulle) | AR | AR-MA |
|---|---|---|---|
| `explicit-request` | « Bien sûr — laissez-moi votre prénom et numéro, on vous rappelle. » | « بكل سرور — اتركي اسمك ورقمك، سنتصل بكِ. » | « b kol s3ada — khelli smytek w nimrtek, ghadi n3ayttou lik. » |
| `out-of-knowledge` | « Je ne suis pas sûre sur ce point. Une conseillère peut vous rappeler — laissez votre numéro ? » | « لست متأكدة من هذا. ما رأيك بمكالمة من مستشارة؟ » | « ma 3andich jawab dqi9. khelli nimrtek w mounadima ghadi t3ayyat lik. » |
| `objection-repeat` | « Sur ce sujet, une conseillère pourra mieux que moi — voulez-vous être rappelée ? » | « في هذا الموضوع، الأفضل أن تتصل بكِ مستشارة. » | « 3la had l-mawdoo3, ahsan tt9bel ttisal mn mounadima. » |
| `after-hours` | « Nous sommes fermées maintenant. Je peux faire rappeler demain matin avant 11 h. » | « نحن مغلقات الآن. سأرتب اتصالاً غداً قبل الحادية عشرة. » | « daba mghlqin. ndir ttisal ghedda 9bel l-7adash. » |
| `b2b` | « Pour les instituts et spas, une conseillère B2B vous rappelle. » | « للمعاهد والسبا، تتصل بكِ مستشارة متخصصة. » | « lil ma3ahed w spa, mounadima mokhtassa ghadi t3ayyat. » |

### 4.4 Champ « Prénom »

| Attribut | Valeur |
|---|---|
| `type` | `text` |
| `name` | `firstName` |
| `autocomplete` | `given-name` |
| `inputmode` | `text` |
| `enterkeyhint` | `next` |
| `maxlength` | `40` |
| `required` | oui (validé `Zod min(2).max(40)`) |
| Capitalisation auto | `autocapitalize="words"` |
| Validation visuelle | bordure rouge + message inline si touché et invalide |

### 4.5 Champ « Téléphone »

C'est **le** champ critique. Il doit :

1. **Forcer le clavier numérique mobile** : `inputmode="tel"`, `type="tel"`.
2. **Préfixer le pays** : sélecteur `+212 (MA)` par défaut, mais avec liste (FR `+33`, ES `+34`, BE `+32` minimum) — utile pour la diaspora.
3. **Masquer/formater pendant la saisie** (Maroc) : `6 30 03 59 05` (séparateurs visuels, internalisés en `+212630035905` à l'envoi).
4. **Autocomplete** : `autocomplete="tel"`.
5. **Enter key hint** : `enterkeyhint="done"` (dernier champ).
6. **Validation client** : libphonenumber-js (déjà candidate pour `lib/phone.ts`) ou regex Maroc tolérante : `^(?:\+?212|0)?\s?6\d(?:\s?\d{2}){4}$`.
7. **Validation serveur** : libphonenumber-js avec `parsePhoneNumberWithError` + check `isValid()`. On stocke `phoneE164` normalisé + `phoneRaw`.
8. **Pas de paste indésirable** : on autorise paste mais on déclenche le formatter.
9. **Accessibilité** : `aria-describedby` pointe sur l'aide « format Maroc : 6XX XX XX XX ».

### 4.6 Case consentement RGPD

```html
<label class="flex items-start gap-2">
  <input type="checkbox" name="consent" required />
  <span>
    J'accepte d'être contactée par FemiGlow par téléphone ou WhatsApp.
    <a href="/legal/privacy">Politique de confidentialité</a>.
  </span>
</label>
```

Pas de pré-cochage. `consent_version='v1-2026-05'` figé en const partagée — bumpé si la politique change.

### 4.7 Champ « note » — optionnel

Caché derrière un *disclosure* « Ajouter un message » (link discret). Pour ne pas bloquer la soumission. `maxlength=200`. Sanitize côté serveur (on le sait déjà : `sanitizeAndRedact`).

### 4.8 Bouton primaire

| État | Apparence |
|---|---|
| idle | « Demander un rappel » (FR) / « طلب اتصال » (AR) / « Talab ttisal » (Darija) |
| submitting | spinner inline + label « Envoi… » + champs disabled |
| success | bulle remplacée — pas de bouton |
| error | bouton « Réessayer » |

Tous les états respectent `prefers-reduced-motion`.

### 4.9 Action secondaire « Ignorer »

Lien discret sous le bouton. Émet `chat_lead_form_dismiss` dans le datalayer + l'event chat. Le formulaire disparaît, la conversation reprend. **Aucune** réoffre pendant 4 messages.

### 4.10 Accessibilité (a11y)

| Critère | Implémentation |
|---|---|
| Focus visible | bordure `outline 2px var(--chat-focus)` |
| Annonce lecteur d'écran | la bulle a `role="region" aria-label="Formulaire de rappel"` |
| Erreurs annoncées | `aria-live="polite"` sur la zone d'erreur |
| Ordre de tabulation | prénom → téléphone (préfixe) → téléphone (numéro) → consent → submit → ignorer |
| Mobile soft-keyboard | `inputmode` + `enterkeyhint` corrects |
| Contraste | label + texte ≥ 4.5:1 ; placeholder ≥ 3:1 |
| RTL | `dir="rtl"` propagé depuis `chatStore.language === 'ar'` |
| Réduction de mouvement | pas de slide-in si `prefers-reduced-motion: reduce` |

### 4.11 Stories Storybook

À créer dans `apps/web/src/stories/chat/LeadFormBubble.stories.tsx` :
- `Default` (idle, FR)
- `RTL` (AR)
- `Darija`
- `Submitting`
- `Success`
- `Error_Network`
- `Error_InvalidPhone`
- `LongNote`
- `Dismissed` (transitionne)

---

## 5. Backend

### 5.1 Endpoint POST `/api/chat/lead/contact`

Nouveau fichier : `apps/web/src/app/api/chat/lead/contact/route.ts`.

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  sessionId: z.string().regex(/^cs_/),
  triggeringMessageId: z.string().regex(/^cm_/).nullable(),
  triggerReason: z.enum([...]),
  firstName: z.string().trim().min(2).max(40),
  phoneRaw: z.string().min(6).max(40),
  countryHint: z.enum(['MA', 'FR', 'ES', 'BE']).default('MA'),
  note: z.string().max(200).optional(),
  consent: z.literal(true),
  consentVersion: z.string(),
  language: z.enum(['fr', 'ar', 'ar-MA']),
});
```

Pipeline :

1. `assertChatEnabled()` (kill switch).
2. Rate-limit : `rateLimit.check({ scope: 'session', key: sessionId, max: 3, window: '15m' })` + `{ scope: 'ip', max: 10, window: '15m' }`.
3. Validate body Zod → 400 si invalide.
4. **Phone normalization** : `parsePhoneNumber(phoneRaw, countryHint)` → si invalide, 422 avec champ `phone`.
5. **Honeypot** : si body contient `website`/`url` non vide → 200 silencieux mais on ne persiste rien (anti-bot). Le composant inclura un champ honeypot `name="website"` invisible (`aria-hidden`, `tabindex=-1`, off-screen).
6. **Session existence + non purgée** : `sessionRepo.getById(sessionId)` → 404 sinon.
7. **Snapshot messages** : `messageRepo.listBySession(sessionId, { limit: 8 })` → tableau pour `snapshot_messages`.
8. `INSERT chat_lead` avec FK + utm + language + intentAtCapture (récupéré depuis le dernier event `message_sent_user.intent`).
9. `eventRepo.append(sessionId, 'chat_lead_form_submit', { leadId, triggerReason })`.
10. `sessionRepo.markLeadCaptured(sessionId, leadId)`.
11. **Webhook (background)** : enqueue (cf. §5.4) — pas bloquant.
12. **Réponse** : `200 { leadId, message: "..." }` + `Set-Cookie` rien (déjà géré par session).
13. **Logging** : `logger.info('chat.lead.captured', { sessionId, leadId, triggerReason, language })` (pas de PII en clair → `phoneE164` masqué `+212XXXXXX9505`).

### 5.2 Helper `phone.ts` — réutilisable

```ts
// apps/web/src/lib/phone.ts
import { parsePhoneNumberWithError, type CountryCode } from 'libphonenumber-js';

export function normalizePhone(raw: string, country: CountryCode = 'MA') {
  const p = parsePhoneNumberWithError(raw, country);
  if (!p.isValid()) throw new Error('invalid-phone');
  return {
    e164: p.number,                      // +212630035905
    formatted: p.formatInternational(),  // +212 630-035905
    country: p.country,
    isMobile: p.getType() === 'MOBILE' || p.getType() === 'FIXED_LINE_OR_MOBILE',
  };
}

export function maskE164(e164: string): string {
  // +212630035905 → +212XXXXXX9505 (pour logs)
  return e164.slice(0, 4) + 'XXXXXX' + e164.slice(-4);
}
```

### 5.3 Repo `leadRepo`

Nouveau fichier `apps/web/src/lib/chat/repos/lead.ts` :

```ts
export const leadRepo = {
  async create(input: ChatLeadInsert): Promise<ChatLeadRow> { ... },
  async getById(id: string): Promise<ChatLeadRow | null> { ... },
  async markWebhookSent(id: string) { ... },
  async markWebhookFailed(id: string, err: string, attempt: number) { ... },
  async listForAdmin(opts: { window: KpiWindow; outcome?: string; limit?: number }) { ... },
  async setOutcome(id: string, outcome: ChatLeadRow['outcome'], handledBy?: string) { ... },
};
```

### 5.4 Webhook sortant

Configuration runtime :
- Variable d'env : `CHAT_LEAD_WEBHOOK_URL` (URL webhook).
- Variable d'env : `CHAT_LEAD_WEBHOOK_SECRET` (secret HMAC).
- Toggle admin : `chat_runtime_setting.key='lead_webhook_enabled'` (bool) — pour kill switch sans redeploy.

Implémentation : nouvelle file `apps/web/src/lib/chat/services/lead-webhook.ts` :

```ts
export async function dispatchLeadWebhook(leadId: string): Promise<void> {
  const lead = await leadRepo.getById(leadId);
  if (!lead) return;
  const url = process.env.CHAT_LEAD_WEBHOOK_URL;
  const secret = process.env.CHAT_LEAD_WEBHOOK_SECRET;
  if (!url || !secret) {
    await leadRepo.markWebhookSent(leadId); // disabled
    return;
  }
  const body = JSON.stringify({
    event: 'chat_lead.created',
    lead: {
      id: lead.id,
      sessionId: lead.sessionId,
      firstName: lead.firstName,
      phoneE164: lead.phoneE164,
      language: lead.language,
      triggerReason: lead.triggerReason,
      page: lead.page,
      utm: lead.utm,
      createdAt: lead.createdAt.toISOString(),
      snapshot: lead.snapshotMessages,
    },
  });
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  // retry × 3 avec backoff expo (1s, 4s, 16s)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-femiglow-signature': signature,
          'x-femiglow-event': 'chat_lead.created',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        await leadRepo.markWebhookSent(leadId);
        return;
      }
      throw new Error(`webhook ${res.status}`);
    } catch (err) {
      await leadRepo.markWebhookFailed(leadId, (err as Error).message, attempt);
      if (attempt < 3) await sleep([1000, 4000, 16000][attempt - 1]);
    }
  }
}
```

Appel : depuis la route `POST /api/chat/lead/contact`, on `void dispatchLeadWebhook(leadId)` (fire-and-forget) après réponse 200. Dans Vercel, on prévoit aussi un cron `/api/cron/chat-lead-webhook-retry` qui repêche les `webhookStatus='pending'` ou `failed` < 24h.

### 5.5 Trigger côté orchestrator

Nouveau service `apps/web/src/lib/chat/services/lead-decision.ts` :

```ts
interface DecisionInput {
  session: ChatSessionRow;
  history: ChatMessageRow[];
  lastIntent: ChatIntent;
  ragHits: number;
}

export function shouldOfferLeadForm(input: DecisionInput): {
  offer: boolean;
  reason: ChatLeadRow['triggerReason'] | null;
} {
  const { session, history, lastIntent, ragHits } = input;
  // déjà offert ? un seul par défaut
  if (session.utm?.leadOfferedCount && Number(session.utm.leadOfferedCount) >= 1) {
    return { offer: false, reason: null };
  }
  if (lastIntent === 'contact_request') return { offer: true, reason: 'explicit-request' };
  if (lastIntent === 'b2b')              return { offer: true, reason: 'b2b' };
  if (lastIntent === 'frustration')      return { offer: true, reason: 'frustration' };

  // hors horaires + intent support/order-status
  if (isOutOfHoursMA() && (lastIntent === 'support' || lastIntent === 'order-status')) {
    return { offer: true, reason: 'after-hours' };
  }

  // objection répétée 2× en < 6 messages
  const userMsgs = history.filter((m) => m.role === 'user').slice(-6);
  const objectionCount = userMsgs.filter((m) => /^objection_/.test((m as never as { intent?: string }).intent ?? '')).length;
  if (objectionCount >= 2) return { offer: true, reason: 'objection-repeat' };

  // RAG vide deux fois de suite + plus de 3 messages
  // (à brancher avec un compteur sur session ou via les events)
  if (ragHits === 0 && hasPriorEmptyRag(session)) {
    return { offer: true, reason: 'out-of-knowledge' };
  }

  // long sans avancement
  if (userMsgs.length >= 6 && !history.some((m) => m.role === 'assistant' && (m as never as { ragHits?: unknown[] }).ragHits)) {
    return { offer: true, reason: 'long-no-progress' };
  }

  return { offer: false, reason: null };
}
```

Côté `orchestrator.ts`, après `eventRepo.append('message_sent_agent')`, on évalue la décision :

```ts
const dec = shouldOfferLeadForm({ session, history: recent, lastIntent: intentTag, ragHits: ragHits.length });
if (dec.offer) {
  yield {
    event: 'lead-form-offer',
    data: {
      messageId: assistantMessage.id,
      reason: dec.reason,
      copy: pickLeadFormCopy(language, dec.reason),
    },
  };
  await eventRepo.append(session.id, 'chat_lead_form_offered', {
    messageId: assistantMessage.id,
    reason: dec.reason,
  });
  await sessionRepo.update(session.id, {
    utm: { ...(session.utm ?? {}), leadOfferedCount: '1' },
  });
}
```

L'évent SSE `lead-form-offer` est consommé par le `sse-reader` côté widget → ajoute la bulle `LeadFormBubble` à la fin de la `MessageList`.

---

## 6. Tracking — datalayer & catalogue

### 6.1 Nouveaux events à ajouter à `event-catalog.ts`

| Event | Catégorie | Scope | Conversion | Description |
|---|---|---|---|---|
| `chat_widget_open` | engagement | web | non | Ouverture du panneau chat |
| `chat_widget_close` | engagement | web | non | Fermeture du panneau chat |
| `chat_message_sent` | engagement | web | non | Visiteur envoie un message |
| `chat_message_received` | engagement | web | non | Le widget reçoit le 1ᵉʳ token de la réponse (TTFB) |
| `chat_message_complete` | engagement | web | non | La réponse SSE se termine (`event=end`) |
| `chat_lead_form_offered` | engagement | both | non | Le LLM/règle propose le formulaire (server) |
| `chat_lead_form_view` | engagement | web | non | La bulle formulaire devient visible (IO 50 %) |
| `chat_lead_form_focus` | engagement | web | non | Premier focus sur un champ |
| `chat_lead_form_dismiss` | engagement | web | non | Le visiteur clique « Ignorer » |
| `chat_lead_form_submit` | engagement | both | **non** (cf. ligne suivante) | Soumission acceptée (avant validation) |
| `generate_lead` (existant) | lead | both | **oui** | Submit validé serveur — c'est la **conversion** datalayer |
| `chat_lead_webhook_sent` | admin | server | non | Webhook envoyé avec succès |
| `chat_lead_webhook_failed` | admin | server | non | Webhook échoué après 3 retry |

### 6.2 Schéma des params clés

```ts
// chat_widget_open
{ page: string, language: 'fr'|'ar'|'ar-MA', referrer?: string }

// chat_message_sent
{ session_id: string, message_id: string, intent?: string, language: string, length: number }

// chat_message_received
{ session_id: string, message_id: string, ttfb_ms: number }

// chat_lead_form_offered
{ session_id: string, trigger_reason: string, language: string }

// chat_lead_form_view
{ session_id: string, trigger_reason: string, language: string }

// chat_lead_form_submit
{ session_id: string, trigger_reason: string, fields_filled: ['firstName','phone','consent'], duration_ms: number }

// generate_lead   (existant — on enrichit le payload émis par le widget chat)
{
  method: 'chat',                         // ← spécifique chat
  lead_id: string,                        // chat_lead.id
  session_id: string,                     // chat_session.id
  trigger_reason: string,
  value: 0,                               // pas de prix
  currency: 'MAD',
  language: 'fr'|'ar'|'ar-MA'
}
```

### 6.3 Mapping providers (datalayer → pixels)

L'event `generate_lead` est déjà mappé pour `meta`, `tiktok`, `google_ga4`, `google_ads`, `snap`, `pinterest` (`event-catalog.ts:352`). Aucune action côté providers.

Pour les events `chat_*` ajoutés, on les laisse en `defaultProviders: ['google_ga4']` (uniquement GA4) — c'est suffisant pour le funnel interne.

### 6.4 Hooks de tracking côté widget

Le `useTracking()` (`@/lib/tracking/use-tracking`) expose `emit(name, params)`. À câbler dans :

| Composant | Event | Quand |
|---|---|---|
| `ChatLauncher.tsx` | `chat_widget_open` | onClick ouverture |
| `ChatPanel.tsx` | `chat_widget_close` | onClick close + Esc |
| `useChatSend` | `chat_message_sent` | juste avant POST `/api/chat/message` |
| `sse-reader.ts` | `chat_message_received` | sur 1ᵉʳ chunk reçu |
| `sse-reader.ts` | `chat_message_complete` | sur `event=end` |
| `LeadFormBubble.tsx` | `chat_lead_form_view` | sur mount + IO ≥ 50 % |
| `LeadFormBubble.tsx` | `chat_lead_form_focus` | premier `onFocus` |
| `LeadFormBubble.tsx` | `chat_lead_form_dismiss` | onClick « Ignorer » |
| `LeadFormBubble.tsx` | `chat_lead_form_submit` | submit accepté local |
| `LeadFormBubble.tsx` | `generate_lead` | response 200 du serveur |

### 6.5 Cohérence avec `chat_conversation_event` (DB)

Les events DB existent **en parallèle** du datalayer côté client (cf. `02-data.md`). Les nouveaux events DB à ajouter à l'enum `chat_conversation_event.type` :

```sql
ALTER TYPE chat_conversation_event_type ADD VALUE IF NOT EXISTS 'chat_lead_form_offered';
ALTER TYPE chat_conversation_event_type ADD VALUE IF NOT EXISTS 'chat_lead_form_view';
ALTER TYPE chat_conversation_event_type ADD VALUE IF NOT EXISTS 'chat_lead_form_submit';
ALTER TYPE chat_conversation_event_type ADD VALUE IF NOT EXISTS 'chat_lead_form_dismiss';
ALTER TYPE chat_conversation_event_type ADD VALUE IF NOT EXISTS 'chat_widget_open';
ALTER TYPE chat_conversation_event_type ADD VALUE IF NOT EXISTS 'chat_widget_close';
```

(En Drizzle, `text` enum côté schema → on étend le `enum` array de `chatConversationEvent.type`. Migration auto-générée.)

---

## 7. Sécurité & RGPD

| Vecteur | Mesure |
|---|---|
| Spam soumissions | Rate-limit `session=3/15min`, `ip=10/15min` (existe déjà — étendre `rate-limit.ts`) |
| Bots | Champ honeypot `website` invisible (cf. §5.1) ; pas de captcha visible (frottement +) ; si abus avéré, ajout reCAPTCHA v3 invisible |
| Validation phone | `libphonenumber-js` côté serveur — refuse 422 si invalide |
| Consent obligatoire | `consent: z.literal(true)` — pas de `false` accepté |
| PII en logs | `maskE164()` — jamais le numéro complet en logs (sauf table DB chiffrée à l'OS) |
| Stockage | Postgres standard ; en option Phase 2, chiffrement applicatif AES-GCM du `phoneE164` (clé `CHAT_LEAD_KMS_KEY`) |
| Webhook signature | HMAC-SHA-256 sur le body, header `x-femiglow-signature` |
| HTTPS only | Vercel impose ; le webhook URL doit être `https://` (validation au config admin) |
| Effacement (RGPD) | Cron purge `chat_lead` après `outcome='discarded'` + 30 j ; bouton « Oublier ce lead » côté admin |
| Audit | Toute mutation côté admin loggée dans `audit_log` (système existant) |
| CSP | `connect-src` du widget : ajouter le domaine du webhook si appel direct côté client (pas le cas ici — le webhook part du serveur) |

---

## 8. Frontend — composants & store

### 8.1 Nouveau composant `LeadFormBubble.tsx`

```
apps/web/src/components/chat/LeadFormBubble.tsx
apps/web/src/components/chat/LeadFormBubble.test.tsx
apps/web/src/components/chat/lead-form-copy.ts        // copy par langue × reason
apps/web/src/components/chat/lead-form-validators.ts  // helpers form
```

Structure interne :

```tsx
'use client';

interface LeadFormBubbleProps {
  triggerReason: ChatLeadTriggerReason;
  triggeringMessageId: string | null;
  copy: { intro: string; cta: string; dismiss: string; success: string };
  language: 'fr' | 'ar' | 'ar-MA';
}

export function LeadFormBubble({ ... }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormClientSchema),
    mode: 'onBlur',
  });
  const { emit } = useTracking();
  const sessionId = useChatStore((s) => s.sessionId);
  const dismiss = useChatStore((s) => s.dismissLeadForm);
  const ackSubmit = useChatStore((s) => s.ackLeadFormSubmit);

  // a11y: IO 50% → emit chat_lead_form_view une seule fois
  useEffect(() => { ... }, []);

  async function onSubmit(values: LeadFormValues) {
    emit('chat_lead_form_submit', { session_id: sessionId, trigger_reason: triggerReason, ... });
    const res = await fetch('/api/chat/lead/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...values, sessionId, triggeringMessageId, triggerReason, consentVersion: 'v1-2026-05', language }),
    });
    if (!res.ok) {
      // gérer 422 / 429 / 5xx
      return;
    }
    const { leadId } = await res.json();
    emit('generate_lead', { method: 'chat', lead_id: leadId, session_id: sessionId, trigger_reason: triggerReason, value: 0, currency: 'MAD', language });
    ackSubmit({ leadId });
  }

  // ... rendu
}
```

### 8.2 Store Zustand — extension

```ts
// chat-store.ts
type LeadOffer = {
  triggeringMessageId: string | null;
  reason: ChatLeadTriggerReason;
  copy: { intro: string; cta: string; dismiss: string; success: string };
  language: 'fr' | 'ar' | 'ar-MA';
  status: 'idle' | 'submitted' | 'dismissed';
  leadId?: string;
  shownAt: number;
} | null;

type State = {
  // ...
  leadOffer: LeadOffer;
  setLeadOffer: (offer: NonNullable<LeadOffer>) => void;
  dismissLeadForm: () => void;
  ackLeadFormSubmit: (p: { leadId: string }) => void;
};
```

### 8.3 Branchement SSE → store

`sse-reader.ts` traite déjà `event=start|chunk|end|error`. On ajoute le case `lead-form-offer` :

```ts
case 'lead-form-offer': {
  const data = JSON.parse(event.data) as { messageId: string; reason: string; copy: ... };
  store.setLeadOffer({
    triggeringMessageId: data.messageId,
    reason: data.reason,
    copy: data.copy,
    language: store.getState().language,
    status: 'idle',
    shownAt: Date.now(),
  });
  break;
}
```

### 8.4 Insertion dans `MessageList.tsx`

```tsx
{leadOffer && leadOffer.status !== 'dismissed' && (
  <li className="mt-3">
    <LeadFormBubble
      triggerReason={leadOffer.reason}
      triggeringMessageId={leadOffer.triggeringMessageId}
      copy={leadOffer.copy}
      language={leadOffer.language}
    />
  </li>
)}
```

Le formulaire reste **après** la liste des messages → visible naturellement quand on scroll en bas.

### 8.5 Tracking instrumentation

Ajouts dans :
- `ChatLauncher.tsx` (open)
- `ChatHeader.tsx` (close)
- `use-chat-send.ts` (sent)
- `sse-reader.ts` (received, complete)

---

## 9. Console admin

### 9.1 Nouvelle page `/admin/chat/leads`

| Section | Contenu |
|---|---|
| **Filtres** | Période, langue, `trigger_reason`, `outcome`, `webhookStatus` |
| **Liste** | colonnes : date, prénom, phone (masqué + clic révèle), trigger, langue, page, outcome, webhook |
| **Drawer détail** | Tout le `chat_lead` row + lien vers la conversation `/admin/chat/sessions/[sessionId]` + JSON `snapshotMessages` |
| **Actions** | « Marquer joint », « Marquer converti » (avec orderId), « Marquer abandonné », « Oublier (RGPD) », « Renvoyer webhook » |

À l'image des pages existantes (`/admin/chat/sessions`, `/admin/chat/instructions`).

### 9.2 Configuration webhook

Sur `/admin/chat/settings` (existant ou nouveau panneau) : champ « URL webhook leads » + champ « Secret webhook ». Stockage dans `chat_runtime_setting` ou dans une nouvelle table `chat_integration_webhook` (préférable si on en aura plusieurs). Test « Envoyer un payload de démo ».

### 9.3 KPI dashboard

À ajouter sur `/admin/chat` (carte « Funnel leads ») :

```
Sessions ……………………………… 1 248
Offres formulaire ……………… 312    (25 %)
Vues formulaire ……………………  287    (92 %)
Submits ………………………………………   78    (27 %)
Convertis (orderId) ………   23    (29 %)
```

---

## 10. Plan d'action — tickets atomiques

Préfixe : `CHA-2xx`. À ranger dans **Phase 9 — Capture leads & stratégie éditoriale** dans `15-plan-action.md`.

### Phase 9.A — Data & backend (S1)

| ID | Sujet | Estim |
|---|---|---|
| CHA-200 | Schéma Drizzle `chat_lead` (§3.1) + migration | 0,5 j |
| CHA-201 | Repo `leadRepo` (§5.3) + tests | 0,5 j |
| CHA-202 | Helper `lib/phone.ts` (libphonenumber-js) + tests | 0,25 j |
| CHA-203 | Étendre enum `chat_conversation_event.type` (§6.5) + migration | 0,25 j |
| CHA-204 | Contrat Zod `chatLeadContactInput` (`contracts.ts`) | 0,25 j |
| CHA-205 | Route POST `/api/chat/lead/contact` (§5.1) + tests MSW | 0,75 j |
| CHA-206 | Service `lead-webhook.ts` (§5.4) + tests + cron retry | 0,75 j |
| CHA-207 | Service `lead-decision.ts` (§5.5) + tests | 0,5 j |
| CHA-208 | Branchement orchestrator → `lead-form-offer` SSE | 0,5 j |

### Phase 9.B — Frontend (S2)

| ID | Sujet | Estim |
|---|---|---|
| CHA-210 | Composant `LeadFormBubble.tsx` (UI + a11y + RTL) | 1 j |
| CHA-211 | `lead-form-copy.ts` (FR/AR/AR-MA × 7 reasons) | 0,25 j |
| CHA-212 | Store Zustand `leadOffer` (§8.2) | 0,25 j |
| CHA-213 | SSE handler `lead-form-offer` (§8.3) | 0,25 j |
| CHA-214 | Intégration `MessageList` (§8.4) | 0,25 j |
| CHA-215 | Stories Storybook 9 états (§4.11) | 0,75 j |
| CHA-216 | Tests jest-axe (a11y) | 0,5 j |

### Phase 9.C — Tracking (S2)

| ID | Sujet | Estim |
|---|---|---|
| CHA-220 | Ajouter 13 events au catalogue (§6.1) + seed `tracking_event_definitions` | 0,5 j |
| CHA-221 | Instrumenter widget : open/close/sent/received/complete (§6.4) | 0,5 j |
| CHA-222 | Instrumenter `LeadFormBubble` : view/focus/dismiss/submit/generate_lead | 0,25 j |
| CHA-223 | Mapper `generate_lead` côté Meta CAPI (server-side) | 0,5 j |
| CHA-224 | Tests datalayer (e2e) — 3 scénarios | 0,5 j |

### Phase 9.D — Admin & analyse (S3)

| ID | Sujet | Estim |
|---|---|---|
| CHA-230 | Page `/admin/chat/leads` (liste + filtres) | 1 j |
| CHA-231 | Drawer détail lead + actions outcome | 0,5 j |
| CHA-232 | Page settings webhook | 0,5 j |
| CHA-233 | Carte « Funnel leads » sur `/admin/chat` | 0,5 j |
| CHA-234 | Vue matérialisée `chat_lead_funnel` (§3.3) | 0,25 j |
| CHA-235 | Action « Renvoyer webhook » + audit log | 0,25 j |

### Phase 9.E — Sécurité & qualité (S3)

| ID | Sujet | Estim |
|---|---|---|
| CHA-240 | Rate-limit endpoint lead (§7) | 0,25 j |
| CHA-241 | Honeypot frontend + check serveur | 0,25 j |
| CHA-242 | Cron purge RGPD (`outcome='discarded'` > 30 j) | 0,25 j |
| CHA-243 | Bouton admin « Oublier ce lead » | 0,25 j |
| CHA-244 | Tests Playwright e2e — happy path soumission lead | 0,5 j |
| CHA-245 | Tests Playwright e2e — dismissal | 0,25 j |
| CHA-246 | Tests Playwright e2e — RTL arabe | 0,25 j |
| CHA-247 | Audit a11y final (jest-axe + axe-playwright) | 0,5 j |

**Total Phase 9 : ~14 j (≈ 3 semaines à 1 fullstack + 0,5 frontend).**

---

## 11. Tests & DoD

### 11.1 Tests unitaires

| Module | Couverture |
|---|---|
| `lib/phone.ts` | parsing MA, FR, ES, BE ; rejet invalides ; mask |
| `lead-decision.ts` | 7 triggers + cas frontière (déjà offert, hors horaires, etc.) |
| `lead-webhook.ts` | retry, signature, succès, échec |
| Zod `chatLeadContactInput` | min/max, regex, consent literal |

### 11.2 Tests intégration (Vitest + MSW)

- POST `/api/chat/lead/contact` happy path → 200 + DB insert + event + webhook fire
- 422 si phone invalide
- 429 si rate-limit dépassé
- 400 si consent absent
- Honeypot rempli → 200 silencieux, **pas** de DB insert
- Webhook 500 → 3 retries → `webhookStatus='failed'` + audit
- Webhook 200 au 2ᵉ try → `webhookStatus='sent'`, `webhookAttempts=2`

### 11.3 Tests e2e (Playwright)

| ID | Scénario |
|---|---|
| LEAD-E2E-1 | « Je veux parler à quelqu'un » → bulle apparaît → submit → success → datalayer `generate_lead` émis |
| LEAD-E2E-2 | Visiteur clique « Ignorer » → la bulle disparaît, conversation continue |
| LEAD-E2E-3 | RTL : visiteur en arabe → tout le formulaire est RTL, valide |
| LEAD-E2E-4 | Téléphone invalide → message inline, focus sur champ, pas de submit |
| LEAD-E2E-5 | Hors horaires (mock heure) + intent support → trigger `after-hours` |
| LEAD-E2E-6 | A11y : keyboard-only flow (Tab, Tab, Tab, Space, Enter) |

### 11.4 DoD global Phase 9

- [ ] 1 lead soumis en preview → ligne en DB, event KPI, datalayer émis, webhook reçu et signé
- [ ] Lighthouse mobile sur la page `/` (avec widget ouvert + formulaire) ≥ 90 perf, 100 a11y
- [ ] Pas de régression sur les 18 tests existants (`pnpm vitest run src/lib/chat`)
- [ ] Storybook à jour (9 états)
- [ ] Doc à jour : ce fichier + références dans `15-plan-action.md`, `02-data.md`, `07-events-catalog.md`, `17-implementation-status.md`

---

## 12. Variables d'environnement à ajouter

| Var | Usage | Default | Where |
|---|---|---|---|
| `CHAT_LEAD_WEBHOOK_URL` | URL POST du webhook sortant | (vide → désactivé) | `.env.local`, Vercel |
| `CHAT_LEAD_WEBHOOK_SECRET` | Secret HMAC-SHA-256 | requis si URL définie | secret manager |
| `CHAT_LEAD_KMS_KEY` (P2) | Chiffrement appli `phoneE164` | (vide → off) | secret manager |

À documenter dans `apps/web/src/lib/env.ts` (Zod) + `README.md`.

---

## 13. Runbook opérationnel

### 13.1 Activer le webhook leads

1. `/admin/chat/settings` → **Webhook leads** → coller URL + secret.
2. Cliquer **Tester** → un payload de démo est envoyé. Vérifier réception + signature.
3. Activer le toggle `lead_webhook_enabled` dans `chat_runtime_setting`.
4. Surveiller `/admin/chat/leads` la 1ᵉʳᵉ heure → status webhook = `sent`.

### 13.2 Renvoyer un webhook échoué

1. `/admin/chat/leads` → filtrer `webhookStatus=failed`.
2. Ouvrir le drawer → **Renvoyer**.
3. Si toujours 500 côté CRM, alerter le destinataire.

### 13.3 Hot-fix : désactiver l'offre formulaire

Cas : taux de soumission trop bas / réclamations.

```sql
UPDATE chat_runtime_setting SET value_bool = false WHERE key = 'lead_form_enabled';
```

Le `shouldOfferLeadForm` lit ce flag → renvoie `{offer: false}` → plus aucune offre. Aucun deploy.

### 13.4 Purge RGPD manuelle d'un lead

`/admin/chat/leads/<id>` → **Oublier (RGPD)** → confirmation → soft-delete + purge cron < 24 h.

Audit log automatique : `chat.lead.forgotten` + ID admin.

### 13.5 Surveiller la qualité du funnel

Cible quotidienne :

| Métrique | Cible | Alerte si |
|---|---|---|
| Taux offre → vue | ≥ 90 % | < 80 % (3 j) |
| Taux vue → submit | ≥ 25 % | < 15 % (3 j) |
| Taux submit → converti | ≥ 25 % | < 10 % (7 j) |
| Webhook success rate | ≥ 99 % | < 95 % (1 h) |
| Phones invalides serveur | ≤ 5 % | > 15 % (1 j) |

Pages `/admin/chat` + Slack (alerte manuelle, pas auto).

---

## 14. Hors-scope (V2 — backlog)

- Vérification téléphone par OTP WhatsApp (Twilio Verify) — augmente la qualité, ajoute une friction.
- Reprise de conversation par lien WhatsApp (« Reprenons où on en était… »).
- Routage automatique du lead vers l'agent disponible (si > 1 agent).
- Scoring lead (intention d'achat) à partir du `snapshotMessages` (LLM offline).
- Connexion CRM (HubSpot, Pipedrive, Make/Zapier) via le webhook.

---

## 15. Annexe — payload exemple webhook

```http
POST https://crm.femiglow.ma/webhooks/chat-leads HTTP/1.1
content-type: application/json
x-femiglow-signature: 9b3a...d72e
x-femiglow-event: chat_lead.created

{
  "event": "chat_lead.created",
  "lead": {
    "id": "cl_a3k9wq2v",
    "sessionId": "cs_pq74h2x1",
    "firstName": "Sara",
    "phoneE164": "+212630035905",
    "language": "fr",
    "triggerReason": "explicit-request",
    "page": "/kit",
    "utm": { "utm_source": "instagram", "utm_campaign": "april-rituel" },
    "createdAt": "2026-05-06T11:24:13.802Z",
    "snapshot": [
      { "role": "user",      "content": "C'est cher pour des ongles", "at": "..." },
      { "role": "assistant", "content": "Je comprends. Le flacon dure...", "at": "..." },
      { "role": "user",      "content": "Je veux parler à quelqu'un", "at": "..." }
    ]
  }
}
```

Signature : `HMAC-SHA-256(secret, body)` → hex 64 chars dans `x-femiglow-signature`.
