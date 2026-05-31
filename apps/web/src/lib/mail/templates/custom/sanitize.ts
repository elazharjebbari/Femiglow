/**
 * Sanitize HTML rendu pour protéger contre XSS (M5.7.2).
 *
 * Handlebars escape déjà par défaut ({{var}} encode HTML). Les triples
 * braces {{{var}}} bypassent l'escape — on les sanitize ici pour
 * accepter du HTML safe (em, strong, br, a, table…) sans script/iframe.
 */
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'html', 'head', 'body', 'meta', 'title', 'style', 'link',
  'table', 'tr', 'td', 'tbody', 'thead', 'tfoot',
  'p', 'a', 'img', 'br', 'hr', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'i', 'b', 'u', 'small',
  'ul', 'ol', 'li',
  'center', 'blockquote', 'pre', 'code',
];

const ALLOWED_ATTRS = [
  'style', 'class', 'href', 'src', 'alt', 'title', 'width', 'height',
  'cellpadding', 'cellspacing', 'border', 'align', 'valign', 'bgcolor',
  'role', 'lang', 'content', 'name', 'charset', 'target', 'rel',
  'colspan', 'rowspan',
];

export function sanitizeEmailHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    WHOLE_DOCUMENT: true,
    USE_PROFILES: { html: true },
  });
}
