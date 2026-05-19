import { NextResponse } from 'next/server';
import { listEnabledTrackingProviders } from '@/lib/db/queries/tracking/providers';
import { getAdapter } from '@/lib/tracking/providers/registry';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { filterForGtm } from './filter-for-gtm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const providers = await listEnabledTrackingProviders();
    const eligible = filterForGtm(providers);
    const snippets = eligible.flatMap((provider) => {
      const adapter = getAdapter(provider.kind);
      if (!adapter || !adapter.clientSnippet) return [];
      const code = adapter.clientSnippet(provider);
      if (!code) return [];
      return [{ kind: provider.kind, code }];
    });
    return NextResponse.json(
      { snippets },
      { headers: { 'cache-control': 'private, max-age=60' } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
