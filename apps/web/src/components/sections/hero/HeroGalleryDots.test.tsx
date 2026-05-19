import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroGalleryDots } from './HeroGalleryDots';

describe('HeroGalleryDots', () => {
  it('ne rend rien si count <= 1', () => {
    const { container } = render(
      <HeroGalleryDots count={1} activeIndex={0} onSelect={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('rend N dots quand 2 <= N <= 6', () => {
    render(<HeroGalleryDots count={5} activeIndex={0} onSelect={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it("aria-current='true' sur le dot actif", () => {
    render(<HeroGalleryDots count={4} activeIndex={2} onSelect={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[2]).toHaveAttribute('aria-current', 'true');
    expect(tabs[0]).not.toHaveAttribute('aria-current', 'true');
  });

  it('appelle onSelect avec le bon index au click', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<HeroGalleryDots count={4} activeIndex={0} onSelect={onSelect} />);
    await user.click(screen.getAllByRole('tab')[2]!);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("aria-label inclut l'ordinal et le total", () => {
    render(<HeroGalleryDots count={3} activeIndex={0} onSelect={() => {}} />);
    expect(screen.getByLabelText(/voir l'image 2 sur 3/i)).toBeInTheDocument();
  });

  it("affiche un compteur 'X / N' quand count > 6", () => {
    render(<HeroGalleryDots count={8} activeIndex={2} onSelect={() => {}} />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    // "3 / 8" — 3 = activeIndex+1
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
  });
});
