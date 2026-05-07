/**
 * Live preview — protocole postMessage entre la page admin (parent) et
 * la route preview RSC (iframe).
 *
 * Cf. docs/components-cms/frontend/04-live-preview.md (F4).
 *
 * Sécurité :
 *   - On vérifie systématiquement `event.origin === window.location.origin`
 *     (preview servie en same-origin).
 *   - On vérifie que `componentKey` correspond au composant édité ;
 *     un message d'un autre onglet/composant est ignoré.
 *
 * On ne propage **jamais** les valeurs des champs dans le message :
 *   le iframe relit l'état frais via `router.refresh()` (pas de fuite
 *   accidentelle dans postMessage).
 */
import { z } from 'zod';

export type PreviewWidth = 'mobile' | 'tablet' | 'desktop';

export type PreviewMessage =
  /** L'iframe annonce qu'il a hydraté et est prêt à recevoir des messages. */
  | { type: 'PREVIEW_READY'; componentKey: string }
  /** Parent → iframe : un ou plusieurs champs ont changé. Debounced 200 ms. */
  | { type: 'FIELDS_CHANGED'; componentKey: string }
  /**
   * Parent → iframe : focus sur un champ → scroll dans la preview vers
   * la zone DOM correspondante.
   */
  | { type: 'SCROLL_TO_FIELD'; componentKey: string; fieldKey: string }
  /**
   * Iframe → parent : l'admin a cliqué sur un élément annoté
   * `data-field-key`, on propose de focaliser ce champ côté form.
   */
  | { type: 'FIELD_CLICKED'; componentKey: string; fieldKey: string };

const previewMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PREVIEW_READY'), componentKey: z.string().min(1) }),
  z.object({ type: z.literal('FIELDS_CHANGED'), componentKey: z.string().min(1) }),
  z.object({
    type: z.literal('SCROLL_TO_FIELD'),
    componentKey: z.string().min(1),
    fieldKey: z.string().min(1),
  }),
  z.object({
    type: z.literal('FIELD_CLICKED'),
    componentKey: z.string().min(1),
    fieldKey: z.string().min(1),
  }),
]);

/**
 * Parse un message reçu en postMessage. Renvoie `null` si invalide.
 *
 * Utilisation :
 * ```ts
 * function onMessage(e: MessageEvent) {
 *   if (e.origin !== window.location.origin) return;
 *   const msg = parsePreviewMessage(e.data);
 *   if (!msg) return;
 *   if (msg.componentKey !== currentKey) return;
 *   // …
 * }
 * ```
 */
export function parsePreviewMessage(raw: unknown): PreviewMessage | null {
  const result = previewMessageSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Largeurs de preview disponibles. Cf. F4 § "Toggle largeur preview". */
export const PREVIEW_WIDTHS: readonly PreviewWidth[] = ['mobile', 'tablet', 'desktop'];

/** Mapping label affiché pour chaque largeur. */
export const PREVIEW_WIDTH_LABEL: Record<PreviewWidth, string> = {
  mobile: '375',
  tablet: '768',
  desktop: '100%',
};

/** Largeur réelle (px) de l'iframe pour chaque toggle. `null` = 100 %. */
export const PREVIEW_WIDTH_PX: Record<PreviewWidth, number | null> = {
  mobile: 375,
  tablet: 768,
  desktop: null,
};
