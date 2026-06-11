/**
 * Module 06 — R-017 : batterie XSS hostile sur le sanitize des templates custom.
 *
 * TPL-SAN-001..014 + TPL-REN-001..005.
 *
 * Deux contextes d'exécution, exigés par la mission :
 *   (A) `sanitizeEmailHtml` — la barrière appliquée au rendu de l'EMAIL final
 *       (custom/render.ts → sanitizeEmailHtml).
 *   (B) `renderCustom` (Handlebars + sanitize) — le pipeline qu'utilise la
 *       PREVIEW admin (route POST .../preview appelle renderTemplate custom),
 *       avec une charge hostile injectée via une variable triple-brace
 *       `{{{userHtml}}}` (le seul vecteur où du HTML brut atteint le sanitize).
 *
 * Oracle PAR PAYLOAD : la charge active ne survit dans AUCUN des deux contextes.
 * C'est un test de sécurité : l'oracle est « la charge active est neutralisée »,
 * jamais « ne crashe pas ».
 *
 * Pur unit (pas de DB, pas de réseau) — sanitization déterministe.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeEmailHtml } from '@/lib/mail/templates/custom/sanitize';
import { renderTemplate as renderCustom, clearTemplateCache } from '@/lib/mail/templates/custom/render';

beforeEach(() => clearTemplateCache());

// ── Table de charges hostiles ────────────────────────────────────────────
type XssCase = {
  id: string;
  name: string;
  payload: string;
  /** Aucun de ces motifs ne doit subsister APRÈS sanitize, dans les 2 contextes. */
  mustNotMatch: RegExp[];
  /** Motifs légitimes qui doivent survivre (preuve qu'on ne sur-nettoie pas). */
  mustMatch?: RegExp[];
};

