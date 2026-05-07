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
};

export function getEventCategory(name: string): TrackingEventCategory {
  return eventCategoryByName[name] ?? 'custom';
}
