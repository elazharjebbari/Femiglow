/**
 * RTL — `ComponentList` (RSC pure de présentation).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { ComponentList } from './ComponentList';
import type { SiteComponent } from '@/lib/db/types';

function makeComponent(partial: Partial<SiteComponent>): SiteComponent {
  return {
    id: 'cmp_1',
    key: 'home-hero',
    name: 'Hero Accueil',
    description: 'Hero principal de la home',
    category: 'hero',
    pageGroup: 'home',
    filePath: 'src/components/sections/Hero.tsx',
    slots: [
      {
        key: 'primary',
        label: 'Visuel',
        required: true,
        acceptKinds: ['image'],
      },
    ],
    fields: [],
    defaultSvgFallback: '/svg/hero.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'high',
    supportsAnimation: true,
    metadata: {},
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
  };
}

describe('ComponentList', () => {
  it('affiche le label du groupe en français', () => {
    const c = makeComponent({});
    render(
      <ComponentList
        groupKey="home"
        components={[c]}
        counts={new Map([[c.id, { active: 1, total: 1 }]])}
      />,
    );
    expect(screen.getByRole('heading', { name: /accueil/i })).toBeInTheDocument();
  });

  it('lien vers /admin/components/[key]', () => {
    const c = makeComponent({ key: 'kit-packshot', name: 'Packshot Kit' });
    render(
      <ComponentList
        groupKey="kit"
        components={[c]}
        counts={new Map([[c.id, { active: 0, total: 0 }]])}
      />,
    );
    const link = screen.getByRole('link', { name: /packshot kit/i });
    expect(link).toHaveAttribute('href', '/admin/components/kit-packshot');
  });

  it('badge emerald si bindings actifs > 0', () => {
    const c = makeComponent({});
    render(
      <ComponentList
        groupKey="home"
        components={[c]}
        counts={new Map([[c.id, { active: 1, total: 1 }]])}
      />,
    );
    expect(screen.getByText(/1\/1 actif/i)).toHaveClass('bg-emerald-100');
  });

  it('badge stone si aucun binding', () => {
    const c = makeComponent({});
    render(
      <ComponentList
        groupKey="home"
        components={[c]}
        counts={new Map()}
      />,
    );
    expect(screen.getByText(/0\/1 actif/i)).toHaveClass('bg-stone-100');
  });

  it('respecte axe', async () => {
    const c = makeComponent({});
    const { container } = render(
      <ComponentList
        groupKey="home"
        components={[c]}
        counts={new Map([[c.id, { active: 1, total: 1 }]])}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
