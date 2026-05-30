import { eq, sql, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  aiEngineKnowledgeCollections,
  aiEngineKnowledgeDocuments,
  aiEngineKnowledgeChunks,
} from '@/lib/db/schema-ai-engine';
import { createLogger } from '../utils/logger';

const log = createLogger('knowledge:collections');

export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  documentCount: number;
  chunkCount: number;
  lastIndexedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function createCollection(
  name: string,
  slug: string,
  description: string | null,
  category: string,
): Promise<CollectionRow> {
  const drizzle = db();
  if (!drizzle) {
    log.warn('No DB connection, cannot create collection');
    throw new Error('Database connection required for knowledge collections');
  }

  const rows = await drizzle
    .insert(aiEngineKnowledgeCollections)
    .values({ name, slug, description, category })
    .returning();

  const row = rows[0]!;
  log.info('Collection created', { slug, category });
  return mapRow(row);
}

export async function listCollections(): Promise<CollectionRow[]> {
  const drizzle = db();
  if (!drizzle) {
    log.warn('No DB connection, returning empty collections list');
    return [];
  }

  const rows = await drizzle
    .select()
    .from(aiEngineKnowledgeCollections)
    .where(eq(aiEngineKnowledgeCollections.isActive, true))
    .orderBy(aiEngineKnowledgeCollections.name);

  return rows.map(mapRow);
}

export async function getCollection(slug: string): Promise<CollectionRow | null> {
  const drizzle = db();
  if (!drizzle) return null;

  const rows = await drizzle
    .select()
    .from(aiEngineKnowledgeCollections)
    .where(eq(aiEngineKnowledgeCollections.slug, slug))
    .limit(1);

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteCollection(id: string): Promise<void> {
  const drizzle = db();
  if (!drizzle) return;

  await drizzle
    .update(aiEngineKnowledgeCollections)
    .set({ isActive: false })
    .where(eq(aiEngineKnowledgeCollections.id, id));

  log.info('Collection soft-deleted', { id });
}

export async function updateCollectionCounts(collectionId: string): Promise<void> {
  const drizzle = db();
  if (!drizzle) return;

  const [docResult] = await drizzle
    .select({ count: sql<number>`count(*)::int` })
    .from(aiEngineKnowledgeDocuments)
    .where(eq(aiEngineKnowledgeDocuments.collectionId, collectionId));

  const [chunkResult] = await drizzle
    .select({ count: sql<number>`count(*)::int` })
    .from(aiEngineKnowledgeChunks)
    .where(eq(aiEngineKnowledgeChunks.collectionId, collectionId));

  await drizzle
    .update(aiEngineKnowledgeCollections)
    .set({
      documentCount: docResult?.count ?? 0,
      chunkCount: chunkResult?.count ?? 0,
      lastIndexedAt: new Date(),
    })
    .where(eq(aiEngineKnowledgeCollections.id, collectionId));
}

interface DefaultCollection {
  name: string;
  slug: string;
  description: string;
  category: string;
}

const DEFAULT_COLLECTIONS: DefaultCollection[] = [
  {
    name: 'Psychologie du consommateur & Neuromarketing',
    slug: 'neuromarketing',
    description: 'Biais cognitifs, triggers emotionnels, neuroscience de l\'attention',
    category: 'science',
  },
  {
    name: 'Science du contenu viral',
    slug: 'viral-content',
    description: 'Frameworks de viralite, mecanismes de partage, emotional arousal',
    category: 'science',
  },
  {
    name: 'Algorithmes des plateformes sociales',
    slug: 'platform-algorithms',
    description: 'Signaux de classement Instagram, TikTok, Facebook, Pinterest, LinkedIn',
    category: 'platform',
  },
  {
    name: 'Strategie contenu beaute & J-Beauty',
    slug: 'jbeauty-strategy',
    description: 'Piliers de contenu beaute, tendances J-Beauty, storytelling culturel',
    category: 'strategy',
  },
  {
    name: 'Production contenu AI : regles et contraintes',
    slug: 'ai-content-rules',
    description: 'Guidelines de production AI, prompt engineering, qualite du contenu',
    category: 'operations',
  },
  {
    name: 'Tendances emergentes et signaux faibles',
    slug: 'emerging-trends',
    description: 'Veille tendances, signaux faibles, opportunities de contenu',
    category: 'trends',
  },
  {
    name: 'Brand guidelines FemiGlow',
    slug: 'brand-femiglow',
    description: 'Identite de marque, ton editorial, vocabulaire, interdits',
    category: 'brand',
  },
  {
    name: 'Fiches produits et ingredients',
    slug: 'products-ingredients',
    description: 'Catalogue produits, ingredients japonais, benefices',
    category: 'brand',
  },
  {
    name: 'Copywriting formulas et frameworks',
    slug: 'copywriting',
    description: 'Formules de copywriting, frameworks AIDA/PAS/BAB, hooks',
    category: 'craft',
  },
];

export async function seedDefaultCollections(): Promise<CollectionRow[]> {
  const drizzle = db();
  if (!drizzle) {
    log.warn('No DB connection, cannot seed collections');
    return [];
  }

  const created: CollectionRow[] = [];

  for (const def of DEFAULT_COLLECTIONS) {
    const existing = await getCollection(def.slug);
    if (existing) {
      created.push(existing);
      continue;
    }
    const row = await createCollection(def.name, def.slug, def.description, def.category);
    created.push(row);
  }

  log.info('Default collections seeded', { count: created.length });
  return created;
}

export interface UpdateCollectionData {
  name?: string;
  description?: string | null;
  category?: string;
}

export async function updateCollection(
  id: string,
  data: UpdateCollectionData,
): Promise<CollectionRow> {
  const drizzle = db();
  if (!drizzle) {
    throw new Error('Database connection required');
  }

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.description !== undefined) updateFields.description = data.description;
  if (data.category !== undefined) updateFields.category = data.category;

  const [updated] = await drizzle
    .update(aiEngineKnowledgeCollections)
    .set(updateFields)
    .where(eq(aiEngineKnowledgeCollections.id, id))
    .returning();

  if (!updated) {
    throw new Error(`Collection ${id} not found`);
  }

  log.info('Collection updated', { id, fields: Object.keys(data) });
  return mapRow(updated);
}

export interface DocumentDetail {
  id: string;
  collectionId: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  contentText: string | null;
  metadata: unknown;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function getDocumentById(
  collectionId: string,
  documentId: string,
): Promise<DocumentDetail | null> {
  const drizzle = db();
  if (!drizzle) return null;

  const rows = await drizzle
    .select()
    .from(aiEngineKnowledgeDocuments)
    .where(
      and(
        eq(aiEngineKnowledgeDocuments.id, documentId),
        eq(aiEngineKnowledgeDocuments.collectionId, collectionId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    collectionId: row.collectionId,
    title: row.title,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    contentText: row.contentText,
    metadata: row.metadata,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRow(row: typeof aiEngineKnowledgeCollections.$inferSelect): CollectionRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    documentCount: row.documentCount,
    chunkCount: row.chunkCount,
    lastIndexedAt: row.lastIndexedAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
