/**
 * GET /api/admin/emails/templates/starters
 *
 * Retourne les sources HTML des templates de démarrage (default-femiglow + autres).
 * Utilisé par le wizard "Nouveau template" pour pré-remplir le source.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STARTERS = [
  {
    id: 'blank',
    name: 'Vide',
    description: 'Template minimal sans charte',
    inline:
      '<!doctype html><html lang="fr"><body><p>{{firstName}}, …</p></body></html>',
  },
  {
    id: 'default-femiglow',
    name: 'Default FemiGlow',
    description: 'Template haut calibre conforme à la charte FemiGlow',
    file: 'default-femiglow.html',
  },
];

export async function GET() {
  await requireAdmin('/api/admin/emails/templates/starters');

  const baseDir = path.join(
    process.cwd(),
    'src',
    'lib',
    'mail',
    'templates',
    'starters',
  );

  const results = await Promise.all(
    STARTERS.map(async (s) => {
      if ('inline' in s && s.inline) {
        return { id: s.id, name: s.name, description: s.description, htmlSource: s.inline };
      }
      if ('file' in s && s.file) {
        try {
          const html = await readFile(path.join(baseDir, s.file), 'utf8');
          return { id: s.id, name: s.name, description: s.description, htmlSource: html };
        } catch {
          return null;
        }
      }
      return null;
    }),
  );

  return NextResponse.json(results.filter(Boolean));
}
