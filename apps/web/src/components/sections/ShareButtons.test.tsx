import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareButtons } from './ShareButtons';
import { expectNoAxeViolations } from '@/test/axe';

describe('ShareButtons', () => {
  it('rend trois actions : Copier, Email, LinkedIn (target=_blank rel sécurisé)', () => {
    render(<ShareButtons url="https://femiglow.ma/journal/x" title="Titre" />);
    expect(screen.getByRole('button', { name: /copier le lien/i })).toBeInTheDocument();
    const email = screen.getByRole('link', { name: /envoyer par email/i });
    expect(email).toHaveAttribute('href', expect.stringContaining('mailto:'));
    const linkedin = screen.getByRole('link', { name: /partager sur linkedin/i });
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('annonce la confirmation via aria-live status après le clic', async () => {
    const status = { writes: [] as string[] };
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (v: string) => {
          status.writes.push(v);
          return Promise.resolve();
        },
      },
      configurable: true,
    });
    render(<ShareButtons url="https://femiglow.ma/journal/x" title="Titre" />);
    fireEvent.click(screen.getByRole('button', { name: /copier le lien/i }));
    await waitFor(() => {
      expect(status.writes).toContain('https://femiglow.ma/journal/x');
    });
    const live = screen.getByRole('status');
    await waitFor(() => expect(live).toHaveTextContent(/lien copi\u00e9/i));
  });

  it('respecte axe', async () => {
    const { container } = render(
      <ShareButtons url="https://femiglow.ma/journal/x" title="Titre" />,
    );
    await expectNoAxeViolations(container);
  });
});
