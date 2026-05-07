import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InventoryPanel } from './InventoryPanel';
import { expectNoAxeViolations } from '@/test/axe';

const mockResponse = {
  manifest: {
    generatedAt: new Date('2025-01-01T08:00:00Z').toISOString(),
    components: [
      {
        name: 'HeroProduit',
        path: 'src/components/sections/HeroProduit.tsx',
        category: 'section_hero',
        description: 'Bloc h\u00e9ro produit',
        events: ['view_item'],
      },
    ],
    pages: [
      {
        route: '/kit',
        title: 'Le kit',
        category: 'product',
        filePath: 'src/app/(marketing)/kit/page.tsx',
      },
    ],
  },
  diff: {
    componentsToCreate: 1,
    componentsToUpdate: 0,
    componentsToDelete: 0,
    pagesToCreate: 1,
    pagesToUpdate: 0,
    pagesToDelete: 0,
    isEmpty: false,
    summary: '2 \u00e9l\u00e9ments \u00e0 synchroniser',
  },
  existing: { componentsCount: 0, pagesCount: 0 },
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    })),
  );
});

describe('InventoryPanel', () => {
  it('rend les compteurs de diff', async () => {
    render(<InventoryPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Composants \(1\)/)).toBeInTheDocument();
    });
  });

  it('respecte axe', async () => {
    const { container } = render(<InventoryPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Composants \(1\)/)).toBeInTheDocument();
    });
    await expectNoAxeViolations(container);
  });
});