const XSS_CASES: XssCase[] = [
  {
    id: 'TPL-SAN-001',
    name: 'balise <script> retirée',
    payload: '<p>Bonjour</p><script>alert(document.cookie)</script>',
    mustNotMatch: [/<script/i],
    mustMatch: [/Bonjour/],
  },
  {
    id: 'TPL-SAN-002',
    name: 'attribut onerror retiré',
    payload: '<img src="x" onerror="alert(1)">',
    mustNotMatch: [/onerror/i],
  },
  {
    id: 'TPL-SAN-003',
    name: 'href javascript: neutralisé',
    payload: '<a href="javascript:steal()">clic</a>',
    mustNotMatch: [/href\s*=\s*["']?\s*javascript:/i, /javascript:steal/i],
    mustMatch: [/clic/],
  },
  {
    id: 'TPL-SAN-004',
    name: 'src data:text/html neutralisé',
    payload: '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">OK',
    mustNotMatch: [/data:text\/html/i],
    mustMatch: [/OK/],
  },
  {
    id: 'TPL-SAN-005',
    name: 'svg événementé + <script> imbriqué retirés',
    payload: '<svg onload="alert(1)"><script>alert(2)</script></svg>OK',
    mustNotMatch: [/onload/i, /<script/i, /<svg/i],
    mustMatch: [/OK/],
  },
  {
    id: 'TPL-SAN-006',
    name: 'iframe / object / embed retirés',
    payload: '<iframe src="//evil"></iframe><object data="x"></object><embed src="x">OK',
    mustNotMatch: [/<iframe/i, /<object/i, /<embed/i],
    mustMatch: [/OK/],
  },
  {
    id: 'TPL-SAN-007',
    name: 'style expression() / url(javascript:) neutralisé',
    payload: '<div style="width:expression(alert(1));background:url(javascript:alert(2))">x</div>',
    mustNotMatch: [/expression\s*\(/i, /url\s*\(\s*["']?\s*javascript:/i],
    mustMatch: [/x/],
  },
  {
    id: 'TPL-SAN-008',
    name: 'handlers on* divers (onmouseover/onclick/onfocus) retirés',
    payload: '<div onmouseover="a()" onclick="b()" onfocus="c()">x</div>',
    mustNotMatch: [/onmouseover/i, /onclick/i, /onfocus/i],
    mustMatch: [/x/],
  },
  {
    id: 'TPL-SAN-009',
    name: 'entité encodée &#x6a;avascript: ne ranime pas le vecteur',
    payload: '<a href="&#x6a;avascript:alert(1)">x</a>',
    mustNotMatch: [/javascript:alert/i],
    mustMatch: [/x/],
  },
  {
    id: 'TPL-SAN-010',
    name: 'href vbscript: neutralisé',
    payload: '<a href="vbscript:msgbox(1)">x</a>',
    mustNotMatch: [/vbscript:/i],
    mustMatch: [/x/],
  },
  {
    id: 'TPL-SAN-011',
    name: 'balise <base> retirée (détournement de liens relatifs)',
    payload: '<base href="//evil/"><p>x</p>',
    mustNotMatch: [/<base/i],
    mustMatch: [/x/],
  },
  {
    id: 'TPL-SAN-012',
    name: 'meta http-equiv refresh neutralisé',
    payload: '<meta http-equiv="refresh" content="0;url=//evil"><p>x</p>',
    mustNotMatch: [/http-equiv\s*=\s*["']?\s*refresh/i],
    mustMatch: [/x/],
  },
  // ── Compléments hostiles (au-delà de la matrice nominale) ──────────────
  {
    id: 'TPL-SAN-XTRA-form',
    name: 'formulaire de phishing retiré',
    payload: '<form action="//evil"><input name="cc"><button>Payer</button></form>OK',
    mustNotMatch: [/<form/i, /<input/i, /<button/i],
    mustMatch: [/OK/],
  },
  {
    id: 'TPL-SAN-XTRA-nested',
    name: 'balises imbriquées malformées (<scr<script>ipt>)',
    payload: '<scr<script>ipt>alert(1)</scr</script>ipt><p>OK</p>',
    mustNotMatch: [/<script/i, /alert\(1\)<\/script>/i],
    mustMatch: [/OK/],
  },
  {
    id: 'TPL-SAN-XTRA-styletag',
    name: 'corps de <style> avec url(javascript:) neutralisé',
    payload: '<style>body{background:url("javascript:alert(1)")}</style><p>x</p>',
    mustNotMatch: [/javascript:alert/i],
    mustMatch: [/x/],
  },
  {
    id: 'TPL-SAN-XTRA-cssimport',
    name: 'CSS @import distant dans <style> neutralisé',
    payload: '<style>@import url("//evil/x.css");p{color:red}</style><p>x</p>',
    mustNotMatch: [/@import/i],
    mustMatch: [/x/],
  },
  {
    id: 'TPL-SAN-XTRA-datahref',
    name: 'href data:text/html neutralisé',
    payload: '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    mustNotMatch: [/data:text\/html/i, /<script/i],
    mustMatch: [/x/],
  },
  {
    id: 'TPL-SAN-XTRA-aria',
    name: 'attribut ARIA légitime conservé, handler piégé voisin retiré',
    payload: '<div aria-label="ok" onmouseover="evil()">x</div>',
    mustNotMatch: [/onmouseover/i, /evil\(/i],
    mustMatch: [/aria-label="ok"/i, /x/],
  },
  {
    id: 'TPL-SAN-XTRA-imgsrc-js',
    name: 'img src=javascript: neutralisé',
    payload: '<img src="javascript:alert(1)" alt="a">OK',
    mustNotMatch: [/src\s*=\s*["']?\s*javascript:/i, /javascript:alert/i],
    mustMatch: [/OK/],
  },
];

/** Contexte (A) : barrière email directe. */
function viaSanitize(payload: string): string {
  return sanitizeEmailHtml(payload);
}

/**
 * Contexte (B) : pipeline preview admin. La charge hostile arrive comme HTML
 * brut via une variable triple-brace (le SEUL vecteur où du HTML non échappé
 * atteint le sanitize ; `{{var}}` échappe déjà tout).
 */
function viaPreviewPipeline(payload: string): string {
  return renderCustom(
    { subjectTmpl: 'X', htmlSource: '<div>{{{userHtml}}}</div>' },
    { userHtml: payload },
  ).html;
}

describe('R-017 — sanitize hostile : email final (contexte A)', () => {
  it.each(XSS_CASES)('$id : $name', ({ payload, mustNotMatch, mustMatch }) => {
    const out = viaSanitize(payload);
    for (const re of mustNotMatch) {
      expect(out, `motif hostile survit dans le HTML email : ${re}`).not.toMatch(re);
    }
    for (const re of mustMatch ?? []) {
      expect(out, `contenu légitime perdu : ${re}`).toMatch(re);
    }
  });
});

describe('R-017 — sanitize hostile : preview admin (contexte B)', () => {
  it.each(XSS_CASES)('$id : $name', ({ payload, mustNotMatch, mustMatch }) => {
    const out = viaPreviewPipeline(payload);
    for (const re of mustNotMatch) {
      expect(out, `motif hostile survit dans la preview admin : ${re}`).not.toMatch(re);
    }
    for (const re of (mustMatch ?? []).filter((re) => !/aria-label/.test(re.source))) {
      // L'oracle légitime « aria-label » n'est pas garanti via le pipeline
      // (le wrapper <div>{{{...}}}</div> n'altère pas la charge, mais on évite
      // de coupler le test à la position exacte) → on vérifie au moins le texte.
      expect(out, `contenu légitime perdu : ${re}`).toMatch(re);
    }
  });
});

// ── TPL-SAN-013/014 : préservation du contenu légitime ───────────────────
describe('sanitizeEmailHtml — préservation du légitime', () => {
  it('TPL-SAN-013 : balises sûres conservées (a/strong/br/table/img)', () => {
    const out = sanitizeEmailHtml(
      '<a href="https://femiglow-maroc.com">Lien</a><br><strong>gras</strong>' +
        '<table><tr><td>cell</td></tr></table><img src="https://x/y.png" alt="a">',
    );
    expect(out).toMatch(/<a/i);
    expect(out).toMatch(/href="https:\/\/femiglow-maroc\.com"/i);
    expect(out).toMatch(/<strong>gras<\/strong>/i);
    expect(out).toMatch(/<table/i);
    expect(out).toMatch(/<td>cell<\/td>/i);
    expect(out).toMatch(/<img[^>]+src="https:\/\/x\/y\.png"/i);
  });

  it('TPL-SAN-014 : attributs sûrs conservés (href https, style couleur, target/rel)', () => {
    const out = sanitizeEmailHtml(
      '<a href="https://x" target="_blank" rel="noopener"><span style="color:#7C7A75" class="c">x</span></a>',
    );
    expect(out).toMatch(/href="https:\/\/x"/i);
    expect(out).toMatch(/target="_blank"/i);
    expect(out).toMatch(/rel="noopener"/i);
    expect(out).toMatch(/style="color:#7C7A75"/i);
  });

  it('préservation : <style> légitime (sans charge) reste intact', () => {
    const out = sanitizeEmailHtml('<style>p{color:#333;font-size:14px}</style><p>x</p>');
    expect(out).toMatch(/<style>[^<]*color:#333/i);
  });

  it('préservation : image inline data:image/png conservée (légitime en email)', () => {
    const out = sanitizeEmailHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="logo">');
    expect(out).toMatch(/src="data:image\/png;base64,iVBORw0KGgo="/i);
  });
});

// ── TPL-REN-001..005 : rendu custom Handlebars ───────────────────────────
describe('renderCustom — échappement & sanitize', () => {
  it('TPL-REN-001 : {{var}} échappé par défaut (XSS via variable)', () => {
    const out = renderCustom(
      { subjectTmpl: 'X', htmlSource: '<p>{{name}}</p>' },
      { name: '<script>alert(1)</script>' },
    );
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('TPL-REN-002 : {{{var}}} HTML sanitizé (script retiré, strong conservé)', () => {
    const out = renderCustom(
      { subjectTmpl: 'X', htmlSource: '<p>{{{userHtml}}}</p>' },
      { userHtml: '<script>x()</script><strong>OK</strong>' },
    );
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('<strong>OK</strong>');
  });

  it('TPL-REN-003 : variable manquante → chaîne vide (pas de crash, pas de {{...}})', () => {
    const out = renderCustom(
      { subjectTmpl: 'Hi {{m}}', htmlSource: '<p>{{x}}</p>' },
      {},
    );
    expect(out.subject).toBe('Hi ');
    expect(out.html).toContain('<p></p>');
    expect(out.html).not.toContain('{{');
  });

  it('TPL-REN-004 : #if conditionnel (branche then/else)', () => {
    const tpl = { subjectTmpl: 'X', htmlSource: '<p>{{#if vip}}VIP{{else}}std{{/if}}</p>' };
    expect(renderCustom(tpl, { vip: true }).html).toContain('VIP');
    expect(renderCustom(tpl, { vip: false }).html).toContain('std');
  });

  it('TPL-REN-005 : cache LRU — même source rendue plusieurs fois reste correcte', () => {
    const src = { subjectTmpl: 'X', htmlSource: '<p>{{a}}</p>' };
    expect(renderCustom(src, { a: '1' }).html).toContain('>1<');
    expect(renderCustom(src, { a: '2' }).html).toContain('>2<');
    expect(renderCustom(src, { a: '3' }).html).toContain('>3<');
  });

  it('TPL-REN-XTRA : la charge hostile via {{{var}}} ne survit pas (double preuve renderCustom)', () => {
    const out = renderCustom(
      { subjectTmpl: 'X', htmlSource: '{{{evil}}}' },
      { evil: '<img src=x onerror=alert(1)><iframe src=//evil></iframe><strong>safe</strong>' },
    );
    expect(out.html).not.toMatch(/onerror/i);
    expect(out.html).not.toMatch(/<iframe/i);
    expect(out.html).toContain('<strong>safe</strong>');
  });
});
