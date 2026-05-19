import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroGalleryThumbnails } from './HeroGalleryThumbnails';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';

const IMAGES: HeroGalleryImage[] = [
  { id: '1', src: '/a.jpg', alt: 'a', width: 100, height: 125, kind: 'product' },
  { id: '2', src: '/b.jpg', alt: 'b', width: 100, height: 125, kind: 'context' },
  { id: '3', src: '/c.jpg', alt: 'c', width: 100, height: 125, kind: 'review', caption: 'I.R · Rabat' },
];

describe('HeroGalleryThumbnails', () => {
  it('ne rend rien si images.length <= 1', () => {
    const { container } = render(
      <HeroGalleryThumbnails images={[IMAGES[0]!]} currentIndex={0} onSelect={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('rend une vignette par image', () => {
    render(<HeroGalleryThumbnails images={IMAGES} currentIndex={0} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it("aria-current='true' sur la vignette active", () => {
    render(<HeroGalleryThumbnails images={IMAGES} currentIndex={1} onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
    expect(buttons[0]).not.toHaveAttribute('aria-current', 'true');
  });

  it('appelle onSelect au click', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<HeroGalleryThumbnails images={IMAGES} currentIndex={0} onSelect={onSelect} />);
    await user.click(screen.getAllByRole('button')[2]!);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("aria-label des vignettes review mentionne 'photo cliente'", () => {
    render(<HeroGalleryThumbnails images={IMAGES} currentIndex={0} onSelect={() => {}} />);
    expect(screen.getByLabelText(/voir l'image 3 sur 3 \(photo cliente\)/i)).toBeInTheDocument();
  });
});
