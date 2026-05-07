/**
 * RTL — SlotCard (interactions admin).
 */
import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { SlotCard } from './SlotCard';
import type { ComponentMediaBindingWithMedia, SlotDefinition } from '@/lib/db/types';

// SlotCard est un <li> — on le rend dans un <ul> pour respecter la
// hiérarchie ARIA attendue par axe.
function render(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(<ul>{ui}</ul>, options);
}

const SLOT: SlotDefinition = {
  key: 'primary',
  label: 'Visuel principal',
  required: true,
  acceptKinds: ['image'],
  description: 'Image principale du hero.',
};

function makeBinding(
  partial: Partial<ComponentMediaBindingWithMedia> = {},
): ComponentMediaBindingWithMedia {
  return {
    id: 'bnd_1',
    componentId: 'cmp_1',
    slot: 'primary',
    mediaId: 'med_1',
    loadingStrategy: 'eager',
    fetchPriority: 'high',
    priority: true,
    placeholderStrategy: 'svg',
    customAlt: null,
    displayOrder: 0,
    isActive: true,
    notes: null,
    objectFit: 'cover',
    objectPosition: 'center',
    focalX: null,
    focalY: null,
    backgroundFill: null,
    createdBy: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    media: {
      id: 'med_1',
      kind: 'image',
      source: 'upload',
      slug: 'hero-1',
      originalUrl: null,
      originalFilename: 'hero.png',
      originalSizeBytes: 1024,
      originalMime: 'image/png',
      originalWidth: 1920,
      originalHeight: 1080,
      originalDurationMs: null,
      phash: null,
      blurhash: null,
      palette: [],
      alt: 'Photo hero',
      caption: null,
      credit: null,
      status: 'ready',
      failureReason: null,
      qualityProfile: 'hero',
      loadingStrategy: 'eager',
      isHero: true,
      overrides: {},
      createdBy: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      deletedAt: null,
    },
    ...partial,
  };
}

describe('SlotCard', () => {
  it('affiche le label, la clé et la description du slot', () => {
    render(
      <SlotCard
        slot={SLOT}
        binding={null}
        fallbackSvg="/svg/hero.svg"
        busy={false}
        onPick={() => {}}
        onUnassign={() => {}}
        onToggleActive={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: /visuel principal/i })).toBeInTheDocument();
    expect(screen.getByText(/image principale du hero/i)).toBeInTheDocument();
  });

  it('sans binding : message « Aucun média » + bouton « Choisir un média »', () => {
    const onPick = vi.fn();
    render(
      <SlotCard
        slot={SLOT}
        binding={null}
        fallbackSvg="/svg/hero.svg"
        busy={false}
        onPick={onPick}
        onUnassign={() => {}}
        onToggleActive={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText(/aucun média assigné/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /choisir un média/i }));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('avec binding actif : affiche slug et badge « Actif »', () => {
    render(
      <SlotCard
        slot={SLOT}
        binding={makeBinding()}
        fallbackSvg="/svg/hero.svg"
        busy={false}
        onPick={() => {}}
        onUnassign={() => {}}
        onToggleActive={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('hero-1')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('toggle bascule via onToggleActive(false) si binding actif', () => {
    const onToggleActive = vi.fn();
    render(
      <SlotCard
        slot={SLOT}
        binding={makeBinding({ isActive: true })}
        fallbackSvg={null}
        busy={false}
        onPick={() => {}}
        onUnassign={() => {}}
        onToggleActive={onToggleActive}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /désactiver/i }));
    expect(onToggleActive).toHaveBeenCalledWith(false);
  });

  it('busy=true désactive tous les boutons', () => {
    render(
      <SlotCard
        slot={SLOT}
        binding={makeBinding()}
        fallbackSvg={null}
        busy
        onPick={() => {}}
        onUnassign={() => {}}
        onToggleActive={() => {}}
        onDelete={() => {}}
      />,
    );
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });

  it('respecte axe', async () => {
    const { container } = render(
      <SlotCard
        slot={SLOT}
        binding={makeBinding()}
        fallbackSvg="/svg/hero.svg"
        busy={false}
        onPick={() => {}}
        onUnassign={() => {}}
        onToggleActive={() => {}}
        onDelete={() => {}}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
