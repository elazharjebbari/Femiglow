/**
 * Snapshots — capture le HTML rendu pour 5 fixtures représentatives.
 * Toute régression dans la pipeline render (changement de sanitization,
 * remark/rehype version bump, etc.) déclenche un diff visible et
 * intentionnel sur le commit.
 *
 * Pour mettre à jour : `vitest -u` (uniquement si l'évolution est voulue).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import { renderLegalMarkdown } from './render';

describe('Snapshots — render output stable', () => {
  it('fixture 1 : mentions légales minimales', async () => {
    const md = `# Mentions légales

**FemiGlow** SARL, RC {{COMPANY_RC}}, ICE {{ICE}}.

- Siège : {{COMPANY_ADDRESS}}
- Email : <{{COMPANY_EMAIL}}>

Dernière mise à jour : {{LAST_UPDATED}}.`;

    const vars = new Map([
      ['COMPANY_RC', '12345/Rabat'],
      ['ICE', '001234567890123'],
      ['COMPANY_ADDRESS', '25 bis avenue Patrice Lumumba, Rabat'],
      ['COMPANY_EMAIL', 'info@femiglow.ma'],
      ['LAST_UPDATED', '13 mai 2026'],
    ]);
    const { html } = await renderLegalMarkdown(md, { variables: vars });
    expect(html).toMatchInlineSnapshot(`
      "<h1 id="user-content-mentions-légales">Mentions légales</h1>
      <p><strong>FemiGlow</strong> SARL, RC 12345/Rabat, ICE 001234567890123.</p>
      <ul>
      <li>Siège : 25 bis avenue Patrice Lumumba, Rabat</li>
      <li>Email : <a href="mailto:info@femiglow.ma">info@femiglow.ma</a></li>
      </ul>
      <p>Dernière mise à jour : 13 mai 2026.</p>"
    `);
  });

  it('fixture 2 : CGV avec H2/H3 + liste imbriquée', async () => {
    const md = `# CGV

## Article 1 — Champ d'application

Le présent contrat s'applique aux ventes en ligne.

### 1.1 — Définitions

- **Client** : personne physique majeure
- **Produit** : article cosmétique

## Article 2 — Prix

Les prix sont exprimés en MAD TTC.`;

    const { html, headings } = await renderLegalMarkdown(md);
    expect(html).toMatchInlineSnapshot(`
      "<h1 id="user-content-cgv">CGV</h1>
      <h2 id="user-content-article-1--champ-dapplication">Article 1 — Champ d'application</h2>
      <p>Le présent contrat s'applique aux ventes en ligne.</p>
      <h3 id="user-content-11--définitions">1.1 — Définitions</h3>
      <ul>
      <li><strong>Client</strong> : personne physique majeure</li>
      <li><strong>Produit</strong> : article cosmétique</li>
      </ul>
      <h2 id="user-content-article-2--prix">Article 2 — Prix</h2>
      <p>Les prix sont exprimés en MAD TTC.</p>"
    `);
    expect(headings).toMatchInlineSnapshot(`
      [
        {
          "depth": 2,
          "id": "article-1--champ-dapplication",
          "text": "Article 1 — Champ d'application",
        },
        {
          "depth": 3,
          "id": "11--définitions",
          "text": "1.1 — Définitions",
        },
        {
          "depth": 2,
          "id": "article-2--prix",
          "text": "Article 2 — Prix",
        },
      ]
    `);
  });

  it('fixture 3 : liens externes + internes', async () => {
    const md = `Visite [notre site](https://femiglow.ma/rituel) et
[Google](https://google.com) et [contact](mailto:info@femiglow.ma).`;
    const { html } = await renderLegalMarkdown(md);
    expect(html).toMatchInlineSnapshot(
      `
      "<p>Visite <a href="https://femiglow.ma/rituel">notre site</a> et
      <a href="https://google.com" target="_blank" rel="noopener noreferrer">Google</a> et <a href="mailto:info@femiglow.ma">contact</a>.</p>"
    `,
    );
  });

  it('fixture 4 : XSS injection produit HTML inerte', async () => {
    const md = `Texte normal.

<script>alert('XSS')</script>

[Lien](javascript:alert(1))

<img src=x onerror=alert(1)>`;
    const { html } = await renderLegalMarkdown(md);
    expect(html).toMatchInlineSnapshot(`
      "<p>Texte normal.</p>
      <p><a>Lien</a></p>"
    `);
  });

  it('fixture 5 : missing var fallback en mode public', async () => {
    const md = 'Société : {{COMPANY_NAME}}, RC : {{COMPANY_RC}}.';
    const { html } = await renderLegalMarkdown(md, { mode: 'public' });
    // COMPANY_NAME pas fourni → [COMPANY_NAME] ; idem RC
    expect(html).toMatchInlineSnapshot(
      `"<p>Société : [COMPANY_NAME], RC : [COMPANY_RC].</p>"`,
    );
  });
});
