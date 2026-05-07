import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './render';

describe('renderMarkdown', () => {
  it('extrait les headings h2 et h3 avec id et texte', async () => {
    const { headings } = await renderMarkdown(
      '# titre\n\n## premier\n\nparagraphe\n\n### sous\n\n## second',
    );
    expect(headings).toHaveLength(3);
    expect(headings[0]).toMatchObject({ depth: 2, text: 'premier' });
    expect(headings[1]).toMatchObject({ depth: 3, text: 'sous' });
    expect(headings[2]).toMatchObject({ depth: 2, text: 'second' });
    headings.forEach((h) => expect(h.id).toMatch(/[a-z0-9-]+/i));
  });

  it('rend les paragraphes, listes, blockquote et liens', async () => {
    const md = [
      'Un paragraphe.',
      '',
      '> Une citation.',
      '',
      '- item un',
      '- item deux',
      '',
      '[lien](https://example.com)',
    ].join('\n');
    const { html } = await renderMarkdown(md);
    expect(html).toContain('<p>Un paragraphe.</p>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item un</li>');
    expect(html).toContain('href="https://example.com"');
  });

  it('purge les scripts injectés (test paranoïaque XSS)', async () => {
    const { html } = await renderMarkdown(
      'Bonjour <script>doEvil()</script> monde',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script');
    expect(html).toContain('Bonjour');
    expect(html).toContain('monde');
  });

  it('purge les attributs onclick et javascript: dans les liens', async () => {
    const { html } = await renderMarkdown(
      '[hack](javascript:alert(1))\n\n<a href="x" onclick="alert(2)">y</a>',
    );
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('alert(');
  });

  it('ajoute loading="lazy" et decoding="async" sur les images', async () => {
    const { html } = await renderMarkdown('![alt](/foo.png)');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });
});
