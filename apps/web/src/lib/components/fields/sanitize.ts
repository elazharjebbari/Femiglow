/**
 * Rich-text sanitization (Components-CMS).
 *
 * v1 — Implémentation regex/state-machine, **server-only** côté usage. On
 * privilégie une dépendance zéro pour ne pas alourdir le bundle ; la signature
 * publique est néanmoins stable de sorte qu'on puisse remplacer l'implémentation
 * par `sanitize-html` (cf. docs/components-cms/backend/02-zod-validation.md)
 * en une seule passe ultérieure.
 *
 * Cf. docs/components-cms/architecture/06-rbac-audit.md (XSS via rich-text).
 *
 * NOTE — Cette implémentation est suffisante pour notre périmètre (allowlist
 * stricte de balises, aucun attribut sauf `href` sur `<a>`). Pour un usage
 * production plus large, swap pour `sanitize-html` :
 *   pnpm add sanitize-html @types/sanitize-html
 *   import sanitizeHtml from 'sanitize-html';
 *   return sanitizeHtml(input, RICH_TEXT_SANITIZE_OPTIONS);
 */
import { decodeValue as decodeFieldValue } from './encoding';

export interface SanitizeOptions {
  allowedTags?: string[];
  allowedHrefSchemes?: ('http' | 'https' | 'mailto' | 'tel')[];
  allowedHosts?: string[];
}

export const DEFAULT_ALLOWED_TAGS = [
  'h2',
  'h3',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'a',
  'blockquote',
  'br',
] as const;

export const DEFAULT_ALLOWED_SCHEMES: SanitizeOptions['allowedHrefSchemes'] = [
  'https',
  'mailto',
  'tel',
];

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function _markEncodingUsed(): void {
  // Force le bundler à conserver l'import canonique de l'encoding ; pratique
  // pour valider qu'on n'introduit pas de dépendance circulaire si on étend.
  void decodeFieldValue;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

/**
 * Décode les entités HTML (numérique et nommées courantes) afin que les
 * tentatives d'injection encodées (`&#x3C;script&#x3E;`) soient ramenées en
 * texte avant le passage du sanitizer.
 */
function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, ent: string) => {
    if (ent.startsWith('#x') || ent.startsWith('#X')) {
      const code = parseInt(ent.slice(2), 16);
      if (!Number.isFinite(code) || code < 0) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    if (ent.startsWith('#')) {
      const code = parseInt(ent.slice(1), 10);
      if (!Number.isFinite(code) || code < 0) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[ent.toLowerCase()];
    return named ?? match;
  });
}

function escapeHtmlText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isAllowedHref(
  href: string,
  schemes: NonNullable<SanitizeOptions['allowedHrefSchemes']>,
  allowedHosts: string[],
): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  // Refuse explicitement les URL protocol-relative (`//evil.com`) — elles
  // commencent par '/' mais résolvent vers un host externe au runtime.
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('mailto:')) {
    return schemes.includes('mailto') && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }
  if (trimmed.startsWith('tel:')) {
    return schemes.includes('tel') && /^tel:\+?[0-9 ()-]{6,}$/.test(trimmed);
  }
  try {
    const url = new URL(trimmed);
    const protocol = url.protocol.replace(':', '');
    if (!schemes.includes(protocol as 'http' | 'https' | 'mailto' | 'tel')) return false;
    if (protocol === 'http' || protocol === 'https') {
      return allowedHosts.includes(url.host);
    }
    return false;
  } catch {
    return false;
  }
}

const TAG_RE =
  /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(\/?)\s*>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`<>]+))/g;

interface SanitizerState {
  allowedTags: Set<string>;
  schemes: NonNullable<SanitizeOptions['allowedHrefSchemes']>;
  allowedHosts: string[];
}

function extractAttribute(rawAttrs: string, name: string): string | null {
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(rawAttrs)) !== null) {
    if (m[1]?.toLowerCase() === name) {
      return m[3] ?? m[4] ?? m[5] ?? '';
    }
  }
  return null;
}

function renderTag(
  isClosing: boolean,
  tagName: string,
  rawAttrs: string,
  selfClosing: boolean,
  state: SanitizerState,
): string {
  const tag = tagName.toLowerCase();
  if (!state.allowedTags.has(tag)) return '';

  if (isClosing) return `</${tag}>`;

  // Gestion spéciale de `<a>` : seul attribut autorisé = `href` valide.
  if (tag === 'a') {
    const rawHref = extractAttribute(rawAttrs, 'href');
    if (rawHref == null) return '<a>';
    const decodedHref = decodeEntities(rawHref);
    if (!isAllowedHref(decodedHref, state.schemes, state.allowedHosts)) {
      return '<a>';
    }
    return `<a href="${escapeHtmlText(decodedHref)}" rel="noopener noreferrer">`;
  }

  // `<br>` self-closing autorisé sans attribut.
  if (tag === 'br') return '<br />';

  // Pour toutes les autres balises autorisées : tag nu, sans aucun attribut.
  if (selfClosing) return `<${tag} />`;
  return `<${tag}>`;
}

/**
 * Strippe les balises et attributs non autorisés. Conserve la sémantique
 * éditoriale (h2/h3/p/list/strong/em/a/blockquote/br) tout en éliminant
 * vecteurs XSS classiques (script, iframe, style, on*).
 */
export function sanitizeRichText(input: string, options: SanitizeOptions = {}): string {
  if (typeof input !== 'string' || input.length === 0) return '';

  const state: SanitizerState = {
    allowedTags: new Set(
      (options.allowedTags ?? [...DEFAULT_ALLOWED_TAGS]).map((t) => t.toLowerCase()),
    ),
    schemes: options.allowedHrefSchemes ?? DEFAULT_ALLOWED_SCHEMES!,
    allowedHosts: options.allowedHosts ?? [],
  };

  // 1) Décoder les entités pour exposer toute tentative `&#x3C;script…`
  //    Ce passage convertit `&#x3C;script&#x3E;` en `<script>` pour qu'on le
  //    voie et qu'on le strippe dans la passe suivante.
  let decoded = decodeEntities(input);

  // 2) Pré-stripper les blocs dangereux dont le contenu doit aussi disparaître
  //    (entre balises ouvrantes/fermantes), avant la passe générale.
  decoded = decoded
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '')
    .replace(/<\s*noscript\b[^>]*>[\s\S]*?<\s*\/\s*noscript\s*>/gi, '');

  // 3) Tag scanner avec allowlist.
  TAG_RE.lastIndex = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(decoded)) !== null) {
    const [full, slash, tagName, rawAttrs, selfClose] = match;
    const start = match.index;
    // Texte intermédiaire — re-encode pour neutraliser le contenu textuel.
    if (start > lastIndex) {
      result += escapeHtmlText(decoded.slice(lastIndex, start));
    }
    result += renderTag(
      slash === '/',
      tagName ?? '',
      rawAttrs ?? '',
      selfClose === '/',
      state,
    );
    lastIndex = start + full.length;
  }
  if (lastIndex < decoded.length) {
    result += escapeHtmlText(decoded.slice(lastIndex));
  }

  return result;
}
