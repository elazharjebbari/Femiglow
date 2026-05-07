import { and, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { MediaVariant, VariantBreakpoint, VariantFormat } from '@/lib/db/types';

export interface CreateVariantInput {
  mediaId: string;
  format: VariantFormat;
  breakpoint?: VariantBreakpoint | null;
  width?: number | null;
  height?: number | null;
  bitrateKbps?: number | null;
  quality?: number | null;
  sizeBytes: number;
  url: string;
  checksum: string;
}

export async function createVariant(input: CreateVariantInput): Promise<MediaVariant> {
  const variant: MediaVariant = {
    id: createId('mv'),
    mediaId: input.mediaId,
    format: input.format,
    breakpoint: input.breakpoint ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    bitrateKbps: input.bitrateKbps ?? null,
    quality: input.quality ?? null,
    sizeBytes: input.sizeBytes,
    url: input.url,
    checksum: input.checksum,
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.mediaVariants).values(variant);
    return variant;
  }
  memoryStore().mediaVariants.set(variant.id, variant);
  return variant;
}

export async function listVariants(mediaId: string): Promise<MediaVariant[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.mediaVariants)
      .where(eq(schema.mediaVariants.mediaId, mediaId));
    return rows as unknown as MediaVariant[];
  }
  return Array.from(memoryStore().mediaVariants.values()).filter((v) => v.mediaId === mediaId);
}

export async function deleteVariantsByMedia(mediaId: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.mediaVariants).where(eq(schema.mediaVariants.mediaId, mediaId));
    return;
  }
  const store = memoryStore();
  for (const v of Array.from(store.mediaVariants.values())) {
    if (v.mediaId === mediaId) store.mediaVariants.delete(v.id);
  }
}

export async function findVariant(
  mediaId: string,
  format: VariantFormat,
  breakpoint: VariantBreakpoint | null,
): Promise<MediaVariant | null> {
  const drizzle = db();
  if (drizzle) {
    const conditions = [
      eq(schema.mediaVariants.mediaId, mediaId),
      eq(schema.mediaVariants.format, format),
    ];
    if (breakpoint !== null) conditions.push(eq(schema.mediaVariants.breakpoint, breakpoint));
    const rows = await drizzle
      .select()
      .from(schema.mediaVariants)
      .where(and(...conditions))
      .limit(1);
    return (rows[0] as unknown as MediaVariant | undefined) ?? null;
  }
  for (const v of memoryStore().mediaVariants.values()) {
    if (v.mediaId === mediaId && v.format === format && v.breakpoint === breakpoint) return v;
  }
  return null;
}

export async function upsertVariant(input: CreateVariantInput): Promise<MediaVariant> {
  const existing = await findVariant(input.mediaId, input.format, input.breakpoint ?? null);
  if (!existing) return createVariant(input);

  const drizzle = db();
  const next: MediaVariant = {
    ...existing,
    width: input.width ?? null,
    height: input.height ?? null,
    bitrateKbps: input.bitrateKbps ?? null,
    quality: input.quality ?? null,
    sizeBytes: input.sizeBytes,
    url: input.url,
    checksum: input.checksum,
  };
  if (drizzle) {
    await drizzle
      .update(schema.mediaVariants)
      .set(next)
      .where(eq(schema.mediaVariants.id, existing.id));
    return next;
  }
  memoryStore().mediaVariants.set(existing.id, next);
  return next;
}

export function totalVariantsSize(variants: MediaVariant[]): number {
  return variants.reduce((sum, v) => sum + v.sizeBytes, 0);
}
