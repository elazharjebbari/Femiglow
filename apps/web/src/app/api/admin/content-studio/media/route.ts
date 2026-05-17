import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse } from '@/lib/errors/http-error';
import { listContentStudioMedia } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? undefined;
    const requestedCompartment = url.searchParams.get('compartment');
    const compartment =
      requestedCompartment === 'ai_generated' || requestedCompartment === 'all'
        ? requestedCompartment
        : 'imported';
    const media = await listContentStudioMedia({ q, limit: 40, compartment });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
