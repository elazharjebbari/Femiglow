/**
 * LMK-CMP-IFRAME-* — Iframe Listmonk sandboxée sous le shell admin FemiGlow.
 *
 * Oracles : src = proxy same-origin si publicOrigin absent, sinon sous-domaine ;
 * sandbox SANS allow-top-navigation (pas d'évasion de l'iframe) ; postMessage
 * d'une origine ÉTRANGÈRE ignoré (anti-clickjacking / anti-spoof navigation),
 * postMessage same-origin honoré.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ListmonkFrame } from '../ListmonkFrame';

afterEach(cleanup);

function getFrame(container: HTMLElement): HTMLIFrameElement {
  const frame = container.querySelector('iframe');
  if (!frame) throw new Error('iframe absente');
  return frame;
}

describe('ListmonkFrame — src', () => {
  it('LMK-CMP-IFRAME-SRC-PROXY : publicOrigin absent -> src = /api/listmonk<path>', () => {
    const { container } = render(<ListmonkFrame path="/admin/campaigns" />);
    expect(getFrame(container).getAttribute('src')).toBe('/api/listmonk/admin/campaigns');
  });

  it('LMK-CMP-IFRAME-SRC-SUBDOMAIN : publicOrigin défini -> src = sous-domaine<path>', () => {
    const { container } = render(
      <ListmonkFrame path="/admin" publicOrigin="https://listmonk.femiglow-maroc.com" />,
    );
    expect(getFrame(container).getAttribute('src')).toBe(
      'https://listmonk.femiglow-maroc.com/admin',
    );
  });

  it('LMK-CMP-IFRAME-SRC : trailing slash de publicOrigin normalisé + path sans slash préfixé', () => {
    const { container } = render(
      <ListmonkFrame path="admin/lists" publicOrigin="https://listmonk.femiglow-maroc.com/" />,
    );
    expect(getFrame(container).getAttribute('src')).toBe(
      'https://listmonk.femiglow-maroc.com/admin/lists',
    );
  });

  it('défaut : path /admin', () => {
    const { container } = render(<ListmonkFrame />);
    expect(getFrame(container).getAttribute('src')).toBe('/api/listmonk/admin');
  });
});

describe('ListmonkFrame — sandbox (sécurité)', () => {
  it('LMK-CMP-IFRAME-SANDBOX : sandbox présent SANS allow-top-navigation', () => {
    const { container } = render(<ListmonkFrame />);
    const sandbox = getFrame(container).getAttribute('sandbox') ?? '';
    // Le minimum nécessaire est présent…
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-forms');
    // …mais PAS d'évasion de l'iframe.
    expect(sandbox, 'pas d’évasion top-navigation').not.toContain('allow-top-navigation');
  });
});

describe('ListmonkFrame — postMessage filtré par origine', () => {
  it('LMK-CMP-IFRAME-POSTMSG : message d’origine ÉTRANGÈRE ignoré', async () => {
    const onNavigate = vi.fn();
    render(<ListmonkFrame onNavigate={onNavigate} />);

    // Origine spoofée différente de window.location.origin.
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        data: { type: 'listmonk:navigate', path: '/admin/danger' },
      }),
    );
    // Laisse une micro-tâche au handler.
    await new Promise((r) => setTimeout(r, 0));
    expect(onNavigate, 'navigation d’une origine étrangère ignorée').not.toHaveBeenCalled();
  });

  it('LMK-CMP-IFRAME-POSTMSG : message same-origin valide honoré', async () => {
    const onNavigate = vi.fn();
    render(<ListmonkFrame onNavigate={onNavigate} />);

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'listmonk:navigate', path: '/admin/lists' },
      }),
    );
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/admin/lists'));
  });

  it('LMK-CMP-IFRAME-POSTMSG : message same-origin de mauvais type ignoré', async () => {
    const onNavigate = vi.fn();
    render(<ListmonkFrame onNavigate={onNavigate} />);
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'autre:event', path: '/admin/x' },
      }),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
