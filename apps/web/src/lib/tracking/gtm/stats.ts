import { createHash } from 'node:crypto';
import type { GtmContainer, GtmStats, GtmMeta } from './types';

const CONVERSION_TAG_PATTERNS = [
  /^Ads Conv —/,
  /^GA4 Evt — purchase$/,
  /^GA4 Evt — generate_lead$/,
  /^GA4 Evt — sign_up$/,
  /^GA4 Evt — begin_checkout$/,
];

export function computeStats(c: GtmContainer): GtmStats {
  const v = c.containerVersion;
  const tags = v.tag ?? [];
  const triggers = v.trigger ?? [];
  const variables = v.variable ?? [];
  const folders = v.folder ?? [];

  const byCategory: Record<string, number> = {};
  for (const f of folders) {
    byCategory[f.name] = tags.filter((t) => t.parentFolderId === f.folderId).length;
  }

  return {
    tags: tags.length,
    triggers: triggers.length,
    variables: variables.length,
    folders: folders.length,
    conversions: tags.filter((t) =>
      CONVERSION_TAG_PATTERNS.some((p) => p.test(t.name ?? '')),
    ).length,
    chatTriggers: triggers.filter((t) => t.name?.startsWith('CE — chat_')).length,
    chatDims: variables.filter((v2) => v2.name?.startsWith('DLV - chat.')).length,
    byCategory,
  };
}

export function computeMeta(pretty: string, version = '1.0.0'): GtmMeta {
  return {
    generatedAt: new Date().toISOString(),
    version,
    sizeBytes: Buffer.byteLength(pretty, 'utf8'),
    lineCount: pretty.split('\n').length,
    sha256: createHash('sha256').update(pretty).digest('hex'),
  };
}
