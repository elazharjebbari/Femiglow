import { z } from 'zod';
import type { TrackingEventCategory } from '@/lib/db/types';

const itemSchema = z
  .object({
    item_id: z.string().min(1),
    item_name: z.string().min(1),
    item_brand: z.string().optional(),
    item_category: z.string().optional(),
    item_variant: z.string().optional(),
    price: z.number().nonnegative().optional(),
    quantity: z.number().int().positive().optional(),
    currency: z.string().length(3).optional(),
  })
  .strict();

const ecommerceParams = z
  .object({
    currency: z.string().length(3).optional(),
    value: z.number().nonnegative().optional(),
    items: z.array(itemSchema).optional(),
  })
  .passthrough();

const purchaseParams = ecommerceParams.extend({
  transaction_id: z.string().min(1),
  tax: z.number().nonnegative().optional(),
  shipping: z.number().nonnegative().optional(),
});

const generateLeadParams = z
  .object({
    currency: z.string().length(3).optional(),
    value: z.number().nonnegative().optional(),
    lead_id: z.string().optional(),
    method: z.string().optional(),
  })
  .strict();

export const eventSchemas: Record<string, z.ZodTypeAny> = {
  page_view: z
    .object({
      page_path: z.string().min(1),
      page_title: z.string().optional(),
      page_referrer: z.string().optional(),
    })
    .strict(),
  scroll_depth: z
    .object({ percent_scrolled: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(90)]) })
    .strict(),
  click: z
    .object({
      link_text: z.string().optional(),
      link_url: z.string().optional(),
      outbound: z.boolean().optional(),
    })
    .strict(),
  select_content: z
    .object({ content_type: z.string().min(1), content_id: z.string().optional() })
    .strict(),
  share: z.object({ method: z.string().optional(), content_id: z.string().optional() }).strict(),
  search: z.object({ search_term: z.string().min(1) }).strict(),
  video_start: z
    .object({ video_title: z.string().optional(), video_duration: z.number().optional() })
    .strict(),
  video_progress: z
    .object({ video_percent: z.number(), video_title: z.string().optional() })
    .strict(),
  video_complete: z.object({ video_title: z.string().optional() }).strict(),
  file_download: z
    .object({ file_name: z.string().optional(), file_extension: z.string().optional() })
    .strict(),
  form_start: z.object({ form_id: z.string().optional() }).strict(),
  form_submit: z.object({ form_id: z.string().optional() }).strict(),
  view_item_list: ecommerceParams,
  select_item: ecommerceParams,
  view_item: ecommerceParams,
  add_to_cart: ecommerceParams,
  remove_from_cart: ecommerceParams,
  view_cart: ecommerceParams,
  begin_checkout: ecommerceParams,
  add_shipping_info: ecommerceParams,
  add_payment_info: ecommerceParams,
  purchase: purchaseParams,
  refund: ecommerceParams.extend({ transaction_id: z.string() }),
  view_promotion: z
    .object({
      promotion_id: z.string().optional(),
      promotion_name: z.string().optional(),
      creative_slot: z.string().optional(),
      creative_name: z.string().optional(),
    })
    .strict(),
  select_promotion: z
    .object({ promotion_id: z.string().optional(), promotion_name: z.string().optional() })
    .strict(),
  generate_lead: generateLeadParams,
  sign_up: z.object({ method: z.string().optional() }).strict(),
  login: z.object({ method: z.string().optional() }).strict(),
  fg_journal_read_75: z.object({ article_id: z.string().optional() }).strict(),
  fg_journal_read_100: z.object({ article_id: z.string().optional() }).strict(),
  fg_section_view: z.object({ section_id: z.string().optional() }).strict(),
  fg_faq_view: z.object({ faq_id: z.string().optional() }).strict(),
  fg_composition_open: z.object({ product_id: z.string().optional() }).strict(),
  fg_pixel_test: z.object({ provider: z.string().optional() }).passthrough(),
  fg_admin_action: z
    .object({ action: z.string().min(1), resource: z.string().optional() })
    .passthrough(),
  fg_consent_change: z
    .object({
      ad_storage: z.string().optional(),
      analytics_storage: z.string().optional(),
      source: z.string().optional(),
    })
    .passthrough(),

  // — Chat assistant — cf. docs/gtm/13-events-chat.md, docs/chat-assistant/02-data.md §2.8
  // Convention : `chat_*` (alignée avec event-catalog.ts existant), pas `fg_chat_*`.
  chat_widget_open: z
    .object({
      session_id: z.string().min(1).max(40),
      page_path: z.string().optional(),
      language: z.enum(['fr', 'ar', 'ar-MA']).optional(),
      trigger: z.enum(['user', 'auto', 'cta']).optional(),
    })
    .strict(),
  chat_widget_close: z
    .object({
      session_id: z.string().min(1).max(40),
      messages_count: z.number().int().nonnegative().optional(),
      duration_ms: z.number().int().nonnegative().optional(),
    })
    .strict(),
  chat_message_sent: z
    .object({
      session_id: z.string().min(1).max(40),
      message_index: z.number().int().nonnegative(),
      intent: z.string().optional(),
      chars: z.number().int().nonnegative().optional(),
    })
    .strict(),
  chat_message_received: z
    .object({
      session_id: z.string().min(1).max(40),
      message_id: z.string().min(1).max(40),
      first_token_ms: z.number().int().nonnegative(),
    })
    .strict(),
  chat_message_complete: z
    .object({
      session_id: z.string().min(1).max(40),
      message_id: z.string().min(1).max(40),
      latency_ms: z.number().int().nonnegative(),
      tokens_out: z.number().int().nonnegative().optional(),
    })
    .strict(),
  chat_lead_form_offered: z
    .object({
      session_id: z.string().min(1).max(40),
      form_variant: z.string().optional(),
      trigger_intent: z.string().optional(),
      // CHA-230 Phase 2 — décision orchestrateur propagée côté client pour QA & analyses.
      message_id: z.string().min(1).max(40).optional(),
      reason: z.string().max(120).optional(),
      copy_key: z.string().max(80).optional(),
    })
    .strict(),
  chat_lead_form_view: z
    .object({
      session_id: z.string().min(1).max(40),
      form_variant: z.string().optional(),
      // CHA-230 Phase 2 — raison d'apparition héritée du orchestrateur.
      reason: z.string().max(120).optional(),
    })
    .strict(),
  chat_lead_form_focus: z
    .object({
      session_id: z.string().min(1).max(40),
      field_name: z.string().min(1).max(60),
    })
    .strict(),
  chat_lead_form_dismiss: z
    .object({
      session_id: z.string().min(1).max(40),
      reason: z.enum(['user_close', 'timeout', 'navigation']).optional(),
    })
    .strict(),
  chat_lead_form_submit: z
    .object({
      session_id: z.string().min(1).max(40),
      lead_id: z.string().min(1).max(40),
      method: z.enum(['email', 'phone', 'whatsapp']).optional(),
      consent_marketing: z.boolean().optional(),
    })
    .strict(),
  chat_lead_webhook_sent: z
    .object({
      session_id: z.string().min(1).max(40),
      lead_id: z.string().min(1).max(40),
      target: z.string().min(1).max(120),
      latency_ms: z.number().int().nonnegative().optional(),
    })
    .strict(),
  chat_lead_webhook_failed: z
    .object({
      session_id: z.string().min(1).max(40),
      lead_id: z.string().min(1).max(40),
      target: z.string().min(1).max(120),
      error_code: z.string().min(1).max(80),
      attempts: z.number().int().nonnegative().optional(),
    })
    .strict(),

  // — Chat assistant complément (GTM-CHAT-001..003) — événements
  // déclaratifs UX qui n'étaient pas encore au catalogue.
  chat_suggestion_clicked: z
    .object({
      session_id: z.string().min(1).max(40),
      suggestion_label: z.string().max(120),
      suggestion_index: z.number().int().min(0).max(2),
    })
    .strict(),
  chat_feedback: z
    .object({
      session_id: z.string().min(1).max(40),
      message_id: z.string().min(1).max(40),
      value: z.union([z.literal(1), z.literal(-1)]),
      has_note: z.boolean().optional(),
    })
    .strict(),
  chat_language_switch: z
    .object({
      session_id: z.string().min(1).max(40),
      from_language: z.enum(['fr', 'ar', 'ar-MA']),
      to_language: z.enum(['fr', 'ar', 'ar-MA']),
      trigger: z.enum(['auto_detect', 'user_request']),
    })
    .strict(),
  chat_error: z
    .object({
      session_id: z.string().min(1).max(40),
      error_code: z.enum([
        'rate_limited',
        'moderation_blocked_input',
        'moderation_blocked_output',
        'provider_unavailable',
        'quota_exceeded',
        'timeout',
        'internal',
      ]),
      message_id: z.string().optional(),
    })
    .strict(),
  chat_rate_limit_hit: z
    .object({
      session_id: z.string().min(1).max(40),
      scope: z.enum(['ip', 'session', 'visitor']),
      retry_after_seconds: z.number().int().nonnegative(),
    })
    .strict(),
  // CHA-231 (gap 1) — Tracking d'une offre lead-form récupérée via le pull
  // /api/chat/lead-status (réconciliation post-SSE quand le stream est
  // tombé sans avoir livré l'event). Permet d'auditer l'efficacité du
  // filet anti-perte côté quality dashboard.
  chat_lead_form_recovered: z
    .object({
      session_id: z.string().min(1).max(40),
      message_id: z.string().min(1).max(40),
      reason: z.string().min(1).max(40),
    })
    .strict(),
  // CHA-231 (gap 4) — Tracking d'un event SSE invalide (Zod safeParse KO).
  // Permet de surveiller la stabilité du contrat SSE en prod.
  chat_sse_invalid_event: z
    .object({
      session_id: z.string().min(1).max(40),
      raw_event: z.string().max(40).optional(),
      issues: z.array(z.string()).max(20).optional(),
    })
    .strict(),
  chat_conversion_attributed: z
    .object({
      session_id: z.string().min(1).max(40),
      order_id: z.string().min(1),
      attribution_window_days: z.number().int().min(1).max(30),
      messages_in_session: z.number().int().nonnegative(),
      intent_dominant: z.string().optional(),
    })
    .strict(),
};

