import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { getEngineConfig } from '@/lib/ai-engine/config';
import { db } from '@/lib/db/client';
import { aiEngineWorkflowConfigs } from '@/lib/db/schema-ai-engine';
import { desc, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Default workflows (returned when DB is empty) ---------- */

interface WorkflowConfigResponse {
  id: string;
  name: string;
  description: string | null;
  platform: string | null;
  format: string | null;
  graphConfig: unknown;
  defaultTone: string;
  defaultLanguage: string;
  qualityThreshold: string;
  maxRetries: number;
  maxBudgetCents: number;
  humanReviewRequired: boolean;
  autoPublish: boolean;
  providerOverrides: unknown;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function getDefaultWorkflows(): WorkflowConfigResponse[] {
  const config = getEngineConfig();
  const now = new Date().toISOString();
  return [
    {
      id: 'default-reel-instagram',
      name: 'Reel Instagram',
      description: 'Pipeline complet pour la creation de reels Instagram',
      platform: 'instagram',
      format: 'reel',
      graphConfig: {
        nodes: ['brief_analysis', 'script_writer', 'image_gen', 'caption_gen', 'quality_gate'],
        edges: [
          ['brief_analysis', 'script_writer'],
          ['script_writer', 'image_gen'],
          ['image_gen', 'caption_gen'],
          ['caption_gen', 'quality_gate'],
        ],
      },
      defaultTone: config.defaults.tone,
      defaultLanguage: config.defaults.language,
      qualityThreshold: String(config.quality.threshold),
      maxRetries: config.defaults.maxRetries,
      maxBudgetCents: config.budget.maxPerJobCents,
      humanReviewRequired: config.quality.humanReviewRequired,
      autoPublish: false,
      providerOverrides: null,
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-carousel-instagram',
      name: 'Carrousel Instagram',
      description: 'Pipeline pour la creation de carrousels multi-slides',
      platform: 'instagram',
      format: 'carousel',
      graphConfig: {
        nodes: ['brief_analysis', 'script_writer', 'image_gen', 'caption_gen', 'quality_gate'],
        edges: [
          ['brief_analysis', 'script_writer'],
          ['script_writer', 'image_gen'],
          ['image_gen', 'caption_gen'],
          ['caption_gen', 'quality_gate'],
        ],
      },
      defaultTone: config.defaults.tone,
      defaultLanguage: config.defaults.language,
      qualityThreshold: String(config.quality.threshold),
      maxRetries: config.defaults.maxRetries,
      maxBudgetCents: config.budget.maxPerJobCents,
      humanReviewRequired: config.quality.humanReviewRequired,
      autoPublish: false,
      providerOverrides: null,
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-post-tiktok',
      name: 'Post TikTok',
      description: 'Pipeline pour la generation de contenu TikTok',
      platform: 'tiktok',
      format: 'reel',
      graphConfig: {
        nodes: ['brief_analysis', 'script_writer', 'caption_gen', 'quality_gate'],
        edges: [
          ['brief_analysis', 'script_writer'],
          ['script_writer', 'caption_gen'],
          ['caption_gen', 'quality_gate'],
        ],
      },
      defaultTone: 'playful',
      defaultLanguage: config.defaults.language,
      qualityThreshold: String(config.quality.threshold),
      maxRetries: config.defaults.maxRetries,
      maxBudgetCents: config.budget.maxPerJobCents,
      humanReviewRequired: config.quality.humanReviewRequired,
      autoPublish: false,
      providerOverrides: null,
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/* ---------- GET: list workflow configs ---------- */

export async function GET(): Promise<Response> {
  try {
    await requireAdminApi();

    const database = db();
    if (database) {
      const rows = await database
        .select()
        .from(aiEngineWorkflowConfigs)
        .orderBy(desc(aiEngineWorkflowConfigs.createdAt));

      if (rows.length > 0) {
        const mapped: WorkflowConfigResponse[] = rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          platform: r.platform,
          format: r.format,
          graphConfig: r.graphConfig,
          defaultTone: r.defaultTone,
          defaultLanguage: r.defaultLanguage,
          qualityThreshold: r.qualityThreshold,
          maxRetries: r.maxRetries,
          maxBudgetCents: r.maxBudgetCents,
          humanReviewRequired: r.humanReviewRequired,
          autoPublish: r.autoPublish,
          providerOverrides: r.providerOverrides,
          version: r.version,
          isActive: r.isActive,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));
        return NextResponse.json({ workflows: mapped });
      }
    }

    return NextResponse.json({ workflows: getDefaultWorkflows() });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}

/* ---------- POST: create/update a workflow config ---------- */

const workflowSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  format: z.string().nullable().optional(),
  graphConfig: z.record(z.unknown()),
  defaultTone: z.string().default('professional'),
  defaultLanguage: z.string().default('fr'),
  qualityThreshold: z.string().default('0.70'),
  maxRetries: z.number().int().min(0).default(3),
  maxBudgetCents: z.number().int().min(0).default(100),
  humanReviewRequired: z.boolean().default(true),
  autoPublish: z.boolean().default(false),
  providerOverrides: z.record(z.unknown()).nullable().optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdminApi();

    const body = await request.json();
    const parsed = workflowSchema.parse(body);

    const database = db();
    if (!database) {
      return NextResponse.json(
        { error: 'Database non disponible. Mode memoire uniquement.' },
        { status: 503 },
      );
    }

    if (parsed.id) {
      // Update existing
      const [updated] = await database
        .update(aiEngineWorkflowConfigs)
        .set({
          name: parsed.name,
          description: parsed.description ?? null,
          platform: parsed.platform ?? null,
          format: parsed.format ?? null,
          graphConfig: parsed.graphConfig,
          defaultTone: parsed.defaultTone,
          defaultLanguage: parsed.defaultLanguage,
          qualityThreshold: parsed.qualityThreshold,
          maxRetries: parsed.maxRetries,
          maxBudgetCents: parsed.maxBudgetCents,
          humanReviewRequired: parsed.humanReviewRequired,
          autoPublish: parsed.autoPublish,
          providerOverrides: parsed.providerOverrides ?? null,
          updatedAt: new Date(),
        })
        .where(eq(aiEngineWorkflowConfigs.id, parsed.id))
        .returning();

      return NextResponse.json({ workflow: updated });
    }

    // Create new
    const [created] = await database
      .insert(aiEngineWorkflowConfigs)
      .values({
        name: parsed.name,
        description: parsed.description ?? null,
        platform: parsed.platform ?? null,
        format: parsed.format ?? null,
        graphConfig: parsed.graphConfig,
        defaultTone: parsed.defaultTone,
        defaultLanguage: parsed.defaultLanguage,
        qualityThreshold: parsed.qualityThreshold,
        maxRetries: parsed.maxRetries,
        maxBudgetCents: parsed.maxBudgetCents,
        humanReviewRequired: parsed.humanReviewRequired,
        autoPublish: parsed.autoPublish,
        providerOverrides: parsed.providerOverrides ?? null,
      })
      .returning();

    return NextResponse.json({ workflow: created }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.errors },
        { status: 400 },
      );
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
