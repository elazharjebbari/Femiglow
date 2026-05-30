import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { db } from '@/lib/db/client';
import { aiEnginePromptTemplates } from '@/lib/db/schema-ai-engine';
import { desc, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Types ---------- */

interface PromptTemplateResponse {
  id: string;
  nodeName: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  version: number;
  isActive: boolean;
  parentId: string | null;
  avgQualityScore: string | null;
  usageCount: number;
  createdAt: string;
}

/* ---------- Default prompt templates ---------- */

function getDefaultPromptTemplates(): PromptTemplateResponse[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'default-brief-analysis',
      nodeName: 'brief_analysis',
      name: 'Analyse de brief',
      systemPrompt:
        'Tu es un directeur de creation specialise dans le contenu de beaute et cosmtique pour les reseaux sociaux. Analyse le brief fourni et produis un plan de contenu structure.',
      userPromptTemplate:
        'Analyse ce brief et produis un plan de contenu:\n\nObjectif: {{objective}}\nPlateforme: {{platform}}\nFormat: {{format}}\nTon: {{tone}}\nMessage cle: {{keyMessage}}\n{{#productFocus}}Focus produit: {{productFocus}}{{/productFocus}}\n{{#trendReference}}Tendance: {{trendReference}}{{/trendReference}}',
      variables: ['objective', 'platform', 'format', 'tone', 'keyMessage', 'productFocus', 'trendReference'],
      version: 1,
      isActive: true,
      parentId: null,
      avgQualityScore: null,
      usageCount: 0,
      createdAt: now,
    },
    {
      id: 'default-script-writer',
      nodeName: 'script_writer',
      name: 'Ecriture de script',
      systemPrompt:
        'Tu es un copywriter expert en contenu de marque beaute. Ecris des scripts engageants et adaptes a la plateforme cible. Utilise un ton {{tone}} et integre les elements de la marque Femiglow.',
      userPromptTemplate:
        'A partir du plan de contenu suivant, redige un script complet:\n\n{{contentPlan}}\n\nContraintes:\n- Plateforme: {{platform}}\n- Format: {{format}}\n- Duree maximale: {{maxDuration}}\n- Langue: {{language}}',
      variables: ['contentPlan', 'platform', 'format', 'tone', 'maxDuration', 'language'],
      version: 1,
      isActive: true,
      parentId: null,
      avgQualityScore: null,
      usageCount: 0,
      createdAt: now,
    },
    {
      id: 'default-caption-gen',
      nodeName: 'caption_gen',
      name: 'Generation de caption',
      systemPrompt:
        'Tu es un expert en redaction de captions pour les reseaux sociaux dans le domaine de la beaute. Tes captions sont engageantes, utilisent des emojis strategiquement et integrent les hashtags pertinents.',
      userPromptTemplate:
        'Genere une caption optimisee pour {{platform}}:\n\nScript: {{script}}\nObjectif: {{objective}}\nTon: {{tone}}\nProduit: {{productFocus}}\n\nInclus:\n- Caption principale (max {{maxLength}} caracteres)\n- 3 variantes courtes\n- Hashtags recommandes (max 30)',
      variables: ['platform', 'script', 'objective', 'tone', 'productFocus', 'maxLength'],
      version: 1,
      isActive: true,
      parentId: null,
      avgQualityScore: null,
      usageCount: 0,
      createdAt: now,
    },
    {
      id: 'default-image-gen',
      nodeName: 'image_gen',
      name: 'Generation d\'image',
      systemPrompt:
        'Tu es un directeur artistique specialise dans la beaute et les cosmetiques. Genere des prompts visuels detailles et adaptes aux standards de la marque.',
      userPromptTemplate:
        'Genere un prompt visuel pour une image {{format}} sur {{platform}}:\n\nScript: {{script}}\nAmbiance: {{tone}}\nProduit: {{productFocus}}\n\nContraintes:\n- Style: editorial beaute, eclairage naturel\n- Palette: tons chauds, ivoire et terracotta\n- Resolution: {{resolution}}',
      variables: ['format', 'platform', 'script', 'tone', 'productFocus', 'resolution'],
      version: 1,
      isActive: true,
      parentId: null,
      avgQualityScore: null,
      usageCount: 0,
      createdAt: now,
    },
    {
      id: 'default-quality-gate',
      nodeName: 'quality_gate',
      name: 'Evaluation qualite',
      systemPrompt:
        'Tu es un evaluateur de contenu rigoureux. Evalue le contenu genere selon les criteres de qualite definis et attribue un score de 0 a 1.',
      userPromptTemplate:
        'Evalue la qualite du contenu genere:\n\nCaption: {{caption}}\nHashtags: {{hashtags}}\nScript: {{script}}\n\nCriteres:\n- Pertinence par rapport au brief (objectif: {{objective}})\n- Qualite redactionnelle\n- Adequation plateforme ({{platform}})\n- Engagement potentiel\n- Conformite marque\n\nRetourne un JSON avec: overallScore, subscores (pertinence, qualite, engagement, brand), et feedback.',
      variables: ['caption', 'hashtags', 'script', 'objective', 'platform'],
      version: 1,
      isActive: true,
      parentId: null,
      avgQualityScore: null,
      usageCount: 0,
      createdAt: now,
    },
  ];
}

