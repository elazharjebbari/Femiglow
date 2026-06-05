/**
 * Sanitize HTML rendu pour protéger contre XSS (M5.7.2).
 *
 * Handlebars escape déjà par défaut ({{var}} encode HTML). Les triples
 * braces {{{var}}} bypassent l'escape — on les sanitize ici pour
 * accepter du HTML safe (em, strong, br, a, table…) sans script/iframe.
 *
 * Durcissement R-017 (QA campaign 2026-06) :
 *  - whitelist STRICTE de tags : on n'active PAS `USE_PROFILES`, qui
 *    réintroduisait `form`/`input`/`details`/`svg`/`math` (phishing /
 *    interactivité) en court-circuitant `ALLOWED_TAGS`.
 *  - on FORBID explicitement les tags interactifs/formulaires (défense
 *    en profondeur, même si déjà hors whitelist).
 *  - CSS hostile : DOMPurify ne nettoie PAS le contenu CSS d'un attribut
 *    `style` ni le corps d'une balise `<style>`. On scrube manuellement
 *    `expression()`, `url(javascript:|vbscript:|data:)`, `@import`,
 *    `behavior:`, `-moz-binding` — vecteurs d'exécution / exfiltration.
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

/**
 * Tags interactifs / de formulaire à bannir explicitement. Hors whitelist
 * de toute façon, mais on les FORBID pour rester robuste si la whitelist
 * évolue, et pour neutraliser les profils HTML par défaut de DOMPurify.
 */
const FORBID_TAGS = [
  'form', 'input', 'button', 'select', 'textarea', 'option', 'optgroup',
  'fieldset', 'legend', 'label', 'output', 'datalist', 'keygen',
  'details', 'summary', 'dialog', 'menu', 'menuitem',
  'svg', 'math', 'iframe', 'frame', 'frameset', 'object', 'embed',
  'applet', 'audio', 'video', 'source', 'track', 'canvas', 'portal',
  'base', 'noscript', 'template', 'slot',
];

/**
 * Patterns CSS dangereux dans un attribut `style` ou un bloc `<style>`.
 * `expression(` = IE legacy ; `url(javascript:|vbscript:|data:)` = exécution
 * ou exfiltration ; `@import` = chargement distant ; `behavior` / `-moz-binding`
 * = bindings exécutables.
 */
const DANGEROUS_CSS = /expression\s*\(|url\s*\(\s*['"]?\s*(?:javascript|vbscript|data)\s*:|@import|behavior\s*:|-moz-binding/i;

let hooksInstalled = false;

function installHooks(): void {
  if (hooksInstalled) return;
  // Scrub d'un attribut style hostile (CSS-in-attribute) + URI data: non-image.
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style' && DANGEROUS_CSS.test(data.attrValue)) {
      data.attrValue = '';
    }
    // `data:` n'est légitime que pour des images inline (data:image/...).
    // Tout `data:text/html`, `data:application/...`, etc. sur href/src est un
    // vecteur XSS / phishing → on neutralise.
    if (
      (data.attrName === 'href' || data.attrName === 'src') &&
      /^\s*data:/i.test(data.attrValue) &&
      !/^\s*data:image\//i.test(data.attrValue)
    ) {
      data.attrValue = '';
      data.keepAttr = false;
    }
  });
  // Scrub du corps d'une balise <style> (CSS-in-tag).
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'style') {
      const css = (node as unknown as { textContent?: string | null }).textContent ?? '';
      if (DANGEROUS_CSS.test(css)) {
        (node as unknown as { textContent: string }).textContent = '';
      }
    }
  });
  hooksInstalled = true;
}

export function sanitizeEmailHtml(raw: string): string {
  installHooks();
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    WHOLE_DOCUMENT: true,
    FORBID_TAGS,
  });
}
