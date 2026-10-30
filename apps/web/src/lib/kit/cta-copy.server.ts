import 'server-only';

/**
 * Kit CRO v2 §4 — lecture serveur des libellés de commande (`kit-cta`).
 *
 * Cascade par locale : texte publié dans le CMS ▸ message i18n
 * `marketing.kit.cta.*` (FR/AR/EN). En FR, la valeur par défaut du registre
 * (identique au message FR) est acceptée ; en AR/EN elle est ignorée pour ne
 * pas afficher du français.
 *
 * Tolérant : base indisponible ou composant non synchronisé → messages i18n.
 * Un bouton « Commander » ne doit jamais casser pour un libellé.
 */
import { getTranslations } from 'next-intl/server';

import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';
import { resolveComponentFields } from '@/lib/components/field-resolver';
import type { ResolvedFields } from '@/lib/db/types';

import { DEFAULT_KIT_CTA_COPY, KIT_CTA_COMPONENT_KEY, type KitCtaCopy } from './cta-copy';

function cmsText(
  field: ResolvedFields[string] | undefined,
  acceptDefault: boolean,
): string | null {
  if (!field) return null;
  if (!acceptDefault && field.meta.source === 'default') return null;
  const value = field.value;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** Texte publié (binding) uniquement — jamais la valeur par défaut du registre. */
function publishedText(field: ResolvedFields[string] | undefined): string | null {
  return field?.meta.source === 'binding' ? cmsText(field, true) : null;
}

/** Lit un message brut (les jetons `{price}` restent intacts). */
function rawMessage(
  t: { raw: (key: string) => unknown },
  key: string,
  fallback: string,
): string {
  try {
    const value = t.raw(key);
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export async function resolveKitCtaCopy(locale: Locale = DEFAULT_LOCALE): Promise<KitCtaCopy> {
  const [fields, t] = await Promise.all([
    resolveComponentFields(KIT_CTA_COMPONENT_KEY, locale).catch((): ResolvedFields => ({})),
    getTranslations({ locale, namespace: 'marketing.kit.cta' }),
  ]);
  const acceptDefault = locale === DEFAULT_LOCALE;
  const messages = t as unknown as { raw: (key: string) => unknown };

  const pack = publishedText(fields.ctaPack);
  return {
    primary:
      cmsText(fields.ctaPrimary, acceptDefault) ??
      rawMessage(messages, 'primary', DEFAULT_KIT_CTA_COPY.primary),
    sticky:
      cmsText(fields.ctaSticky, acceptDefault) ??
      rawMessage(messages, 'sticky', DEFAULT_KIT_CTA_COPY.sticky),
    microcopy:
      cmsText(fields.ctaMicrocopy, acceptDefault) ??
      rawMessage(messages, 'microcopy', DEFAULT_KIT_CTA_COPY.microcopy),
    ...(pack ? { pack } : {}),
  };
}
