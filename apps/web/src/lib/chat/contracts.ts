/**
 * CHA-019 — Contrats Zod publics et admin du chat assistant.
 *
 * Source de vérité pour les frontières HTTP : tout payload entrant
 * et sortant transite par un schéma défini ici. Les types TS
 * exportés (`z.infer<...>`) sont la source des `interface` côté
 * client.
 *
 * cf. docs/chat-assistant/03-backend.md §2
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Énumérations partagées
// ---------------------------------------------------------------------------

export const chatLanguageSchema = z.enum(['fr', 'ar', 'ar-MA']);
export type ChatLanguage = z.infer<typeof chatLanguageSchema>;

export const chatSessionStatusSchema = z.enum(['open', 'idle', 'archived', 'purged']);
export type ChatSessionStatus = z.infer<typeof chatSessionStatusSchema>;

export const chatRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const chatProviderKindSchema = z.enum([
  'openai',
  'gemini',
  'anthropic',
  'mistral',
  'qwen',
  'deepseek',
  'zhipu',
  'ollama',
  'azure-openai',
]);
export type ChatProviderKind = z.infer<typeof chatProviderKindSchema>;

export const chatProviderRoleSchema = z.enum(['chat', 'embedding', 'moderation', 'rerank']);
export type ChatProviderRole = z.infer<typeof chatProviderRoleSchema>;

// ---------------------------------------------------------------------------
// DTO message (lecture client)
// ---------------------------------------------------------------------------

export const chatMessageDto = z.object({
  id: z.string(),
  role: chatRoleSchema,
  content: z.string(),
  language: chatLanguageSchema.nullable().optional(),
  status: z.enum(['pending', 'streaming', 'sent', 'error', 'deleted']),
  createdAt: z.string(),
  sources: z
    .array(
      z.object({
        chunkId: z.string(),
        title: z.string(),
        url: z.string().url().optional(),
        score: z.number().optional(),
      }),
    )
    .optional(),
});
export type ChatMessageDto = z.infer<typeof chatMessageDto>;

// ---------------------------------------------------------------------------
// Snapshot session (réponse `GET /api/chat/session`)
// ---------------------------------------------------------------------------

// CHA-300 — SuggestionPill page-aware (canned pairs V5/V6).
// `key` identifie la paire côté backend pour servir la `scripted_reply_*`
// dans la langue de session via POST /api/chat/canned-pair/{key}.
// `ctaLabel`/`ctaUrl` rendus en bouton secondaire dans la bulle de réponse.
export const chatSuggestionPill = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  ctaLabel: z.string().max(60).nullable().optional(),
  ctaUrl: z.string().max(2048).nullable().optional(),
});
export type ChatSuggestionPill = z.infer<typeof chatSuggestionPill>;

export const chatSessionSnapshot = z.object({
  sessionId: z.string(),
  language: chatLanguageSchema,
  status: chatSessionStatusSchema,
  greeting: z.string(),
  suggestions: z.array(chatSuggestionPill).max(6),
  messages: z.array(chatMessageDto).max(200),
  themeVariantId: z.string(),
  variantOpaqueId: z.string(),
});
export type ChatSessionSnapshot = z.infer<typeof chatSessionSnapshot>;

// ---------------------------------------------------------------------------
// Inputs publics
// ---------------------------------------------------------------------------

export const chatMessageInput = z.object({
  sessionId: z.string(),
  text: z.string().min(1).max(2000),
  lang: chatLanguageSchema.optional(),
  context: z
    .object({
      page: z.string().max(120).optional(),
      currentCart: z
        .array(z.object({ sku: z.string(), qty: z.number() }))
        .optional(),
    })
    .optional(),
});
export type ChatMessageInput = z.infer<typeof chatMessageInput>;

export const chatSessionRefreshInput = z.object({
  sessionId: z.string(),
  page: z.string().max(120).optional(),
  language: chatLanguageSchema.optional(),
  consent: z
    .object({
      essential: z.literal(true),
      analytics: z.boolean(),
      marketing: z.boolean(),
    })
    .optional(),
});
export type ChatSessionRefreshInput = z.infer<typeof chatSessionRefreshInput>;

export const chatFeedbackInput = z.object({
  messageId: z.string(),
  value: z.union([z.literal(1), z.literal(-1)]),
  note: z.string().max(500).optional(),
});
export type ChatFeedbackInput = z.infer<typeof chatFeedbackInput>;

export const chatLeadEmailInput = z.object({
  sessionId: z.string(),
  email: z.string().email(),
  consent: z.boolean(),
});
export type ChatLeadEmailInput = z.infer<typeof chatLeadEmailInput>;

// ---------------------------------------------------------------------------
// CHA-204 — Capture lead in-chat (formulaire prénom + téléphone).
// ---------------------------------------------------------------------------

export const chatLeadTriggerReasonSchema = z.enum([
  'explicit-request',
  'out-of-knowledge',
  'objection-repeat',
  'long-no-progress',
  'frustration',
  'after-hours',
  'b2b',
  // CHA-225 — Nouvelles raisons (intent d'achat / coordonnées posées en clair).
  'purchase-intent',
  'inline-contact',
  'manual',
]);
export type ChatLeadTriggerReason = z.infer<typeof chatLeadTriggerReasonSchema>;

export const chatLeadCountryHintSchema = z.enum(['MA', 'FR', 'BE', 'CH', 'DZ', 'TN']);
export type ChatLeadCountryHint = z.infer<typeof chatLeadCountryHintSchema>;

export const chatLeadContactInput = z.object({
  sessionId: z.string().min(1).max(64),
  triggeringMessageId: z.string().max(64).nullable().optional(),
  triggerReason: chatLeadTriggerReasonSchema,
  firstName: z
    .string()
    .min(2, 'first-name-too-short')
    .max(40, 'first-name-too-long')
    .regex(/^[\p{L}\s'`’-]+$/u, 'first-name-invalid'),
  phoneRaw: z.string().min(6).max(40),
  countryHint: chatLeadCountryHintSchema.default('MA'),
  note: z.string().max(200).optional(),
  consent: z.literal(true),
  consentVersion: z.string().min(4).max(40),
  language: chatLanguageSchema,
  /** Honeypot anti-bot ; doit être vide. */
  honeypot: z.string().max(0).optional(),
});
export type ChatLeadContactInput = z.infer<typeof chatLeadContactInput>;

