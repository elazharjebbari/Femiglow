# 70.2 — Jest suite design

## Stack

- **Jest** comme runner (déjà utilisé dans le projet)
- **@testing-library/react** pour les composants
- **@testing-library/react-hooks** (ou `renderHook` de RTL v14+)
- **msw** pour mock API
- **@axe-core/react** pour a11y unit

## Configuration

`jest.config.legal.ts` :
```typescript
import baseConfig from '../jest.config';

export default {
  ...baseConfig,
  displayName: 'legal-pages',
  testMatch: [
    '**/lib/legal/**/*.test.ts',
    '**/components/legal/**/*.test.tsx',
    '**/hooks/useLegal*.test.ts',
    '**/app/api/admin/legal/**/*.test.ts',
    '**/app/api/legal/**/*.test.ts',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts',
    '<rootDir>/test/legal-setup.ts',
  ],
};
```

## Helpers tests

### `test/legal-fixtures.ts`

```typescript
export const FX_PAGES = {
  cgv: {
    id: 'lp_cgv1',
    slug: 'conditions-generales-de-vente',
    title: 'Conditions Générales de Vente',
    body_md: '# CGV\n\n…',
    status: 'published',
    version: 5,
    include_in_search: false,
    published_at: new Date('2026-04-01'),
  },
  // ... 9 pages
};

export const FX_VARS = {
  COMPANY_RC: 'RC 123456',
  ICE: '002000000123456',
  IF: '12345678',
  // ...
};

export const FX_ZONES = [
  { key: 'footer-main', is_active: true, ... },
  { key: 'footer-bottom-bar', is_active: true, ... },
  // ...
];
```

## Tests unitaires backend

### `src/lib/legal/render.test.ts`

```typescript
import { renderLegalMarkdown, substituteVars } from './render';
import { FX_VARS } from '@/test/legal-fixtures';

describe('substituteVars', () => {
  it('substitue les variables connues', () => {
    const md = 'RC : {{COMPANY_RC}}';
    expect(substituteVars(md, FX_VARS)).toBe('RC : RC 123456');
  });

  it('laisse les variables inconnues telles quelles en prod', () => {
    const md = 'RC : {{UNKNOWN_VAR}}';
    expect(substituteVars(md, FX_VARS)).toBe('RC : {{UNKNOWN_VAR}}');
  });

  it('hauteur missing en mode preview', () => {
    const md = 'RC : {{UNKNOWN_VAR}}';
    expect(substituteVars(md, FX_VARS, { highlightMissing: true }))
      .toContain('<span class="var-missing">');
  });
});

describe('renderLegalMarkdown', () => {
  it('rend le markdown en HTML safe', async () => {
    const html = await renderLegalMarkdown('# Test\n\nHello');
    expect(html).toContain('<h1>Test</h1>');
    expect(html).toContain('<p>Hello</p>');
  });

  it('strip les scripts (XSS protection)', async () => {
    const html = await renderLegalMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('garde les liens https valides', async () => {
    const html = await renderLegalMarkdown('[Lien](https://femiglow.ma)');
    expect(html).toContain('<a href="https://femiglow.ma">');
  });

  it('strip les liens javascript:', async () => {
    const html = await renderLegalMarkdown('[X](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });
});

describe('detectMissingVars', () => {
  it('retourne les variables obligatoires manquantes', async () => {
    const result = await detectMissingVars('{{COMPANY_RC}} et {{ICE}}', {
      COMPANY_RC: '', // empty = missing
      ICE: '002...',
    });
    expect(result).toEqual([{ key: 'COMPANY_RC', required: true }]);
  });
});
```

### `src/lib/legal/publish.test.ts`

```typescript
import { publishPage } from './publish';

describe('publishPage', () => {
  beforeEach(async () => {
    await db.legalPages.deleteMany({});
    await seedTestPages();
  });

  it('incrémente la version', async () => {
    const before = await db.legalPages.findBySlug('cgv');
    expect(before.version).toBe(1);

    await publishPage('cgv', 'u_admin1', 'PUBLIER');

    const after = await db.legalPages.findBySlug('cgv');
    expect(after.version).toBe(2);
    expect(after.status).toBe('published');
  });

  it('crée une entrée immutable dans history', async () => {
    await publishPage('cgv', 'u_admin1', 'PUBLIER');
    const history = await db.legalPagesHistory.findAll({ slug: 'cgv' });
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(2);
  });

  it('rejette si confirm text incorrect', async () => {
    await expect(publishPage('cgv', 'u_admin1', 'oui')).rejects.toThrow(/confirm/i);
  });

  it('rejette si variables obligatoires manquantes', async () => {
    await db.legalPages.update('cgv', { body_md: 'Hello {{MISSING_REQUIRED}}' });
    await expect(publishPage('cgv', 'u_admin1', 'PUBLIER')).rejects.toThrow(/missing_required_vars/);
  });

  it('rejette depuis statut archived', async () => {
    await db.legalPages.update('cgv', { status: 'archived' });
    await expect(publishPage('cgv', 'u_admin1', 'PUBLIER')).rejects.toThrow(/state/i);
  });

  it('enregistre un audit event', async () => {
    await publishPage('cgv', 'u_admin1', 'PUBLIER');
    const events = await db.auditEvents.findAll({ action: 'legal.published' });
    expect(events.length).toBeGreaterThan(0);
  });
});
```

