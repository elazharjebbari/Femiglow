/**
 * Lot L11 — éditeur moteur (UI) : badge OFF par défaut (INV-13), publication
 * optimiste (200 → version+1 + « Publié »), conflit 409, et preuve INV-14 via
 * le simulateur (checkout ⇒ suppress / NEVER-CHECKOUT même trigger armé).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_ENGINE_CONFIG } from '@/lib/i18n/engine-config-schema';

import { EngineEditor, type EngineEditorMeta } from './EngineEditor';

const META: EngineEditorMeta = {
  version: 3,
  updatedAt: new Date().toISOString(),
  updatedBy: null,
  isDefault: false,
};

function engineOn() {
  return {
    ...DEFAULT_ENGINE_CONFIG,
    engineEnabled: true,
    profiles: DEFAULT_ENGINE_CONFIG.profiles.map((p) =>
      p.id === 'TRIG-ENTRY-MISMATCH' ? { ...p, enabled: true } : p,
    ),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EngineEditor — état & publication', () => {
  it('badge inactif par défaut (INV-13), activable', () => {
    render(<EngineEditor initialConfig={DEFAULT_ENGINE_CONFIG} meta={META} />);
    expect(screen.getByTestId('engine-state-badge').textContent).toContain(
      'inactif',
    );
    fireEvent.click(screen.getByTestId('toggle-engine-enabled'));
    expect(screen.getByTestId('engine-state-badge').textContent).toContain(
      'actif',
    );
  });

  it('Publier désactivé tant que non modifié', () => {
    render(<EngineEditor initialConfig={DEFAULT_ENGINE_CONFIG} meta={META} />);
    expect(screen.getByTestId('publish-button')).toBeDisabled();
  });

  it('publication 200 → If-Match envoyé, version mise à jour, « Publié »', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ meta: { version: 4 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<EngineEditor initialConfig={DEFAULT_ENGINE_CONFIG} meta={META} />);
    fireEvent.click(screen.getByTestId('toggle-engine-enabled'));
    fireEvent.click(screen.getByTestId('publish-button'));

    expect(await screen.findByTestId('save-status')).toHaveTextContent('Publié');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['If-Match']).toBe('3');
    expect(JSON.parse(init.body as string).payload.engineEnabled).toBe(true);
  });

  it('conflit 409 → bannière de conflit, pas d’écrasement', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 409,
      json: async () => ({ error: { details: { currentVersion: 9 } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<EngineEditor initialConfig={DEFAULT_ENGINE_CONFIG} meta={META} />);
    fireEvent.click(screen.getByTestId('toggle-engine-enabled'));
    fireEvent.click(screen.getByTestId('publish-button'));

    const status = await screen.findByTestId('save-status');
    expect(status).toHaveTextContent('v9');
    expect(status.getAttribute('role')).toBe('alert');
  });
});

describe('EngineEditor — simulateur (preuves invariants)', () => {
  it('INV-14 : preset checkout ⇒ suppress / NEVER-CHECKOUT même trigger armé', () => {
    render(<EngineEditor initialConfig={engineOn()} meta={META} />);
    fireEvent.change(screen.getByTestId('simulator-preset'), {
      target: { value: 'checkout' },
    });
    const decision = screen.getByTestId('simulator-decision');
    expect(decision.getAttribute('data-decision')).toBe('suppress');
    expect(decision.getAttribute('data-profile')).toBe('NEVER-CHECKOUT');
  });

  it('INV-13 : moteur off ⇒ suppress / engine-off', () => {
    render(<EngineEditor initialConfig={DEFAULT_ENGINE_CONFIG} meta={META} />);
    // Defaut: NEVER-FRESH armé, dwell du preset (5000) dépasse le seuil → on
    // atteint engine-off avec le preset "entry-mismatch" (dwell 5000).
    fireEvent.change(screen.getByTestId('simulator-preset'), {
      target: { value: 'entry-mismatch' },
    });
    const decision = screen.getByTestId('simulator-decision');
    expect(decision.getAttribute('data-decision')).toBe('suppress');
    expect(decision.getAttribute('data-reason')).toBe('engine-off');
  });

  it('INV-17 : trigger armé + breakpoint ⇒ show ; sans breakpoint ⇒ defer', () => {
    render(<EngineEditor initialConfig={engineOn()} meta={META} />);
    const decision = screen.getByTestId('simulator-decision');

    fireEvent.change(screen.getByTestId('simulator-preset'), {
      target: { value: 'entry-mismatch' },
    });
    expect(decision.getAttribute('data-decision')).toBe('show');

    fireEvent.change(screen.getByTestId('simulator-preset'), {
      target: { value: 'no-breakpoint' },
    });
    expect(decision.getAttribute('data-decision')).toBe('defer');
  });
});
