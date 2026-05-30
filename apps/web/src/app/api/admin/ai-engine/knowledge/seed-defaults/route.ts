import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { seedKnowledgeBase, seedStrategicBrief } from '@/lib/ai-engine/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Charge l'ensemble des connaissances par defaut :
 *  1. Collections + documents de base (seedKnowledgeBase).
 *  2. Rapport strategique decoupe en knowledge documents (seedStrategicBrief),
 *     idempotent par titre.
 *
 * Les documents ingeres sont chunkes + embeddes immediatement et donc
 * immediatement recherchables par le pipeline RAG.
 */
export async function POST(): Promise<Response> {
  try {
    await requireAdminApi();

    const base = await seedKnowledgeBase();
    const brief = await seedStrategicBrief();

    const errors = [...base.errors, ...brief.errors];
    const result = {
      collections: base.collections,
      baseDocuments: base.documents,
      strategicDocuments: brief.documents,
      strategicSkipped: brief.skipped,
      documents: base.documents + brief.documents,
      errors,
    };

    const status = errors.length > 0 ? 207 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
