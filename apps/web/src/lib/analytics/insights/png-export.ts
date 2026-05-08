/**
 * Export PNG d'un élément SVG en client.
 * cf. docs/analytics-insights/08-filtres-exports.md §7
 *
 * Pattern : sérialise le DOM SVG, dessine sur un canvas, convertit en Blob.
 * - Background crème FemiGlow par défaut
 * - DPR ×2 pour rendu retina-friendly
 * - Pas d'import de lib externe (Image, Canvas natifs)
 */
const DEFAULT_BG = '#FBF8F1';

export async function exportSvgAsPngBlob(
  svg: SVGSVGElement,
  options: { backgroundColor?: string; scale?: number } = {},
): Promise<Blob> {
  const scale = options.scale ?? 2;
  const bg = options.backgroundColor ?? DEFAULT_BG;
  const width = svg.viewBox.baseVal.width || svg.clientWidth || 800;
  const height = svg.viewBox.baseVal.height || svg.clientHeight || 320;

  const xml = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob(['<?xml version="1.0" standalone="no"?>\r\n', xml], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
        'image/png',
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
