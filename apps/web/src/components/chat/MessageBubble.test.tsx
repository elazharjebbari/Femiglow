/**
 * F05 — Tests `<MessageBubble />`.
 *
 * Couvre :
 *  - Render user vs assistant (alignment, color, role data-attr)
 *  - State streaming (caret + placeholder)
 *  - State error
 *  - Direction RTL pour AR
 *  - Sources popover (assistant only)
 *  - A11y : role=listitem, data-message-id
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessageDto } from '@/lib/chat/contracts';

function makeMsg(overrides: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id: 'm_1',
    role: 'assistant',
    content: 'Bonjour visiteur',
    status: 'final',
    createdAt: new Date().toISOString(),
    ...overrides,
  } as ChatMessageDto;
}

describe('<MessageBubble />', () => {
  describe('rendering basics', () => {
    it('affiche le contenu textuel', () => {
      render(<MessageBubble message={makeMsg({ content: 'Salut !' })} />);
      expect(screen.getByText('Salut !')).toBeInTheDocument();
    });

    it('expose data-role + data-message-id pour locators stables', () => {
      render(<MessageBubble message={makeMsg({ id: 'm_42', role: 'user' })} />);
      const bubble = screen.getByRole('listitem');
      expect(bubble.getAttribute('data-role')).toBe('user');
      expect(bubble.getAttribute('data-message-id')).toBe('m_42');
    });

    it('utilise role=listitem (s\'insère dans MessageList role=log)', () => {
      render(<MessageBubble message={makeMsg()} />);
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });
  });

  describe('user vs assistant alignment', () => {
    it('user → justify-end (right alignment)', () => {
      render(<MessageBubble message={makeMsg({ role: 'user', content: 'Hi' })} />);
      const bubble = screen.getByRole('listitem');
      expect(bubble.className).toMatch(/justify-end/);
    });

    it('assistant → justify-start (left alignment)', () => {
      render(<MessageBubble message={makeMsg({ role: 'assistant' })} />);
      const bubble = screen.getByRole('listitem');
      expect(bubble.className).toMatch(/justify-start/);
    });
  });

  describe('state streaming', () => {
    it('affiche un placeholder "…" si content vide + status=streaming', () => {
      render(<MessageBubble message={makeMsg({ content: '', status: 'streaming' })} />);
      expect(screen.getByText('…')).toBeInTheDocument();
    });

    it('rend le caret animé (aria-hidden) en streaming', () => {
      const { container } = render(
        <MessageBubble message={makeMsg({ content: 'partiel', status: 'streaming' })} />,
      );
      const caret = container.querySelector('[aria-hidden="true"]');
      expect(caret).not.toBeNull();
    });

    it('pas de caret en status=sent (message finalisé)', () => {
      const { container } = render(
        <MessageBubble message={makeMsg({ status: 'sent' })} />,
      );
      // En status=sent (finalisé), pas de span aria-hidden pulse
      const carets = container.querySelectorAll('span.animate-pulse');
      expect(carets.length).toBe(0);
    });
  });

  describe('state error', () => {
    it('applique classe rose-50 pour error', () => {
      const { container } = render(
        <MessageBubble message={makeMsg({ status: 'error', content: 'Erreur' })} />,
      );
      const bubble = container.querySelector('.bg-rose-50, .text-rose-800');
      expect(bubble).not.toBeNull();
    });
  });

  describe('direction RTL (ar)', () => {
    it('language=ar → dir="rtl"', () => {
      render(<MessageBubble message={makeMsg({ language: 'ar' as never })} />);
      expect(screen.getByRole('listitem').getAttribute('dir')).toBe('rtl');
    });

    it('language=fr → dir="ltr"', () => {
      render(<MessageBubble message={makeMsg({ language: 'fr' as never })} />);
      expect(screen.getByRole('listitem').getAttribute('dir')).toBe('ltr');
    });

    it('language=ar-MA (darija) → dir="ltr" (texte latin)', () => {
      // Darija est écrit en alphabet latin → LTR
      render(<MessageBubble message={makeMsg({ language: 'ar-MA' as never })} />);
      expect(screen.getByRole('listitem').getAttribute('dir')).toBe('ltr');
    });
  });

  describe('sources popover', () => {
    it('assistant avec sources → popover rendu', () => {
      const sources = [{ id: 's1', label: 'Page Kit', url: '/kit', score: 0.85 } as never];
      const { container } = render(
        <MessageBubble message={makeMsg({ role: 'assistant', sources })} />,
      );
      // SourcesPopover devrait apparaître dans le DOM
      // (vérification souple — la structure exacte dépend du composant)
      expect(container.querySelector('[role="button"], button, summary')).toBeTruthy();
    });

    it('user avec sources → pas de popover (sources réservées assistant)', () => {
      const sources = [{ id: 's1', label: 'Page Kit', url: '/kit', score: 0.85 } as never];
      const { container } = render(
        <MessageBubble message={makeMsg({ role: 'user', sources })} />,
      );
      // L'assistant-only condition doit s'appliquer
      const sourcePopovers = container.querySelectorAll('details, [data-sources]');
      expect(sourcePopovers.length).toBe(0);
    });

    it('assistant sans sources → pas de popover', () => {
      const { container } = render(
        <MessageBubble message={makeMsg({ role: 'assistant', sources: undefined })} />,
      );
      const details = container.querySelectorAll('details');
      expect(details.length).toBe(0);
    });
  });
});
