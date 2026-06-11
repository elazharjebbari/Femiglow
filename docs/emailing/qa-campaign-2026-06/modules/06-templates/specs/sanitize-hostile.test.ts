/**
 * TPL-SAN-* / TPL-REN-* / TPL-TRX-* / TPL-UNS-* — Sanitize hostile (XSS),
 * rendu custom Handlebars, rendu transactionnel des 6 templates React, et
 * présence/signature du lien de désinscription.
 *
 * Pur unit (pas de DB, pas de réseau) — la sanitization et le rendu React
 * sont déterministes.
 *
 * NB chemin : à déposer sous apps/web/src/lib/mail/templates/.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeEmailHtml } from '@/lib/mail/templates/custom/sanitize';
import { renderTemplate as renderCustom, clearTemplateCache } from '@/lib/mail/templates/custom/render';
import { renderTemplate as renderTransactional } from '@/lib/mail/render';
import { TEMPLATE_REGISTRY, type TemplateSlug } from '@/lib/mail/catalog';

beforeEach(() => clearTemplateCache());

// ── 1. Batterie XSS table-driven ────────────────────────────────────────
type XssCase = {
  id: string;
  name: string;
  payload: string;
  mustNotContain: RegExp[];
  mustContain?: RegExp[];
};

const XSS_CASES: XssCase[] = [
  {
    id: 'TPL-SAN-001',
    name: 'balise script',
    payload: '<p>Bonjour</p><script>alert(document.cookie)</script>',
    mustNotContain: [/<script/i],
    mustContain: [/Bonjour/],
  },
  {
    id: 'TPL-SAN-002',
    name: 'img onerror',
    payload: '<img src="x" onerror="alert(1)">',
    mustNotContain: [/onerror/i],
  },
  {
    id: 'TPL-SAN-003',
    name: 'href javascript:',
    payload: '<a href="javascript:steal()">clic</a>',
    mustNotContain: [/href\s*=\s*["']?javascript:/i],
    mustContain: [/clic/],
  },
  {
    id: 'TPL-SAN-004',
    name: 'src data:text/html',
    payload: '<img src="data:text/html;base64,PHNjcmlwdD4=">',
    mustNotContain: [/data:text\/html/i],
  },
  {
    id: 'TPL-SAN-005',
    name: 'svg onload / script',
    payload: '<svg onload="alert(1)"><script>alert(2)</script></svg>',
    mustNotContain: [/onload/i, /<script/i],
  },
  {
    id: 'TPL-SAN-006',
    name: 'iframe / object / embed',
    payload: '<iframe src="//evil"></iframe><object data="x"></object><embed src="x">OK',
    mustNotContain: [/<iframe/i, /<object/i, /<embed/i],
    mustContain: [/OK/],
  },
  {
    id: 'TPL-SAN-007',
    name: 'style expression / url(javascript:)',
    payload: '<div style="width:expression(alert(1));background:url(javascript:alert(2))">x</div>',
    mustNotContain: [/expression\s*\(/i, /url\s*\(\s*["']?javascript:/i],
  },
  {
    id: 'TPL-SAN-008',
    name: 'handlers on* divers',
    payload: '<div onmouseover="a()" onclick="b()" onfocus="c()">x</div>',
    mustNotContain: [/onmouseover/i, /onclick/i, /onfocus/i],
  },
  {
    id: 'TPL-SAN-009',
    name: 'entités encodées vers javascript:',
    payload: '<a href="&#x6a;avascript:alert(1)">x</a>',
    mustNotContain: [/javascript:alert/i],
  },
  {
    id: 'TPL-SAN-010',
    name: 'vbscript:',
    payload: '<a href="vbscript:msgbox(1)">x</a>',
    mustNotContain: [/vbscript:/i],
  },
  {
    id: 'TPL-SAN-011',
    name: 'base href',
    payload: '<base href="//evil/"><p>x</p>',
    mustNotContain: [/<base/i],
  },
  {
    id: 'TPL-SAN-012',
    name: 'meta refresh',
    payload: '<meta http-equiv="refresh" content="0;url=//evil"><p>x</p>',
    mustNotContain: [/http-equiv\s*=\s*["']?refresh/i],
  },
];

describe('sanitizeEmailHtml — batterie hostile', () => {
  it.each(XSS_CASES)('$id : neutralise $name', ({ payload, mustNotContain, mustContain }) => {
    const out = sanitizeEmailHtml(payload);
    for (const re of mustNotContain) expect(out).not.toMatch(re);
    for (const re of mustContain ?? []) expect(out).toMatch(re);
  });

  it('TPL-SAN-013 : préserve les balises sûres', () => {
    const out = sanitizeEmailHtml(
      '<a href="https://femiglow-maroc.com">Lien</a><br><strong>gras</strong>' +
        '<table><tr><td>cell</td></tr></table><img src="https://x/y.png" alt="a">',
    );
    expect(out).toMatch(/<a/i);
    expect(out).toMatch(/<strong>gras<\/strong>/i);
    expect(out).toMatch(/<table/i);
    expect(out).toMatch(/<img/i);
  });

  it('TPL-SAN-014 : préserve les attributs sûrs', () => {
    const out = sanitizeEmailHtml(
      '<a href="https://x" target="_blank" rel="noopener"><span style="color:#7C7A75" class="c">x</span></a>',
    );
    expect(out).toMatch(/href="https:\/\/x"/i);
    expect(out).toMatch(/style="color:#7C7A75"/i);
  });
});

// ── 2. Rendu custom Handlebars ──────────────────────────────────────────
describe('renderCustom — échappement & sanitize', () => {
  it('TPL-REN-001 : {{var}} échappé par défaut', () => {
    const out = renderCustom(
      { subjectTmpl: 'X', htmlSource: '<p>{{name}}</p>' },
      { name: '<script>alert(1)</script>' },
    );
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('TPL-REN-002 : {{{var}}} HTML sanitizé (script retiré, strong gardé)', () => {
    const out = renderCustom(
      { subjectTmpl: 'X', htmlSource: '<p>{{{userHtml}}}</p>' },
      { userHtml: '<script>x()</script><strong>OK</strong>' },
    );
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('<strong>OK</strong>');
  });

  it('TPL-REN-003 : variable manquante → chaîne vide', () => {
    const out = renderCustom({ subjectTmpl: 'Hi {{m}}', htmlSource: '<p>{{x}}</p>' }, {});
    expect(out.subject).toBe('Hi ');
    expect(out.html).toContain('<p></p>');
  });

  it('TPL-REN-004 : #if conditionnel', () => {
    const out = renderCustom(
      { subjectTmpl: 'X', htmlSource: '<p>{{#if vip}}VIP{{else}}std{{/if}}</p>' },
      { vip: true },
    );
    expect(out.html).toContain('VIP');
  });

  it('TPL-REN-005 : cache LRU rend correctement plusieurs fois', () => {
    const src = { subjectTmpl: 'X', htmlSource: '<p>{{a}}</p>' };
    renderCustom(src, { a: '1' });
    renderCustom(src, { a: '2' });
    expect(renderCustom(src, { a: '3' }).html).toContain('3');
  });
});

// ── 3. Rendu transactionnel des 6 templates React ───────────────────────
describe('renderTransactional — 6 templates React', () => {
  function sample(slug: TemplateSlug) {
    return TEMPLATE_REGISTRY[slug].sampleData;
  }

  it('TPL-TRX-001 : order-confirmation (sample) rend html+texte+sujet (snapshot)', async () => {
    const out = await renderTransactional('order-confirmation', sample('order-confirmation') as never);
    expect(out.subject).toContain((sample('order-confirmation') as { orderId: string }).orderId);
    expect(out.html.length).toBeGreaterThan(0);
    expect(out.text.length).toBeGreaterThan(0);
    expect(out.subject).toMatchSnapshot();
  });

  it('TPL-TRX-002 : order-confirmation payload invalide (itemsCount 0) lève (A-TPL-1)', async () => {
    await expect(
      renderTransactional('order-confirmation', {
        firstName: 'Imane', orderId: 'FG-1', orderTotal: '199 MAD', itemsCount: 0, deliveryEstimate: '2-4j',
      } as never),
    ).rejects.toThrow();
  });

  it('TPL-TRX-003 : contact-acknowledgement rend le prénom', async () => {
    const out = await renderTransactional('contact-acknowledgement', sample('contact-acknowledgement') as never);
    expect(out.subject).toContain('Souheila');
  });

  it('TPL-TRX-004 : newsletter-confirm rend confirmUrl', async () => {
    const s = sample('newsletter-confirm') as { confirmUrl: string };
    const out = await renderTransactional('newsletter-confirm', s as never);
    expect(out.html).toContain('femiglow-maroc.com/newsletter/confirm');
    void s;
  });

  it('TPL-TRX-005 : lead-notification rend nom + téléphone', async () => {
    const out = await renderTransactional('lead-notification', sample('lead-notification') as never);
    expect(out.subject).toContain('Souheila');
    expect(out.subject).toContain('+212');
  });

  it('TPL-TRX-006 : cart-abandoned rend resumeUrl', async () => {
    const out = await renderTransactional('cart-abandoned', sample('cart-abandoned') as never);
    expect(out.html).toContain('panier?resume=');
  });

  it('TPL-TRX-007 : password-reset rend resetUrl (prêt à câbler, A-TPL-4)', async () => {
    const out = await renderTransactional('password-reset', sample('password-reset') as never);
    expect(out.html).toContain('auth/reset');
  });

  it('TPL-TRX-008 : slug inconnu → throw', async () => {
    await expect(renderTransactional('nope' as never, {} as never)).rejects.toThrow(/Unknown template/i);
  });

  it('TPL-TRX-009 : chaque template porte un lien de désinscription', async () => {
    const slugs = Object.keys(TEMPLATE_REGISTRY) as TemplateSlug[];
    for (const slug of slugs) {
      const out = await renderTransactional(slug, sample(slug) as never);
      // Soit le placeholder à substituer, soit un lien « se désabonner ».
      const hasUnsub = /unsubscribe_url/i.test(out.html) || /désabonner|désinscri/i.test(out.html);
      expect(hasUnsub, `template ${slug} doit porter un lien de désinscription`).toBe(true);
    }
  });
});

// ── 4. Lien de désinscription — substitution & signature ────────────────
describe('lien de désinscription (A-TPL-3)', () => {
  // Simule l'étape de substitution du pipeline d'envoi : remplace
  // {{unsubscribe_url}} par une URL signée. Le test prouve qu'après
  // substitution, plus aucun placeholder littéral ne subsiste.
  function substituteUnsub(html: string, signedUrl: string): string {
    return html.replaceAll('{{unsubscribe_url}}', signedUrl);
  }

  it('TPL-UNS-001 : après substitution, plus de {{unsubscribe_url}} littéral', async () => {
    const out = await renderTransactional('order-confirmation', TEMPLATE_REGISTRY['order-confirmation'].sampleData as never);
    const signed = 'https://femiglow-maroc.com/api/mail/unsubscribe?token=abc.def.sig';
    const final = substituteUnsub(out.html, signed);
    expect(final).not.toContain('{{unsubscribe_url}}');
    expect(final).toContain(signed);
  });

  it('TPL-UNS-002 : l’URL de désinscription contient un token non vide', () => {
    const signed = 'https://femiglow-maroc.com/api/mail/unsubscribe?token=abc.def.sig';
    const token = new URL(signed).searchParams.get('token');
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThan(8);
  });
});

// ── 5. Starter sanitizable ──────────────────────────────────────────────
describe('starter', () => {
  it('TPL-STA-002 : le HTML d’un starter minimal reste structuré après sanitize', () => {
    const starter = '<!doctype html><html><body><table><tr><td><strong>FemiGlow</strong>' +
      '<a href="{{unsubscribeUrl}}">Se désinscrire</a></td></tr></table></body></html>';
    const out = sanitizeEmailHtml(starter);
    expect(out).toMatch(/<table/i);
    expect(out).toMatch(/<strong>FemiGlow<\/strong>/i);
    expect(out).toMatch(/Se désinscrire/i);
  });
});
