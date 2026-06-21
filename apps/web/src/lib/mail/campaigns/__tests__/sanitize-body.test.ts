// @vitest-environment node
/**
 * F05-S — sanitization du corps de campagne (sécurité G12).
 *
 * Double oracle : (1) les vecteurs hostiles sont NEUTRALISÉS ; (2) le HTML
 * e-mail légitime ET les merge-tags Listmonk sont PRÉSERVÉS (la sécurité ne
 * casse pas la personnalisation).
 */
import { describe, expect, it } from 'vitest';
import { sanitizeCampaignBody } from '../sanitize-body';

describe('F05-S — sanitizeCampaignBody', () => {
  it('F05-S-001 — neutralise script / iframe / handlers on* / javascript:', () => {
    const out = sanitizeCampaignBody(
      `<p onclick="steal()">Hi</p><script>alert(1)</script>` +
        `<iframe src="https://evil.tld"></iframe>` +
        `<a href="javascript:alert(1)">x</a><img src="x" onerror="alert(2)">`,
    );
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain('Hi'); // le contenu textuel légitime reste
  });

  it('F05-S-002 — neutralise le CSS exécutable (expression / url(javascript:) / @import)', () => {
    const out = sanitizeCampaignBody(
      `<p style="width:expression(alert(1));background:url(javascript:alert(1))">x</p>` +
        `<style>@import url('//evil.tld');</style>`,
    );
    expect(out).not.toMatch(/expression\(/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/@import/i);
  });

  it('F05-S-003 — PRÉSERVE le HTML e-mail légitime (a/img/strong/table/style sûr)', () => {
    const out = sanitizeCampaignBody(
      `<table><tr><td><strong>Promo</strong> <em>Aïd</em></td></tr></table>` +
        `<a href="https://femiglow-maroc.com/rituel">Boutique</a>` +
        `<img src="https://femiglow-maroc.com/logo.png" alt="logo">`,
    );
    expect(out).toMatch(/<strong>Promo<\/strong>/i);
    expect(out).toMatch(/<table/i);
    expect(out).toMatch(/href="https:\/\/femiglow-maroc\.com\/rituel"/i);
    expect(out).toMatch(/<img[^>]+src="https:\/\/femiglow-maroc\.com\/logo\.png"/i);
  });

  it('F05-S-004 — PRÉSERVE les merge-tags Listmonk {{ … }} (texte ET href)', () => {
    const out = sanitizeCampaignBody(
      `<p>Bonjour {{ .Subscriber.Name }},</p>` +
        `<p><a href="{{ UnsubscribeURL }}">Se désabonner</a></p>` +
        `<p>{{ .Subscriber.Email }}</p>`,
    );
    expect(out).toContain('{{ .Subscriber.Name }}');
    expect(out).toContain('{{ .Subscriber.Email }}');
    expect(out).toContain('href="{{ UnsubscribeURL }}"');
  });

  it('F05-S-005 — mode FRAGMENT : pas de réécriture en document complet (<html>/<body>)', () => {
    const out = sanitizeCampaignBody('<p>Corps simple</p>');
    expect(out).toBe('<p>Corps simple</p>');
    expect(out).not.toMatch(/<html|<body|<head/i);
  });
});
