/**
 * Reverse proxy : FemiGlow admin → Listmonk loopback.
 *
 *   GET/POST/PUT/DELETE /api/listmonk/<path>
 *     ↓ (auth check : admin session required)
 *     ↓ (inject Basic Auth header for Listmonk API user)
 *   <method> http://127.0.0.1:9000/<path>
 *
 * This is the M3.3 "Niveau 2" integration : one login (admin FemiGlow),
 * one domain, no Listmonk credentials exposed to the browser.
 *
 * Cf. docs/emailing/03-backend-integration.md §2.2
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'host',
]);

async function handler(req: NextRequest, ctx: { params: { path: string[] } }) {
  // 1. Auth gate
  let session;
  try {
    session = await requireAdmin('/admin/emails/listmonk');
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Listmonk creds present ?
  if (!env.LISTMONK_API_USER || !env.LISTMONK_API_TOKEN) {
    logger.warn('listmonk.proxy.not_configured');
    return new NextResponse('Listmonk not configured', { status: 503 });
  }
  const basic = `Basic ${Buffer.from(`${env.LISTMONK_API_USER}:${env.LISTMONK_API_TOKEN}`).toString('base64')}`;

  // 3. Build upstream URL
  const path = ctx.params.path.join('/');
  const upstream = new URL(`${env.LISTMONK_INTERNAL_URL}/${path}`);
  upstream.search = req.nextUrl.search;

  // 4. Forward headers (minus hop-by-hop) + inject auth
  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
  }
  headers.set('Authorization', basic);
  headers.set('X-Forwarded-User', session.email);

  // 5. Forward body for non-GET/HEAD
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();

  logger.info('listmonk.proxy.request', {
    method: req.method,
    path,
    user: session.email,
  });

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (err) {
    logger.error('listmonk.proxy.upstream_error', {
      method: req.method,
      path,
      error: String(err),
    });
    return new NextResponse('Listmonk upstream error', { status: 502 });
  }

  // 6. Stream response back, stripping hop-by-hop headers
  const responseHeaders = new Headers();
  for (const [k, v] of upstreamRes.headers.entries()) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) responseHeaders.set(k, v);
  }

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
