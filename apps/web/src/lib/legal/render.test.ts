import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import { renderLegalMarkdown, renderLegalMarkdownWithDbVars } from './render';

describe('legal/render — pipeline Markdown', () => {
  it('rend les paragraphes et listes', async () => {
    const md = ['Un paragraphe.', '', '- item un', '- item deux'].join('\n');
    const { html } = await renderLegalMarkdown(md);
    expect(html).toContain('<p>Un paragraphe.</p>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item un</li>');
  });

  it('extrait les headings H2/H3 avec slug ID', async () => {
    const md = '# titre\n\n## premier\n\n### sous\n\n## second';
    const { headings } = await renderLegalMarkdown(md);
    expect(headings).toHaveLength(3);
    expect(headings[0]).toMatchObject({ depth: 2, text: 'premier' });
    expect(headings[1]).toMatchObject({ depth: 3, text: 'sous' });
    headings.forEach((h) => expect(h.id).toMatch(/[a-z0-9-]+/));
  });

  it('purge les balises <script> (XSS)', async () => {
    const md = 'Bonjour <script>doEvil()</script> monde';
    const { html } = await renderLegalMarkdown(md);
    // Tag stripped → le code ne peut plus s'exécuter (peu importe si
    // le texte interne survit sous forme de texte plat).
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script');
  });

  it('purge les iframes et les balises dangereuses', async () => {
    const md = '<iframe src="https://evil.tld"></iframe>';
    const { html } = await renderLegalMarkdown(md);
    expect(html).not.toContain('<iframe');
  });

  it('purge les handlers `on*` inline', async () => {
    const md = '<a href="https://x.com" onclick="alert(1)">link</a>';
    const { html } = await renderLegalMarkdown(md);
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('alert(1)');
  });

  it('purge les attributs `on*` injectés', async () => {
    const md = '[click](javascript:alert(1))';
    const { html } = await renderLegalMarkdown(md);
    // javascript: URL bloquée par allowed protocols
    expect(html).not.toMatch(/href="javascript:/);
  });

  it('substitue les variables et liste varsUsed', async () => {
    const md = 'RC : {{COMPANY_RC}} · ICE : {{ICE}}';
    const vars = new Map([
      ['COMPANY_RC', '12345/Rabat'],
      ['ICE', '001234567890123'],
    ]);
    const { html, varsUsed } = await renderLegalMarkdown(md, { variables: vars });
    expect(html).toContain('12345/Rabat');
    expect(html).toContain('001234567890123');
    expect(varsUsed.sort()).toEqual(['COMPANY_RC', 'ICE']);
  });

  it('liens externes : ajoute target=_blank rel=noopener', async () => {
    const md = '[Google](https://google.com)';
    const { html } = await renderLegalMarkdown(md);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('liens internes (même host) : pas de target=_blank', async () => {
    const md = '[interne](https://femiglow.ma/legal/cgv)';
    const { html } = await renderLegalMarkdown(md);
    expect(html).not.toContain('target="_blank"');
  });

  it('mailto / tel : autorisés', async () => {
    const md = '[mail](mailto:info@femiglow.ma) [tel](tel:+212630035905)';
    const { html } = await renderLegalMarkdown(md);
    expect(html).toContain('href="mailto:info@femiglow.ma"');
    expect(html).toContain('href="tel:+212630035905"');
  });

  it('substitution missing en mode public : fallback [KEY]', async () => {
    const md = '{{FOO_BAR}}';
    const { html } = await renderLegalMarkdown(md, { mode: 'public' });
    expect(html).toContain('[FOO_BAR]');
  });

  it('renderLegalMarkdownWithDbVars résout via DB rows', async () => {
    const md = 'Société {{COMPANY_NAME}}';
    const { html } = await renderLegalMarkdownWithDbVars(md, [
      { key: 'COMPANY_NAME', value: 'FemiGlow SARL' },
    ]);
    expect(html).toContain('FemiGlow SARL');
  });
});