/* ---------- GET: list prompt templates ---------- */

export async function GET(): Promise<Response> {
  try {
    await requireAdminApi();

    const database = db();
    if (database) {
      const rows = await database
        .select()
        .from(aiEnginePromptTemplates)
        .orderBy(desc(aiEnginePromptTemplates.createdAt));

      if (rows.length > 0) {
        const mapped: PromptTemplateResponse[] = rows.map((r) => ({
          id: r.id,
          nodeName: r.nodeName,
          name: r.name,
          systemPrompt: r.systemPrompt,
          userPromptTemplate: r.userPromptTemplate,
          variables: r.variables,
          version: r.version,
          isActive: r.isActive,
          parentId: r.parentId,
          avgQualityScore: r.avgQualityScore,
          usageCount: r.usageCount,
          createdAt: r.createdAt.toISOString(),
        }));
        return NextResponse.json({ prompts: mapped });
      }
    }

    return NextResponse.json({ prompts: getDefaultPromptTemplates() });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}

/* ---------- POST: create/update a prompt template ---------- */

const promptSchema = z.object({
  id: z.string().optional(),
  nodeName: z.string().min(1),
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  variables: z.array(z.string()),
  isActive: z.boolean().default(true),
  parentId: z.string().nullable().optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdminApi();

    const body = await request.json();
    const parsed = promptSchema.parse(body);

    const database = db();
    if (!database) {
      return NextResponse.json(
        { error: 'Database non disponible. Mode memoire uniquement.' },
        { status: 503 },
      );
    }

    if (parsed.id) {
      // When updating, create a new version (append-only)
      const existing = await database
        .select()
        .from(aiEnginePromptTemplates)
        .where(eq(aiEnginePromptTemplates.id, parsed.id))
        .limit(1);

      const parent = existing[0];
      const nextVersion = parent ? parent.version + 1 : 1;

      // Deactivate previous version
      if (parent) {
        await database
          .update(aiEnginePromptTemplates)
          .set({ isActive: false })
          .where(eq(aiEnginePromptTemplates.id, parsed.id));
      }

      // Insert new version
      const [created] = await database
        .insert(aiEnginePromptTemplates)
        .values({
          nodeName: parsed.nodeName,
          name: parsed.name,
          systemPrompt: parsed.systemPrompt,
          userPromptTemplate: parsed.userPromptTemplate,
          variables: parsed.variables,
          version: nextVersion,
          isActive: parsed.isActive,
          parentId: parsed.id,
        })
        .returning();

      return NextResponse.json({ prompt: created });
    }

    // Create new
    const [created] = await database
      .insert(aiEnginePromptTemplates)
      .values({
        nodeName: parsed.nodeName,
        name: parsed.name,
        systemPrompt: parsed.systemPrompt,
        userPromptTemplate: parsed.userPromptTemplate,
        variables: parsed.variables,
        isActive: parsed.isActive,
        parentId: parsed.parentId ?? null,
      })
      .returning();

    return NextResponse.json({ prompt: created }, { status: 201 });
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