export const chatLeadContactResponse = z.object({
  ok: z.literal(true),
  leadId: z.string(),
  outcomeMessage: z.string(),
});
export type ChatLeadContactResponse = z.infer<typeof chatLeadContactResponse>;

// CHA-300 — Trigger d'une suggestion pré-écrite. Le serveur valide la `key`
// contre `chat_canned_pair`, sert la `scripted_reply_*` dans la langue de
// session, persiste les 2 messages (user + assistant) et émet l'event analytics.
export const chatCannedPairTriggerInput = z.object({
  sessionId: z.string().min(1).max(64),
  key: z.string().min(1).max(80),
  language: chatLanguageSchema.optional(),
});
export type ChatCannedPairTriggerInput = z.infer<typeof chatCannedPairTriggerInput>;

// CHA-310 — Set des `copyKey` autorisés pour les pills déclencheuses de
// formulaire lead. Mirror de l'enum DB `chat_canned_pair.lead_form_copy_key`.
export const chatCannedPairLeadCopyKeySchema = z.enum([
  'explicit-request',
  'out-of-knowledge',
  'objection',
  'after-hours',
  'b2b',
  'purchase-intent',
  'inline-contact',
  'manual',
]);
export type ChatCannedPairLeadCopyKey = z.infer<typeof chatCannedPairLeadCopyKeySchema>;

export const chatCannedPairTriggerResponse = z.object({
  ok: z.literal(true),
  userMessage: chatMessageDto,
  assistantMessage: chatMessageDto,
  ctaLabel: z.string().nullable().optional(),
  ctaUrl: z.string().nullable().optional(),
  allowFollowupLlm: z.boolean(),
  // CHA-310 — Indique au widget qu'il doit ouvrir le formulaire lead juste
  // sous la bulle assistant. La `copyKey` est mappée vers
  // `lead-form-copy.ts` → variante intro/CTA/success.
  triggersLeadForm: z.boolean(),
  leadFormCopyKey: chatCannedPairLeadCopyKeySchema.nullable().optional(),
});
export type ChatCannedPairTriggerResponse = z.infer<typeof chatCannedPairTriggerResponse>;

