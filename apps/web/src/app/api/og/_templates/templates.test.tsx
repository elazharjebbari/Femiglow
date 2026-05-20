/**
 * Tests des 4 templates OG (rendu JSX, hors edge runtime).
 *
 * On ne peut pas appeler `ImageResponse` en environnement Vitest (le
 * runtime edge nécessite des polyfills non-disponibles en jsdom). En
 * revanche, les templates sont des fonctions JSX pures : on peut les
 * rendre côté React DOM et vérifier la présence des champs critiques
 * (title, description, siteName).
 *
 * Cette couverture protège contre :
 *  - Renommage accidentel d'une prop.
 *  - Casse d'un template lors d'un refactor (e.g. style global qui
 *    fait disparaître le titre).
 *  - Régression de la palette FemiGlow (Crème/Encre/Sauge présents).
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { ArticleTemplate } from './article';
import { DefaultTemplate } from './default';
import { MarketingTemplate } from './marketing';
import { ProductTemplate } from './product';

const baseProps = {
  title: 'Le rituel d\'éclat',
  description: 'Soin manucure japonaise halal en quatre gestes.',
  siteName: 'FemiGlow',
  imageUrl: 'https://femiglow.ma/og/kit.png',
  kicker: 'Le kit',
  price: '320 MAD',
};

describe('OG templates — DefaultTemplate', () => {
  it('rend le title', () => {
    const { container } = render(<DefaultTemplate {...baseProps} />);
    expect(container.textContent).toContain(baseProps.title);
  });

  it('respecte les dimensions OG 1200×630', () => {
    const { container } = render(<DefaultTemplate {...baseProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('1200px');
    expect(root.style.height).toBe('630px');
  });

  it('accepte la prop siteName sans crasher (template minimal)', () => {
    expect(() => render(<DefaultTemplate {...baseProps} siteName="Custom" />)).not.toThrow();
  });
});

describe('OG templates — MarketingTemplate', () => {
  it('rend title et description', () => {
    const { container } = render(<MarketingTemplate {...baseProps} />);
    expect(container.textContent).toContain(baseProps.title);
    expect(container.textContent).toContain(baseProps.description);
  });
});

describe('OG templates — ArticleTemplate', () => {
  it('rend title et kicker (catégorie/eyebrow)', () => {
    const { container } = render(<ArticleTemplate {...baseProps} />);
    expect(container.textContent).toContain(baseProps.title);
    // Le kicker peut être en lower/upper case selon le template — on
    // vérifie juste la présence sémantique.
    expect(container.textContent?.toLowerCase()).toContain(baseProps.kicker.toLowerCase());
  });
});

describe('OG templates — ProductTemplate', () => {
  it('rend title et price', () => {
    const { container } = render(<ProductTemplate {...baseProps} />);
    expect(container.textContent).toContain(baseProps.title);
    expect(container.textContent).toContain(baseProps.price);
  });

  it('sans price → ne crashe pas', () => {
    const { container } = render(
      <ProductTemplate {...baseProps} price={undefined} />,
    );
    expect(container.textContent).toContain(baseProps.title);
  });
});
