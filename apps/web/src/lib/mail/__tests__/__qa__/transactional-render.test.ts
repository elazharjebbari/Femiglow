/**
 * Module 06 — Rendu transactionnel des 6 templates React + lien de
 * désinscription + starter sanitizable.
 *
 * TPL-TRX-001..009, TPL-UNS-001..003, TPL-STA-002.
 *
 * Pur unit : rendu React déterministe, sanitize déterministe. Pas de DB.
 * L'oracle A-TPL-1 (payload invalide => throw, jamais de silence) est central :
 * le pipeline d'envoi (module 08) transforme ce throw en ligne outbox `failed`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderTemplate } from '@/lib/mail/render';
import { TEMPLATE_REGISTRY, type TemplateSlug } from '@/lib/mail/catalog';
import { sanitizeEmailHtml } from '@/lib/mail/templates/custom/sanitize';

/**
 * `@/lib/env` parse `process.env` UNE SEULE FOIS à l'import → on positionne le
 * secret AVANT tout import dynamique de `unsub-token`, et on `resetModules` pour
 * forcer une ré-évaluation de la chaîne env→unsub-token dans les tests UNS.
 */
const ENV_KEY = 'MAIL_UNSUB_TOKEN_SECRET';
const ORIGINAL_UNSUB_SECRET = process.env[ENV_KEY];
beforeAll(() => {
  process.env[ENV_KEY] = 'z'.repeat(40);
});
afterAll(() => {
  if (ORIGINAL_UNSUB_SECRET === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = ORIGINAL_UNSUB_SECRET;
  vi.resetModules();
});

/** Détecte un VRAI gestionnaire d'évènement inline (évite le faux positif `content=`). */
const EVENT_HANDLER_RE = /\son(?:error|load|click|mouseover|mouseout|focus|blur|toggle|submit|change|input|keydown|keyup|keypress|abort|unload|resize|scroll)\s*=/i;

function sample<S extends TemplateSlug>(slug: S): (typeof TEMPLATE_REGISTRY)[S]['sampleData'] {
  return TEMPLATE_REGISTRY[slug].sampleData;
}

const ALL_SLUGS = Object.keys(TEMPLATE_REGISTRY) as TemplateSlug[];

describe('renderTemplate transactionnel — 6 templates React', () => {
  // TPL-TRX-001
  it('TPL-TRX-001 : order-confirmation rend html + texte + sujet (sujet porte orderId)', async () => {
    const s = sample('order-confirmation');
    const out = await renderTemplate('order-confirmation', s as never);
    expect(out.subject).toContain(s.orderId);
    expect(out.html.length).toBeGreaterThan(0);
    expect(out.text.length).toBeGreaterThan(0);
    // Le texte alternatif n'est pas juste le HTML brut.
    expect(out.text).not.toContain('<html');
    expect(out.subject).toMatchSnapshot();
  });

  // TPL-TRX-002 — A-TPL-1 : payload invalide => throw traçable
  it('TPL-TRX-002 : order-confirmation itemsCount 0 (Zod positive) lève (A-TPL-1)', async () => {
    await expect(
      renderTemplate('order-confirmation', {
        firstName: 'Imane',
        orderId: 'FG-1',
        orderTotal: '199 MAD',
        itemsCount: 0,
        deliveryEstimate: '2-4j',
      } as never),
    ).rejects.toThrow();
  });

  it('TPL-TRX-002b : champ requis absent => throw (jamais d’email silencieux)', async () => {
    await expect(
      // orderId manquant
      renderTemplate('order-confirmation', {
        firstName: 'Imane',
        orderTotal: '199 MAD',
        itemsCount: 2,
        deliveryEstimate: '2-4j',
      } as never),
    ).rejects.toThrow();
  });

  // TPL-TRX-003
  it('TPL-TRX-003 : contact-acknowledgement porte le prénom dans le sujet', async () => {
    const out = await renderTemplate('contact-acknowledgement', sample('contact-acknowledgement') as never);
    expect(out.subject).toContain('Souheila');
    expect(out.html.length).toBeGreaterThan(0);
  });

  // TPL-TRX-004
  it('TPL-TRX-004 : newsletter-confirm rend l’URL de confirmation', async () => {
    const out = await renderTemplate('newsletter-confirm', sample('newsletter-confirm') as never);
    expect(out.html).toContain('femiglow-maroc.com/newsletter/confirm');
  });

  // TPL-TRX-005
  it('TPL-TRX-005 : lead-notification porte nom + téléphone dans le sujet', async () => {
    const out = await renderTemplate('lead-notification', sample('lead-notification') as never);
    expect(out.subject).toContain('Souheila');
    expect(out.subject).toContain('+212');
  });

  // TPL-TRX-006
  it('TPL-TRX-006 : cart-abandoned rend l’URL de reprise', async () => {
    const out = await renderTemplate('cart-abandoned', sample('cart-abandoned') as never);
    expect(out.html).toContain('panier?resume=');
  });

  // TPL-TRX-007 — A-TPL-4 : password-reset prêt à câbler (aucun call-site live)
  it('TPL-TRX-007 : password-reset rend resetUrl (prêt à câbler, A-TPL-4 / F-097)', async () => {
    const out = await renderTemplate('password-reset', sample('password-reset') as never);
    expect(out.html).toContain('auth/reset');
    expect(out.html).toContain('token=');
  });

  // TPL-TRX-008
  it('TPL-TRX-008 : slug inconnu → throw /Unknown template/', async () => {
    await expect(renderTemplate('nope' as never, {} as never)).rejects.toThrow(/Unknown template/i);
  });

  // TPL-TRX-009 — chaque template porte le lien de désinscription
  it.each(ALL_SLUGS)(
    'TPL-TRX-009 : %s porte un lien de désinscription (placeholder ou « se désabonner »)',
    async (slug) => {
      const out = await renderTemplate(slug, sample(slug) as never);
      const hasPlaceholder = /unsubscribe_url/i.test(out.html);
      const hasWord = /désabonner|désinscri/i.test(out.html);
      expect(
        hasPlaceholder || hasWord,
        `template ${slug} doit porter un lien de désinscription`,
      ).toBe(true);
    },
  );
});

// ── Lien de désinscription — substitution & signature (A-TPL-3) ───────────
describe('lien de désinscription (A-TPL-3)', () => {
  /**
   * Simule l'étape de substitution du pipeline d'envoi : remplace le
   * placeholder littéral `{{unsubscribe_url}}` (présent dans le footer React)
   * par une URL signée. L'oracle prouve qu'après substitution AUCUN placeholder
   * littéral ne fuit dans l'email final.
   */
  function substituteUnsub(html: string, signedUrl: string): string {
    return html.replaceAll('{{unsubscribe_url}}', signedUrl);
  }

  it('TPL-UNS-000 : le footer rend le placeholder littéral AVANT substitution', async () => {
    const out = await renderTemplate('order-confirmation', sample('order-confirmation') as never);
    // C'est le placeholder que le pipeline doit substituer. S'il disparaissait
    // côté React, le test de substitution serait un faux positif.
    expect(out.html).toContain('{{unsubscribe_url}}');
  });

  it('TPL-UNS-001 : après substitution, plus de {{unsubscribe_url}} littéral (A-TPL-3)', async () => {
    const out = await renderTemplate('order-confirmation', sample('order-confirmation') as never);
    const signed = 'https://femiglow-maroc.com/api/mail/unsubscribe?t=abc.def';
    const final = substituteUnsub(out.html, signed);
    expect(final).not.toContain('{{unsubscribe_url}}');
    expect(final).toContain(signed);
  });

  it('TPL-UNS-001b : substitution couvre TOUS les templates (aucun placeholder résiduel)', async () => {
    const signed = 'https://femiglow-maroc.com/api/mail/unsubscribe?t=tok';
    for (const slug of ALL_SLUGS) {
      const out = await renderTemplate(slug, sample(slug) as never);
      const final = substituteUnsub(out.html, signed);
      expect(final, `placeholder résiduel dans ${slug}`).not.toContain('{{unsubscribe_url}}');
    }
  });

  it('TPL-UNS-002 : l’URL de désinscription signée porte un token non vide', async () => {
    vi.resetModules();
    const mod = await import('@/lib/mail/unsub-token');
    const url = mod.unsubscribeUrl('cliente@example.com', 'https://femiglow-maroc.com');
    const token = new URL(url).searchParams.get('t');
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThan(8);
    // Le token est vérifiable (signature valide) → preuve qu'il est SIGNÉ,
    // pas un simple placeholder.
    expect(mod.verifyUnsubToken(token!)).toBe('cliente@example.com');
  });

  it('TPL-UNS-003 : un token signé est rejeté si altéré (intégrité du lien)', async () => {
    vi.resetModules();
    const mod = await import('@/lib/mail/unsub-token');
    const token = mod.generateUnsubToken('cliente@example.com');
    const [sig, payload] = token.split('.') as [string, string];
    const tampered = `${sig.slice(0, -2)}AA.${payload}`;
    expect(mod.verifyUnsubToken(tampered)).toBeNull();
  });
});

// ── Starter sanitizable (TPL-STA-002) ────────────────────────────────────
describe('starter HTML', () => {
  it('TPL-STA-002 : default-femiglow.html reste structuré après sanitize (pas de charge perdue)', () => {
    const starterPath = path.join(
      process.cwd(),
      'src',
      'lib',
      'mail',
      'templates',
      'starters',
      'default-femiglow.html',
    );
    const raw = readFileSync(starterPath, 'utf8');
    const out = sanitizeEmailHtml(raw);
    // Structure email préservée.
    expect(out).toMatch(/<table/i);
    expect(out).toMatch(/FemiGlow/i);
    // Le starter ne doit contenir aucune charge active (c'est un gabarit officiel).
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(EVENT_HANDLER_RE);
  });

  it('TPL-STA-002b : starter minimal inline reste structuré après sanitize', () => {
    const starter =
      '<!doctype html><html><body><table><tr><td><strong>FemiGlow</strong>' +
      '<a href="{{unsubscribeUrl}}">Se désinscrire</a></td></tr></table></body></html>';
    const out = sanitizeEmailHtml(starter);
    expect(out).toMatch(/<table/i);
    expect(out).toMatch(/<strong>FemiGlow<\/strong>/i);
    expect(out).toMatch(/Se désinscrire/i);
  });
});
