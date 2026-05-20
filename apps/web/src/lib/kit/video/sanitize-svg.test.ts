/**
 * Tests sanitize-svg — hygiène XSS + validation URL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sanitizeSvgInline, validateSvgUrl } from './sanitize-svg';

describe('sanitizeSvgInline — accepte les SVG valides', () => {
  it('accepte un SVG minimal avec viewBox', () => {
    const r = sanitizeSvgInline(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#E8EDE3"/></svg>',
    );
    expect(r.ok).toBe(true);
    expect(r.sanitized).toContain('<rect');
    expect(r.warnings).toEqual([]);
  });

  it('accepte un SVG avec gradient + filter', () => {
    const svg = `<svg viewBox="0 0 1080 1920">
      <defs>
        <radialGradient id="halo"><stop offset="0%" stop-color="#C8A876"/></radialGradient>
        <filter id="g"><feTurbulence baseFrequency="0.9"/></filter>
      </defs>
      <circle cx="540" cy="760" r="380" fill="url(#halo)"/>
    </svg>`;
    const r = sanitizeSvgInline(svg);
    expect(r.ok).toBe(true);
    expect(r.sanitized).toContain('radialGradient');
    expect(r.sanitized).toContain('feTurbulence');
  });

  it('accepte les animations SMIL <animate>', () => {
    const svg = `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="10">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="4s" repeatCount="indefinite"/>
      </circle>
    </svg>`;
    const r = sanitizeSvgInline(svg);
    expect(r.ok).toBe(true);
    expect(r.sanitized).toContain('<animate');
  });
});

describe('sanitizeSvgInline — strip les payloads XSS', () => {
  it('strip <script> inline', () => {
    const r = sanitizeSvgInline(
      '<svg viewBox="0 0 100 100"><script>alert(1)</script><rect/></svg>',
    );
    expect(r.ok).toBe(true);
    expect(r.sanitized).not.toContain('<script');
    expect(r.sanitized).not.toContain('alert');
    expect(r.warnings.join(' ')).toMatch(/script/i);
  });

  it('strip les attributs on* (onclick, onload, onmouseover)', () => {
    const r = sanitizeSvgInline(
      '<svg viewBox="0 0 100 100"><rect onclick="alert(1)" onload="x()" onmouseover="y()"/></svg>',
    );
    expect(r.ok).toBe(true);
    expect(r.sanitized).not.toMatch(/onclick/i);
    expect(r.sanitized).not.toMatch(/onload/i);
    expect(r.sanitized).not.toMatch(/onmouseover/i);
  });

  it('strip href="javascript:..."', () => {
    const r = sanitizeSvgInline(
      '<svg viewBox="0 0 100 100"><a href="javascript:alert(1)"><rect/></a></svg>',
    );
    expect(r.ok).toBe(true);
    expect(r.sanitized).not.toMatch(/javascript:/i);
  });

  it('strip style="expression(..)" et style avec js', () => {
    const r = sanitizeSvgInline(
      '<svg viewBox="0 0 100 100"><rect style="fill:expression(alert(1))"/></svg>',
    );
    expect(r.ok).toBe(true);
    // L'attribut `style` complet est forbidden (FORBID_ATTR).
    expect(r.sanitized).not.toMatch(/style\s*=/i);
  });
});

describe('sanitizeSvgInline — refuse les inputs invalides', () => {
  it('refuse une string vide', () => {
    const r = sanitizeSvgInline('');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/vide/i);
  });

  it('refuse une string qui ne commence pas par <svg', () => {
    const r = sanitizeSvgInline('<div>not svg</div>');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/<svg>/i);
  });

  it('refuse un SVG sans viewBox', () => {
    const r = sanitizeSvgInline('<svg><rect/></svg>');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/viewBox/i);
  });

  it('refuse un SVG > 50 kB', () => {
    const huge = `<svg viewBox="0 0 100 100">${'<rect/>'.repeat(10_000)}</svg>`;
    const r = sanitizeSvgInline(huge);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/volumineux/i);
  });

  it('refuse <image href="data:image/png;base64,..."> (bypass payload binaire)', () => {
    const svg = '<svg viewBox="0 0 100 100"><image href="data:image/png;base64,iVBORw0KGgo="/></svg>';
    const r = sanitizeSvgInline(svg);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/data:/i);
  });
});

describe('validateSvgUrl', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;
  });

  afterEach(() => {
    delete (globalThis as any).fetch;
  });

  it('refuse les URLs non HTTPS', async () => {
    const r = await validateSvgUrl('http://example.com/cover.svg');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/HTTPS/i);
  });

  it('refuse les URLs malformées', async () => {
    const r = await validateSvgUrl('not-a-url');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/invalide/i);
  });

  it('accepte un HEAD 200 avec content-type image/svg+xml', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'image/svg+xml', 'content-length': '4321' },
      }),
    );
    const r = await validateSvgUrl('https://cdn.example.com/cover.svg');
    expect(r.ok).toBe(true);
    expect(r.contentType).toBe('image/svg+xml');
    expect(r.size).toBe(4321);
  });

  it('refuse un content-type ≠ image/svg+xml', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const r = await validateSvgUrl('https://cdn.example.com/cover.png');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Content-Type/i);
  });

  it('refuse un SVG > 200 kB', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'image/svg+xml', 'content-length': '300000' },
      }),
    );
    const r = await validateSvgUrl('https://cdn.example.com/cover.svg');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/volumineux/i);
  });

  it('renvoie ok=false si HEAD retourne 404', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const r = await validateSvgUrl('https://cdn.example.com/missing.svg');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/404/);
  });

  it('renvoie ok=false sur erreur réseau', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const r = await validateSvgUrl('https://cdn.example.com/cover.svg');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/réseau|ECONNREFUSED/i);
  });
});
