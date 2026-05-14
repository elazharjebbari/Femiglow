/**
 * Test du rehype plugin `rehypeHighlightMissingVars` : en mode
 * admin-preview, les vars manquantes doivent apparaître dans le HTML
 * final comme <mark data-missing-var="KEY">{{KEY}}</mark> (et PAS
 * comme markers texte ⦉KEY⦊).
 *
 * En mode public, le fallback reste [KEY] (texte plain).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import { renderLegalMarkdown } from './render';

describe('rehypeHighlightMissingVars — mode admin-preview', () => {
  it('wrap les vars manquantes dans <mark data-missing-var>', async () => {
    const { html } = await renderLegalMarkdown('RC : {{COMPANY_RC}}', {
      mode: 'admin-preview',
    });
    expect(html).toContain('<mark');
    expect(html).toContain('data-missing-var="COMPANY_RC"');
    expect(html).toContain('{{COMPANY_RC}}');
  });

  it('plusieurs vars manquantes → plusieurs marks', async () => {
    const { html } = await renderLegalMarkdown('{{A}} et {{B}}', {
      mode: 'admin-preview',
    });
    const count = (html.match(/<mark/g) ?? []).length;
    expect(count).toBe(2);
  });

  it('vars fournies → pas de mark', async () => {
    const map = new Map([['COMPANY_RC', '12345/Rabat']]);
    const { html } = await renderLegalMarkdown('RC : {{COMPANY_RC}}', {
      mode: 'admin-preview',
      variables: map,
    });
    expect(html).not.toContain('<mark');
    expect(html).toContain('12345/Rabat');
  });

  it('aucun marker ⦉ ne fuite dans le HTML final', async () => {
    const { html } = await renderLegalMarkdown('{{X}} {{Y}} {{Z}}', {
      mode: 'admin-preview',
    });
    expect(html).not.toContain('⦉');
    expect(html).not.toContain('⦊');
  });

  it('mark inline au milieu d\'un paragraphe (split text node)', async () => {
    const { html } = await renderLegalMarkdown(
      'Avant {{KEY}} et après le marker.',
      { mode: 'admin-preview' },
    );
    // Le paragraphe doit contenir le mark inline
    expect(html).toMatch(/<p>Avant <mark[^>]*>\{\{KEY\}\}<\/mark> et après/);
  });
});

describe('mode public — pas de rehype plugin', () => {
  it('vars manquantes → fallback [KEY] (texte plain)', async () => {
    const { html } = await renderLegalMarkdown('RC : {{COMPANY_RC}}', {
      mode: 'public',
    });
    expect(html).toContain('[COMPANY_RC]');
    expect(html).not.toContain('<mark');
    expect(html).not.toContain('⦉');
  });

  it('mode public par défaut (pas d\'opts.mode)', async () => {
    const { html } = await renderLegalMarkdown('{{X}}');
    expect(html).toContain('[X]');
    expect(html).not.toContain('<mark');
  });
});

describe('Sécurité — pas de bypass via les marqueurs', () => {
  it('un attaquant qui injecte ⦉KEY⦊ dans le source MD ne crée PAS de mark en mode public', async () => {
    // Si quelqu'un colle un marker pré-formé dans le contenu MD lui-même,
    // mode public ne doit pas le transformer en HTML mark.
    const { html } = await renderLegalMarkdown('Texte ⦉EVIL⦊ inline', {
      mode: 'public',
    });
    expect(html).not.toContain('<mark');
    // Le marker reste en texte plain
    expect(html).toContain('⦉EVIL⦊');
  });

  it('en admin-preview, ⦉KEY⦊ dans le source brut → wrapped (acceptable, c\'est l\'admin qui voit)', async () => {
    // L'admin tape le marker volontairement dans son MD : c'est lui qui
    // contrôle son contenu. Aucun risque XSS car <mark> est dans le
    // whitelist du sanitize schema.
    const { html } = await renderLegalMarkdown('⦉INFO⦊', {
      mode: 'admin-preview',
    });
    expect(html).toContain('<mark');
  });
});
