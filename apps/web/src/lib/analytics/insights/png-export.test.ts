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

describe('exportSvgAsPngBlob — limites jsdom', () => {
  it('throw si toBlob non supporté (jsdom canvas)', async () => {
    const { exportSvgAsPngBlob } = await import('./png-export');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    document.body.appendChild(svg);
    // En jsdom, Image.onload n'est jamais appelé → la promesse rejette
    // Donc on s'attend à une erreur
    await expect(exportSvgAsPngBlob(svg)).rejects.toBeDefined();
    document.body.removeChild(svg);
  });
});
