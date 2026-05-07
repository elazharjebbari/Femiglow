/**
 * CHA-087 / CHA-088 / CHA-089 / CHA-090 — Loaders RAG.
 *
 * Chacun retourne un texte brut (markdown) + métadonnées légères.
 * Les loaders « lourds » (`pdf`, `docx`) sont importés dynamiquement
 * pour éviter de gonfler le bundle de l'app principale.
 *
 * Tous les loaders s'exécutent côté Node (jamais Edge).
 */

export interface LoaderResult {
  body: string;
  metadata: {
    title?: string;
    url?: string;
    fetchedAt: string;
    contentType: string;
  };
}

/** Loader URL — fetch + cleaner HTML basique. */
export async function loadUrl(url: string): Promise<LoaderResult> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'FemiGlowBot/1.0 (+https://femiglow.com/about)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`loadUrl: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const cleaned = cleanHtml(html);
  return {
    body: cleaned.body,
    metadata: {
      title: cleaned.title,
      url,
      fetchedAt: new Date().toISOString(),
      contentType: res.headers.get('content-type') ?? 'text/html',
    },
  };
}

/** Loader Markdown / Snippet inline / FAQ structurée. */
export function loadMarkdown(body: string, label?: string): LoaderResult {
  return {
    body: body.trim(),
    metadata: {
      title: label,
      fetchedAt: new Date().toISOString(),
      contentType: 'text/markdown',
    },
  };
}

/** Loader FAQ : { Q: …, A: … }[] → markdown structuré. */
export function loadFaq(
  pairs: Array<{ q: string; a: string }>,
  label?: string,
): LoaderResult {
  const body = pairs
    .map(({ q, a }) => `### ${q.trim()}\n\n${a.trim()}`)
    .join('\n\n');
  return {
    body,
    metadata: {
      title: label,
      fetchedAt: new Date().toISOString(),
      contentType: 'application/json',
    },
  };
}

/** Loader PDF — pdfjs-dist (legacy build) en dynamic import.
 *
 * `webpackIgnore` : webpack/turbopack skip la résolution statique → la
 * build passe sans `pdfjs-dist` installé. Le dynamic import est résolu
 * par Node au runtime, et lèvera une erreur claire si le pkg manque.
 */
export async function loadPdf(buffer: ArrayBuffer): Promise<LoaderResult> {
  const mod = 'pdfjs-dist/legacy/build/pdf.mjs';
  const pdfjs = (await import(/* webpackIgnore: true */ /* @vite-ignore */ mod)) as {
    getDocument: (opts: unknown) => { promise: Promise<{ numPages: number; getPage: (i: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> }> };
  };
  const doc = await pdfjs.getDocument({
    data: buffer,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as Array<unknown>)
      .map((it) => (it && typeof it === 'object' && 'str' in it ? (it as { str: string }).str : ''))
      .join(' ');
    parts.push(`[page ${i}]\n${text.trim()}`);
  }
  return {
    body: parts.join('\n\n'),
    metadata: {
      fetchedAt: new Date().toISOString(),
      contentType: 'application/pdf',
    },
  };
}

/** Loader DOCX — mammoth en dynamic import (webpackIgnore : voir loadPdf). */
export async function loadDocx(buffer: ArrayBuffer): Promise<LoaderResult> {
  const mod = 'mammoth';
  const mammoth = (await import(/* webpackIgnore: true */ /* @vite-ignore */ mod)) as {
    convertToMarkdown: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const { value } = await mammoth.convertToMarkdown({ buffer: Buffer.from(buffer) });
  return {
    body: value,
    metadata: {
      fetchedAt: new Date().toISOString(),
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  };
}

// ---------------------------------------------------------------------------
// CHA-092 — Cleaner HTML (drop nav/footer/script/style).
// ---------------------------------------------------------------------------

interface CleanedHtml {
  body: string;
  title?: string;
}

const STRIP_TAGS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'svg',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
];

export function cleanHtml(html: string): CleanedHtml {
  let cleaned = html;
  // Remove script/style/etc blocks entirely.
  for (const tag of STRIP_TAGS) {
    const re = new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi');
    cleaned = cleaned.replace(re, ' ');
  }
  // Capture <title>.
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(cleaned);
  const title = titleMatch ? collapseWs(stripTags(titleMatch[1] ?? '')) : undefined;
  // Strip remaining tags.
  cleaned = stripTags(cleaned);
  cleaned = decodeEntities(cleaned);
  cleaned = collapseWs(cleaned);
  return { body: cleaned, title };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