export const chatEventInput = z.object({
  sessionId: z.string(),
  type: z.enum([
    'widget_open',
    'widget_close',
    'suggestion_clicked',
    'language_switch',
    'rate_limit_hit',
    'chat_lead_form_view',
    'chat_lead_form_focus',
    'chat_lead_form_dismiss',
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type ChatEventInput = z.infer<typeof chatEventInput>;

// ---------------------------------------------------------------------------
// Streaming SSE events (réponse `POST /api/chat/message`)
// ---------------------------------------------------------------------------

export const chatStreamEvent = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('start'),
    data: z.object({ messageId: z.string(), language: chatLanguageSchema }),
  }),
  z.object({
    event: z.literal('chunk'),
    data: z.object({ messageId: z.string(), delta: z.string() }),
  }),
  z.object({
    event: z.literal('typing'),
    data: z.object({ active: z.boolean(), pauseMs: z.number().optional() }),
  }),
  z.object({
    event: z.literal('source'),
    data: z.object({
      messageId: z.string(),
      sources: z.array(
        z.object({
          chunkId: z.string(),
          title: z.string(),
          url: z.string().url().optional(),
          score: z.number().optional(),
        }),
      ),
    }),
  }),
  z.object({
    event: z.literal('end'),
    data: z.object({ messageId: z.string(), latencyMs: z.number().int() }),
  }),
  z.object({
    event: z.literal('error'),
    data: z.object({
      messageId: z.string().optional(),
      code: z.string(),
      message: z.string().optional(),
    }),
  }),
  // CHA-208 — Offre proactive du formulaire de capture lead. Événement
  // émis APRÈS `end` quand l'orchestrateur estime via `lead-decision`
  // que le visiteur tirerait bénéfice d'un rappel humain.
  z.object({
    event: z.literal('lead-form-offer'),
    data: z.object({
      messageId: z.string(),
      reason: chatLeadTriggerReasonSchema,
      copyKey: z.enum([
        'explicit-request',
        'out-of-knowledge',
        'objection',
        'after-hours',
        'b2b',
        // CHA-225 — Nouvelles copies (intent d'achat / coordonnées en clair).
        'purchase-intent',
        'inline-contact',
        'manual',
      ]),
    }),
  }),
]);
export type ChatStreamEvent = z.infer<typeof chatStreamEvent>;

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminInstructionInput = z.object({
  scope: z.string().default('default'),
  body: z.string().min(50).max(20_000),
  bodyAr: z.string().optional(),
  bodyArMa: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
export type AdminInstructionInput = z.infer<typeof adminInstructionInput>;

/**
 * Patch d'une version existante : tous les champs sont optionnels mais
 * le `body` doit respecter les bornes habituelles s'il est présent.
 * Les chaînes vides AR / AR-MA sont normalisées en `null` côté serveur.
 */
export const adminInstructionPatch = z.object({
  body: z.string().min(50).max(20_000).optional(),
  bodyAr: z.string().max(20_000).optional(),
  bodyArMa: z.string().max(20_000).optional(),
  notes: z.string().max(1000).optional(),
});
export type AdminInstructionPatch = z.infer<typeof adminInstructionPatch>;

export const adminProviderInput = z.object({
  kind: chatProviderKindSchema,
  label: z.string().min(2).max(80),
  role: chatProviderRoleSchema,
  priority: z.number().int().min(1).max(1000),
  enabled: z.boolean(),
  apiKey: z.string().optional(), // jamais retourné en GET
  apiBase: z.string().url().optional(),
  chatModel: z.string().optional(),
  embeddingModel: z.string().optional(),
  parameters: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      topP: z.number().min(0).max(1).optional(),
      maxTokens: z.number().int().min(16).max(8192).optional(),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
    })
    .optional(),
  quotaMonthlyEur: z.number().min(0).optional(),
  egressAllowed: z.boolean().default(false),
});
export type AdminProviderInput = z.infer<typeof adminProviderInput>;

