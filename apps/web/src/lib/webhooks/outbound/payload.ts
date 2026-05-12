/**
 * CHA-260 — Schéma + builder du payload outbound (PLAT).
 *
 * Le body POSTé est un objet plat — pas de wrapping `{event, payload}`.
 * Les métadonnées d'événement vont en headers HTTP (cf. dispatcher.ts).
 *
 * Source de vérité du contrat : `docs/webhooks/outbound-webhook-runbook.md` §1.
 */
import { z } from 'zod';

import { tryParsePhone, type NormalizedPhone } from '@/lib/phone';

/**
 * Schéma Zod strict du payload outbound.
 *
 *  - `id`, `full_name`, `phone` sont REQUIS et non-vides après trim.
 *  - Les champs optionnels sont **omis** s'ils sont null/undefined/string vide
 *    (et non envoyés explicitement comme `null`) pour éviter de polluer le
 *    receveur CRM/n8n avec des `null` ambigus.
 *  - `currency` défaut `'MAD'`. `quantity` défaut `1`.
 */
export const outboundPayloadSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9_:.-]+$/, 'id slug-like (alphanum, _ : . -)'),
    ref: z.string().trim().max(100).optional(),
    full_name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(4).max(40),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(120).optional(),
    country: z.string().trim().max(80).optional(),
    email: z.string().trim().email().max(200).optional(),
    total_price: z.number().nonnegative().optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Z]{3}$/)
      .default('MAD'),
    quantity: z.number().int().min(1).default(1),
    product_name: z.string().trim().max(300).optional(),
    product_variant: z.string().trim().max(200).optional(),
    product_sku: z.string().trim().max(100).optional(),
    note: z.string().trim().max(2000).optional(),
    source_channel: z.string().trim().max(60).optional(),
    ip: z.string().trim().max(64).optional(),
  })
  .strict();

export type OutboundPayload = z.infer<typeof outboundPayloadSchema>;

/**
 * Erreur retournée quand l'entrée n'est pas conforme au schéma.
 * Le dispatcher renvoie alors `status='skipped'` et trace l'erreur.
 */
export class OutboundPayloadValidationError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(issues: z.ZodIssue[]) {
    super(`outbound payload validation failed: ${issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ')}`);
    this.name = 'OutboundPayloadValidationError';
    this.issues = issues;
  }
}

/**
 * Format d'affichage du téléphone aligné sur le contrat n8n :
 *   - Pays avec trunk prefix (MA, FR, BE, CH, DZ, TN) → `0` + national,
 *     ex. `parsePhone('+212612345678').national='612345678'` →
 *     `formatPhoneForWebhook(...) = '0612345678'`.
 *   - Sinon, format E.164 brut (`+...`).
 *
 * Le receveur sait reconstruire l'E.164 via le pays inféré ou via la
 * normalisation côté CRM. On garde le format « lu » pour faciliter le
 * matching humain dans n8n (les ops trient sur "065…", pas sur "+212 65…").
 */
export function formatPhoneForWebhook(p: NormalizedPhone): string {
  // Liste des pays avec trunk prefix (cf. lib/phone.ts CountryRule.trunk).
  // TN n'a pas de trunk → on garde l'E.164 brut.
  const TRUNK_COUNTRIES = new Set(['MA', 'FR', 'BE', 'CH', 'DZ']);
  if (TRUNK_COUNTRIES.has(p.country)) {
    return `0${p.national}`;
  }
  return p.e164;
}

/**
 * Valide un payload candidat. Lance `OutboundPayloadValidationError` si invalide.
 * Strip les champs optionnels vides (omet plutôt que d'envoyer `null`).
 */
export function validateOutboundPayload(input: unknown): OutboundPayload {
  // Pré-strip des null/'' optionnels : Zod ne strip pas, il refuse.
  const cleaned: Record<string, unknown> = {};
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'string' && v.trim().length === 0) continue;
      cleaned[k] = v;
    }
  }
  const parsed = outboundPayloadSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new OutboundPayloadValidationError(parsed.error.issues);
  }
  return parsed.data;
}

/**
 * Résultat d'une tentative de normalisation du téléphone.
 *  - `ok=true` → la valeur peut être placée dans `payload.phone`.
 *  - `ok=false` → le webhook DOIT être skippé (cf. règle phone-gate, runbook §1).
 */
export function normalizePhoneForPayload(
  raw: string | null | undefined,
  countryHint: 'MA' | 'FR' | 'BE' | 'CH' | 'DZ' | 'TN' = 'MA',
): { ok: true; value: string; e164: string } | { ok: false; reason: 'empty' | 'invalid' } {
  if (!raw || raw.trim().length === 0) return { ok: false, reason: 'empty' };
  const parsed = tryParsePhone(raw, countryHint);
  if (!parsed) return { ok: false, reason: 'invalid' };
  return { ok: true, value: formatPhoneForWebhook(parsed), e164: parsed.e164 };
}

/**
 * Helper utilitaire : compose un `full_name` à partir de prénom + nom.
 * Si nom absent → renvoie le prénom seul.
 */
export function composeFullName(firstName: string | null | undefined, lastName?: string | null): string {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (!f && !l) return '';
  if (!l) return f;
  if (!f) return l;
  return `${f} ${l}`;
}