### `src/lib/legal/link-verifier.test.ts`

```typescript
import { verifyLink } from './link-verifier';

jest.mock('node-fetch');

describe('verifyLink', () => {
  it('détecte 200 OK', async () => {
    mockFetch(200);
    const result = await verifyLink('https://example.com');
    expect(result.ok).toBe(true);
  });

  it('détecte 404', async () => {
    mockFetch(404);
    const result = await verifyLink('https://example.com/x');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it('détecte timeout', async () => {
    mockFetchTimeout();
    const result = await verifyLink('https://slow.example.com', { timeoutMs: 100 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timeout/i);
  });

  it('résout les liens internes via DB lookup', async () => {
    await seedTestPages();
    const result = await verifyLink('/legal/cgv');
    expect(result.ok).toBe(true);
  });

  it('marque les liens vers pages archivées comme cassés', async () => {
    await db.legalPages.update('old-page', { status: 'archived' });
    const result = await verifyLink('/legal/old-page');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('page_archived');
  });
});
```

## Tests composants

### `components/LegalPageEditor.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LegalPageEditor } from './LegalPageEditor';

describe('LegalPageEditor', () => {
  it('rend les 2 panneaux MD + preview', () => {
    render(<LegalPageEditor page={FX_PAGES.cgv} />);
    expect(screen.getByLabelText(/markdown/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/aperçu/i)).toBeInTheDocument();
  });

  it('met à jour le preview au changement MD', async () => {
    render(<LegalPageEditor page={FX_PAGES.cgv} />);
    const editor = screen.getByLabelText(/markdown/i);
    fireEvent.change(editor, { target: { value: '# Nouveau titre\n\nNouveau contenu' } });
    await waitFor(() => {
      expect(screen.getByText('Nouveau titre')).toBeInTheDocument();
    });
  });

  it('bloque publish si variables manquantes', async () => {
    render(<LegalPageEditor page={{ ...FX_PAGES.cgv, body_md: '{{MISSING}}' }} />);
    fireEvent.click(screen.getByText(/publier/i));
    expect(await screen.findByText(/variables manquantes/i)).toBeInTheDocument();
  });

  it('auto-save après interval', async () => {
    jest.useFakeTimers();
    const onSave = jest.fn();
    render(<LegalPageEditor page={FX_PAGES.cgv} onSave={onSave} />);
    const editor = screen.getByLabelText(/markdown/i);
    fireEvent.change(editor, { target: { value: '# Modifié' } });
    jest.advanceTimersByTime(30_000);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    jest.useRealTimers();
  });
});
```

### `components/FooterLegalLinks.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { FooterLegalLinks } from './FooterLegalLinks';
import { server } from '@/test/msw';
import { http, HttpResponse } from 'msw';

describe('FooterLegalLinks', () => {
  it('rend les liens depuis API', async () => {
    server.use(
      http.get('/api/legal/placements/footer-main', () =>
        HttpResponse.json([
          { slug: 'mentions-legales', title: 'Mentions légales' },
          { slug: 'cgv', title: 'CGV' },
        ]),
      ),
    );

    render(<FooterLegalLinks zone="footer-main" />);

    expect(await screen.findByText('Mentions légales')).toHaveAttribute(
      'href',
      '/legal/mentions-legales',
    );
    expect(screen.getByText('CGV')).toHaveAttribute('href', '/legal/cgv');
  });

  it('rend un fallback si API down', async () => {
    server.use(
      http.get('/api/legal/placements/footer-main', () =>
        HttpResponse.error(),
      ),
    );

    render(<FooterLegalLinks zone="footer-main" />);
    await screen.findByText('Mentions légales'); // fallback statique
  });
});
```

## Tests hooks

### `hooks/useLegalEditorAutoSave.test.ts`

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLegalEditorAutoSave } from './useLegalEditorAutoSave';

describe('useLegalEditorAutoSave', () => {
  it('saves after interval', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const { result } = renderHook(() =>
      useLegalEditorAutoSave('cgv', 'body', { intervalMs: 50 }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 200 });
    expect(result.current.lastSavedAt).toBeTruthy();
  });

  it('cancels previous timer on body change', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const { rerender } = renderHook(
      ({ body }) => useLegalEditorAutoSave('cgv', body, { intervalMs: 100 }),
      { initialProps: { body: 'v1' } },
    );

    setTimeout(() => rerender({ body: 'v2' }), 50);

    await new Promise(r => setTimeout(r, 200));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).body_md).toBe('v2');
  });
});
```

## Coverage targets

- Lines : ≥ 85%
- Branches : ≥ 80%
- Critical paths (publish, render, RBAC) : 100%

## Performance

- Suite Jest : < 30s en local
- Parallélisation : `--maxWorkers=50%`
- Pas de DB partagée — chaque test cleanup ses fixtures
