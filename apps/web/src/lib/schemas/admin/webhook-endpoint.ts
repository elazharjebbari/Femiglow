import { z } from 'zod';
import { isPrivateHostname } from '@/lib/webhooks/anti-ssrf';

const eventNameSchema = z.enum([
  'lead.created',
  'lead.status_changed',
  'lead.note_added',
  'order.created',
]);

export const webhookEndpointInputSchema = z.object({
  url: z
    .string()
    .trim()
    .url('URL invalide')
    .refine((u) => u.startsWith('https://'), 'HTTPS requis')
    .refine((u) => {
      try {
        const parsed = new URL(u);
        return !isPrivateHostname(parsed.hostname);
      } catch {
        return false;
      }
    }, 'URL refusée (cible privée)'),
  events: z.array(eventNameSchema).min(1, 'Au moins un événement'),
  description: z.string().trim().max(280).optional().nullable(),
});

export type WebhookEndpointInput = z.infer<typeof webhookEndpointInputSchema>;