export type KnownEventName = keyof typeof eventSchemas;

export function getEventSchema(name: string): z.ZodTypeAny | null {
  return eventSchemas[name] ?? null;
}

const eventCategoryByName: Record<string, TrackingEventCategory> = {
  page_view: 'page',
  scroll_depth: 'engagement',
  click: 'engagement',
  select_content: 'engagement',
  share: 'engagement',
  search: 'engagement',
  video_start: 'engagement',
  video_progress: 'engagement',
  video_complete: 'engagement',
  file_download: 'engagement',
  form_start: 'engagement',
  form_submit: 'engagement',
  view_item_list: 'ecommerce',
  select_item: 'ecommerce',
  view_item: 'ecommerce',
  add_to_cart: 'ecommerce',
  remove_from_cart: 'ecommerce',
  view_cart: 'ecommerce',
  begin_checkout: 'ecommerce',
  add_shipping_info: 'ecommerce',
  add_payment_info: 'ecommerce',
  purchase: 'ecommerce',
  refund: 'ecommerce',
  view_promotion: 'ecommerce',
  select_promotion: 'ecommerce',
  generate_lead: 'lead',
  sign_up: 'lead',
  login: 'lead',
  fg_journal_read_75: 'custom',
  fg_journal_read_100: 'custom',
  fg_section_view: 'custom',
  fg_faq_view: 'custom',
  fg_composition_open: 'custom',
  fg_pixel_test: 'admin',
  fg_admin_action: 'admin',
  fg_consent_change: 'admin',
  chat_widget_open: 'engagement',
  chat_widget_close: 'engagement',
  chat_message_sent: 'engagement',
  chat_message_received: 'engagement',
  chat_message_complete: 'engagement',
  chat_lead_form_offered: 'lead',
  chat_lead_form_view: 'lead',
  chat_lead_form_focus: 'lead',
  chat_lead_form_dismiss: 'lead',
  chat_lead_form_submit: 'lead',
  chat_lead_form_recovered: 'lead', // CHA-231 gap 1
  chat_lead_webhook_sent: 'lead',
  chat_lead_webhook_failed: 'lead',
  chat_sse_invalid_event: 'engagement', // CHA-231 gap 4
  chat_suggestion_clicked: 'engagement',
  chat_feedback: 'engagement',
  chat_language_switch: 'engagement',
  chat_error: 'engagement',
  chat_rate_limit_hit: 'engagement',
  chat_conversion_attributed: 'custom',
};

export function getEventCategory(name: string): TrackingEventCategory {
  return eventCategoryByName[name] ?? 'custom';
}