/**
 * CHA-303 — Admin FAQ CRUD : payload form-encoded ou JSON pour créer/
 * mettre à jour une entrée FAQ. `id` présent → patch ; absent → upsert
 * par (`key`, `language`). Le seuil est borné [0.30, 0.95] : sous 0.30
 * on matcherait n'importe quoi, au-dessus 0.95 on bloquerait toute
 * paraphrase.
 */
export const adminFaqEntryInput = z.object({
  id: z.string().optional(),
  key: z.string().min(2).max(120).regex(/^[a-z0-9-:_/.]+$/i, 'key alphanumeric/dash'),
  language: chatLanguageSchema,
  questionCanonical: z.string().min(3).max(500),
  scriptedReply: z.string().min(3).max(4_000),
  intentHint: z.string().max(80).optional(),
  threshold: z.number().min(0.3).max(0.95).default(0.55),
  audience: z.enum(['all', 'b2c', 'b2b']).default('all'),
  enabled: z.boolean().default(true),
});
export type AdminFaqEntryInput = z.infer<typeof adminFaqEntryInput>;

/**
 * CHA-300 — Admin Suggestions/Canned-Pair CRUD : payload form-encoded ou
 * JSON pour créer/mettre à jour une SuggestionPill page-aware. Les 6 champs
 * de localisation (label + scripted_reply x 3 langues) sont obligatoires :
 * une suggestion publiée sans traduction casserait l'UX dans la langue
 * manquante.
 */
export const adminCannedPairInput = z.object({
  id: z.string().optional(),
  key: z.string().min(2).max(80).regex(/^[a-z0-9-:_/.]+$/i, 'key alphanumeric/dash'),
  pagePattern: z.string().min(1).max(120),
  audience: z.enum(['all', 'b2c', 'b2b']).default('all'),
  order: z.number().int().min(0).max(9999).default(100),
  enabled: z.boolean().default(true),
  labelFr: z.string().min(1).max(120),
  labelAr: z.string().min(1).max(120),
  labelArMa: z.string().min(1).max(120),
  scriptedReplyFr: z.string().min(3).max(4_000),
  scriptedReplyAr: z.string().min(3).max(4_000),
  scriptedReplyArMa: z.string().min(3).max(4_000),
  ctaLabel: z.string().max(60).nullable().optional(),
  ctaUrl: z.string().max(2048).nullable().optional(),
  allowFollowupLlm: z.boolean().default(false),
  // CHA-310 — Admin form fields.
  triggersLeadForm: z.boolean().default(false),
  leadFormCopyKey: chatCannedPairLeadCopyKeySchema.nullable().optional(),
  status: z.enum(['draft', 'review', 'published', 'archived']).default('draft'),
});
export type AdminCannedPairInput = z.infer<typeof adminCannedPairInput>;

export const adminSourceInput = z.object({
  kind: z.enum(['url', 'markdown', 'pdf', 'docx', 'faq', 'snippet']),
  label: z.string().min(2).max(160),
  locator: z.string().max(2048).optional(),
  language: chatLanguageSchema.default('fr'),
  audience: z.enum(['public', 'b2b', 'all']).default('all'),
  freshness: z.enum(['evergreen', 'seasonal', 'volatile']).default('evergreen'),
  tags: z.array(z.string().max(40)).max(16).default([]),
  body: z.string().max(200_000).optional(), // markdown / snippet inline
});
export type AdminSourceInput = z.infer<typeof adminSourceInput>;

export const adminConversationsListQuery = z.object({
  q: z.string().max(200).optional(),
  language: chatLanguageSchema.optional(),
  status: chatSessionStatusSchema.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminConversationsListQuery = z.infer<typeof adminConversationsListQuery>;

export const adminKpiQuery = z.object({
  window: z.enum(['today', 'yesterday', '7d', '30d', '90d', 'all']).default('30d'),
});
export type AdminKpiQuery = z.infer<typeof adminKpiQuery>;
