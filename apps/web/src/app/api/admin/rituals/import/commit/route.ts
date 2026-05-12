import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import {
  commitImportBatch,
  type ImportFormat,
} from '@/lib/rituals/import/commit-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CanonicalFieldSchema = z.enum([
  'body',
  'wouldRecommend',
  'ritualTags',
  'authorFirstName',
  'authorCity',
  'initiatedSince',
  'isAnonymous',
  'language',
  'productKey',
]);

const ImportCommitPayloadSchema = z.object({
  format: z.enum(['csv', 'csv-comma', 'tsv', 'json', 'jsonl']),
  content: z.string().min(1).max(5 * 1024 * 1024),
  defaultProductKey: z.string().optional(),
  includeWarnings: z.boolean().optional(),
  importNote: z.string().max(500).optional(),
  columnMapping: z.record(z.string(), CanonicalFieldSchema.nullable()).optional(),
});

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'JSON invalide' } },
      { status: 400 },
    );
  }

  const parsed = ImportCommitPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Payload invalide',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await commitImportBatch(
      {
        format: parsed.data.format as ImportFormat,
        content: parsed.data.content,
        defaultProductKey: parsed.data.defaultProductKey,
        includeWarnings: parsed.data.includeWarnings,
        importNote: parsed.data.importNote,
        columnMapping: parsed.data.columnMapping,
      },
      { actorId: session.adminId },
    );
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[admin/rituals/import/commit] error', e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: msg } },
      { status: 500 },
    );
  }
}
