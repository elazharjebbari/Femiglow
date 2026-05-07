/**
 * CHA-110b — Édition / activation / duplication d'une version d'instruction.
 *
 * Cette route est un dispatcher : elle accepte form-encoded ou JSON, et
 * lit `_action` (form) ou `action` (JSON) pour choisir l'opération.
 *
 *   _action=update    → édite body / bodyAr / bodyArMa / notes (in-place)
 *   _action=activate  → active la version et désactive les autres du scope
 *   _action=duplicate → crée une nouvelle version (brouillon, désactivée)
 *                       basée sur cette version, avec patch optionnel
 *
 * Pourquoi un dispatcher : les `<form method="post">` HTML5 ne supportent
 * pas PATCH/DELETE. Plutôt que d'aller chercher un client JS, on encode
 * l'action dans le payload — robuste, accessible, fonctionne sans JS.
 *
 * Réponses :
 *   - JSON : `{ ok: true, ... }` ou `{ error, ... }` avec status code adapté
 *   - HTML : redirection 303 vers la liste, ou vers l'éditeur si update
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { adminInstructionPatch } from '@/lib/chat/contracts';
import { instructionRepo } from '@/lib/chat/repos/instruction';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Action = 'update' | 'activate' | 'duplicate';

function isAction(v: unknown): v is Action {
  return v === 'update' || v === 'activate' || v === 'duplicate';
}

/** "" → null, "  " → null, sinon trim conservé. */
function normalize(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? null : v;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const ct = req.headers.get('content-type') ?? '';
  const isJson = ct.includes('application/json');

  let payload: Record<string, unknown> = {};
  if (isJson) {
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
    }
  } else {
    const form = await req.formData();
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') payload[k] = v;
    }
  }

  const rawAction = isJson ? payload.action : payload._action;
  const action: Action = isAction(rawAction) ? rawAction : 'update';

  // Vérifie l'existence avant toute mutation : 404 propre.
  const existing = await instructionRepo.getById(params.id);
  if (!existing) {
    if (isJson) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    return NextResponse.redirect(
      new URL('/admin/chat/instructions?err=not-found', req.url),
      303,
    );
  }

  // ----- ACTIVATE -------------------------------------------------------
  if (action === 'activate') {
    const row = await instructionRepo.activate(params.id);
    if (!row) {
      return isJson
        ? NextResponse.json({ error: 'not-found' }, { status: 404 })
        : NextResponse.redirect(
            new URL('/admin/chat/instructions?err=activate', req.url),
            303,
          );
    }
    revalidateTag('chat-config');
    logger.info('chat.admin.instruction.activated', {
      id: row.id,
      by: auth.email,
    });
    if (isJson) return NextResponse.json({ ok: true, id: row.id });
    return NextResponse.redirect(
      new URL('/admin/chat/instructions?ok=activated', req.url),
      303,
    );
  }

  // ----- DUPLICATE ------------------------------------------------------
  if (action === 'duplicate') {
    const created = await instructionRepo.create({
      scope: existing.scope,
      body: typeof payload.body === 'string' && payload.body.length > 0
        ? payload.body
        : existing.body,
      bodyAr:
        typeof payload.bodyAr === 'string'
          ? normalize(payload.bodyAr) ?? null
          : existing.bodyAr,
      bodyArMa:
        typeof payload.bodyArMa === 'string'
          ? normalize(payload.bodyArMa) ?? null
          : existing.bodyArMa,
      notes:
        typeof payload.notes === 'string'
          ? normalize(payload.notes) ?? null
          : `Duplicata de v${existing.version}`,
      createdBy: auth.email,
    });
    revalidateTag('chat-config');
    logger.info('chat.admin.instruction.duplicated', {
      from: existing.id,
      to: created.id,
      by: auth.email,
    });
    if (isJson) {
      return NextResponse.json({ ok: true, id: created.id, version: created.version });
    }
    return NextResponse.redirect(
      new URL(`/admin/chat/instructions/${created.id}?ok=duplicated`, req.url),
      303,
    );
  }

  // ----- UPDATE (default) ----------------------------------------------
  const parsed = adminInstructionPatch.safeParse({
    body: typeof payload.body === 'string' ? payload.body : undefined,
    bodyAr: typeof payload.bodyAr === 'string' ? payload.bodyAr : undefined,
    bodyArMa: typeof payload.bodyArMa === 'string' ? payload.bodyArMa : undefined,
    notes: typeof payload.notes === 'string' ? payload.notes : undefined,
  });
  if (!parsed.success) {
    if (isJson) {
      return NextResponse.json(
        { error: 'invalid-input', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    return NextResponse.redirect(
      new URL(
        `/admin/chat/instructions/${params.id}?err=invalid-input`,
        req.url,
      ),
      303,
    );
  }

  const row = await instructionRepo.update(params.id, {
    body: parsed.data.body,
    bodyAr:
      parsed.data.bodyAr !== undefined ? normalize(parsed.data.bodyAr) ?? null : undefined,
    bodyArMa:
      parsed.data.bodyArMa !== undefined ? normalize(parsed.data.bodyArMa) ?? null : undefined,
    notes:
      parsed.data.notes !== undefined ? normalize(parsed.data.notes) ?? null : undefined,
  });
  if (!row) {
    return isJson
      ? NextResponse.json({ error: 'not-found' }, { status: 404 })
      : NextResponse.redirect(
          new URL('/admin/chat/instructions?err=not-found', req.url),
          303,
        );
  }
  revalidateTag('chat-config');
  logger.info('chat.admin.instruction.updated', {
    id: row.id,
    by: auth.email,
    fields: Object.keys(parsed.data),
  });

  if (isJson) {
    return NextResponse.json({
      ok: true,
      id: row.id,
      version: row.version,
      enabled: row.enabled,
    });
  }
  return NextResponse.redirect(
    new URL(`/admin/chat/instructions/${row.id}?ok=saved`, req.url),
    303,
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const row = await instructionRepo.getById(params.id);
  if (!row) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  return NextResponse.json({ instruction: row });
}
