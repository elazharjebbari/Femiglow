import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'femiglow-web',
    timestamp: new Date().toISOString(),
  });
}
