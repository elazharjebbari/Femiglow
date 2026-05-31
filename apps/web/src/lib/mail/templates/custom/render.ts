/**
 * Renderer Handlebars + sanitize (M5.7.2).
 *
 * Compile + cache LRU (50 entries) + sanitize. Pas d'inline CSS pour
 * V1 (les emails sont déjà inline-CSS dans default-femiglow.html).
 */
import Handlebars from 'handlebars';
import { createHash } from 'node:crypto';
import { sanitizeEmailHtml } from './sanitize';
import type { ResolvedContext } from './context-resolver';

export type RenderedEmail = {
  subject: string;
  preheader: string;
  html: string;
};

export type RenderInput = {
  subjectTmpl: string;
  preheaderTmpl?: string;
  htmlSource: string;
};

// ── LRU cache de templates compilés ─────────────────────────────────────

const CACHE_MAX = 50;
const compileCache = new Map<string, HandlebarsTemplateDelegate>();

function hashSource(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

function compileCached(source: string): HandlebarsTemplateDelegate {
  const key = hashSource(source);
  const cached = compileCache.get(key);
  if (cached) {
    // Move to end (LRU update)
    compileCache.delete(key);
    compileCache.set(key, cached);
    return cached;
  }
  const fn = Handlebars.compile(source, { noEscape: false, strict: false });
  // Evict oldest if cache full
  if (compileCache.size >= CACHE_MAX) {
    const oldest = compileCache.keys().next().value;
    if (oldest) compileCache.delete(oldest);
  }
  compileCache.set(key, fn);
  return fn;
}

export function renderTemplate(
  template: RenderInput,
  context: ResolvedContext,
): RenderedEmail {
  const subjectFn = compileCached(template.subjectTmpl);
  const preheaderFn = compileCached(template.preheaderTmpl ?? '');
  const htmlFn = compileCached(template.htmlSource);

  const subject = subjectFn(context);
  const preheader = preheaderFn(context);
  const htmlRaw = htmlFn(context);

  // Sanitize : protège même contre les triples braces {{{var}}} qui
  // contiendraient du HTML hostile injecté via customVars.
  const html = sanitizeEmailHtml(htmlRaw);

  return { subject, preheader, html };
}

/** Vide le cache (utile pour les tests). */
export function clearTemplateCache(): void {
  compileCache.clear();
}
