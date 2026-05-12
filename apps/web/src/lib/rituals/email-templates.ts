import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Rendu minimal de templates Markdown avec front-matter (subject, preheader…)
 * et substitution `{{var}}`.
 *
 * Cf. docs/reviews-wall/execution/06-admin-plan-action.md § 10
 */

export interface RenderedEmail {
  subject: string;
  preheader: string | null;
  from: string;
  replyTo: string;
  body: string;
}

interface ParsedTemplate {
  meta: Record<string, string>;
  body: string;
}

function parseFrontMatter(raw: string): ParsedTemplate {
  if (!raw.startsWith('---')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: raw };
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trimStart();
  const meta: Record<string, string> = {};
  for (const line of fm.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = value;
  }
  return { meta, body };
}

function applyVariables(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : '',
  );
}

export async function renderEmailTemplate(
  templateName: string,
  variables: Record<string, string>,
): Promise<RenderedEmail> {
  const path = join(
    process.cwd(),
    'content',
    'email-templates',
    `${templateName}.md`,
  );
  const raw = await readFile(path, 'utf8');
  const { meta, body } = parseFrontMatter(raw);
  return {
    subject: applyVariables(meta.subject ?? '', variables),
    preheader: meta.preheader ? applyVariables(meta.preheader, variables) : null,
    from: meta.from ?? 'FemiGlow <maison@femiglow-maroc.com>',
    replyTo: meta.replyTo ?? 'info@femiglow-maroc.com',
    body: applyVariables(body, variables),
  };
}

/**
 * Variante synchrone in-memory pour les tests (évite l'I/O fichier).
 */
export function renderEmailFromRaw(
  raw: string,
  variables: Record<string, string>,
): RenderedEmail {
  const { meta, body } = parseFrontMatter(raw);
  return {
    subject: applyVariables(meta.subject ?? '', variables),
    preheader: meta.preheader ? applyVariables(meta.preheader, variables) : null,
    from: meta.from ?? '',
    replyTo: meta.replyTo ?? '',
    body: applyVariables(body, variables),
  };
}
