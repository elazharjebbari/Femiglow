/**
 * Tests pour png-export.ts
 *
 * jsdom ne supporte pas canvas.toBlob ni Image décode → on mock juste les
 * APIs critiques pour vérifier le wiring.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  // Mock URL.createObjectURL
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('downloadBlob', () => {
  it("crée un <a> avec download attribute et click", async () => {
    const { downloadBlob } = await import('./png-export');
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const blob = new Blob(['x'], { type: 'image/png' });
    downloadBlob(blob, 'test.png');
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('serializeSvgForExport / svgExportDimensions (F-INS-05)', () => {
  it('ajoute xmlns + width/height explicites sur le SVG sérialisé', async () => {
    const { serializeSvgForExport } = await import('./png-export');
    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    ) as SVGSVGElement;
    svg.setAttribute('viewBox', '0 0 640 480');
    const xml = serializeSvgForExport(svg);
    expect(xml).toContain('http://www.w3.org/2000/svg'); // namespace présent
    expect(xml).toMatch(/width="\d+"/);
    expect(xml).toMatch(/height="\d+"/);
  });

  it('dimensions : fallback borné ≥ 1 quand aucune taille connue', async () => {
    const { svgExportDimensions } = await import('./png-export');
    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    ) as SVGSVGElement;
    const { width, height } = svgExportDimensions(svg);
    expect(width).toBeGreaterThanOrEqual(1);
    expect(height).toBeGreaterThanOrEqual(1);
  });
});

describe('exportSvgAsPngBlob — rejet si Image échoue (jsdom)', () => {
  it('rejette quand le chargement de l’Image échoue', async () => {
    const { exportSvgAsPngBlob } = await import('./png-export');
    // jsdom ne décode pas le SVG : on simule un échec de chargement déterministe
    // (sinon onload/onerror ne sont jamais appelés → timeout).
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', FailingImage);

    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    ) as SVGSVGElement;
    svg.setAttribute('viewBox', '0 0 100 100');
    document.body.appendChild(svg);
    await expect(exportSvgAsPngBlob(svg)).rejects.toBeDefined();
    document.body.removeChild(svg);
  });
});
