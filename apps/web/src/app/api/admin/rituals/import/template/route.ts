import { getAdminSession } from '@/lib/auth/require-admin';
import {
  generateTemplate,
  type TemplateFormat,
} from '@/lib/rituals/import/template-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED: TemplateFormat[] = ['csv', 'csv-comma', 'tsv', 'json', 'jsonl'];

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') as TemplateFormat | null;
  if (!format || !ALLOWED.includes(format)) {
    return new Response('Bad format', { status: 400 });
  }

  const { content, contentType, filename } = generateTemplate(format);
  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
