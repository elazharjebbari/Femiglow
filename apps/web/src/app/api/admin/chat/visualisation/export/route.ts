/**
 * CHA-138 — Export du pipeline graphique : SVG statique ou Mermaid.
 *
 * GET /api/admin/chat/visualisation/export?format=svg|mermaid
 *
 * - SVG : version sans animations, ré-utilisable dans la doc.
 * - Mermaid : digestible dans Notion / GitHub.
 *
 * (Le PNG n'est pas généré côté serveur pour éviter une dépendance
 * lourde type Puppeteer ; on laisse le navigateur le faire via canvas
 * côté client.)
 */
import { type NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CHA-230 — Aligné sur le PipelineGraph mis à jour : intent + humanize + lead.
// Doit rester en phase avec `src/components/admin/chat/PipelineGraph.tsx`.
const NODES = [
  { id: 'visitor', label: 'Visiteur', cx: 50, cy: 110 },
  { id: 'sanitize', label: 'Sanitize', cx: 160, cy: 110 },
  { id: 'lang', label: 'Lang', cx: 260, cy: 110 },
  { id: 'intent', label: 'Intent (regex/LLM)', cx: 370, cy: 110 },
  { id: 'charter', label: 'Charte', cx: 480, cy: 110 },
  { id: 'rag', label: 'RAG', cx: 590, cy: 55 },
  { id: 'provider', label: 'Provider (retry/breaker)', cx: 590, cy: 110 },
  { id: 'stream', label: 'Stream', cx: 700, cy: 110 },
  { id: 'humanize', label: 'Humanize', cx: 820, cy: 110 },
  { id: 'response', label: 'Réponse', cx: 940, cy: 110 },
  { id: 'lead', label: 'Lead (décision)', cx: 1080, cy: 110 },
];

const EDGES: Array<[string, string]> = [
  ['visitor', 'sanitize'],
  ['sanitize', 'lang'],
  ['lang', 'intent'],
  ['intent', 'charter'],
  ['charter', 'rag'],
  ['charter', 'provider'],
  ['rag', 'provider'],
  ['provider', 'stream'],
  ['stream', 'humanize'],
  ['humanize', 'response'],
  ['response', 'lead'],
];

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const format = (req.nextUrl.searchParams.get('format') ?? 'svg').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  if (format === 'mermaid') {
    const lines = ['flowchart LR'];
    for (const n of NODES) {
      lines.push(`  ${n.id}["${n.label}"]`);
    }
    for (const [from, to] of EDGES) {
      lines.push(`  ${from} --> ${to}`);
    }
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="chat-pipeline-${date}.mmd"`,
      },
    });
  }

  // SVG par défaut.
  const svgEdges = EDGES.map(([fromId, toId]) => {
    const a = NODES.find((n) => n.id === fromId)!;
    const b = NODES.find((n) => n.id === toId)!;
    return `<line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}" stroke="#1c1917" stroke-width="1.5"/>`;
  }).join('\n');

  const svgNodes = NODES.map(
    (n) => `<g>
  <circle cx="${n.cx}" cy="${n.cy}" r="28" fill="white" stroke="#1c1917" stroke-width="1.5"/>
  <text x="${n.cx}" y="${n.cy + 4}" text-anchor="middle" font-size="10" fill="#1c1917">${escapeXml(n.label)}</text>
</g>`,
  ).join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1180 200" role="img" aria-label="Pipeline du chat FemiGlow">
${svgEdges}
${svgNodes}
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="chat-pipeline-${date}.svg"`,
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
