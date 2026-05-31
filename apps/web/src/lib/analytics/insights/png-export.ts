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
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Dimensions de rendu d'un SVG (viewBox > taille DOM > défaut), bornées ≥ 1. */
export function svgExportDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox?.baseVal;
  const width = (vb?.width || svg.clientWidth || 800);
  const height = (vb?.height || svg.clientHeight || 320);
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

/**
 * Sérialise un SVG en XML autonome **robuste** pour l'export image (F-INS-05) :
 * sur un clone, on force `xmlns` (sans quoi le SVG ne se charge pas comme `Image`
 * dans plusieurs navigateurs → export blanc/échec) et des `width`/`height`
 * explicites (sinon la taille naturelle est indéterminée → mise à l'échelle KO).
 */
export function serializeSvgForExport(svg: SVGSVGElement): string {
  const { width, height } = svgExportDimensions(svg);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  return new XMLSerializer().serializeToString(clone);
}

export async function exportSvgAsPngBlob(
  svg: SVGSVGElement,
  options: { backgroundColor?: string; scale?: number } = {},
): Promise<Blob> {
  const scale = options.scale ?? 2;
  const bg = options.backgroundColor ?? DEFAULT_BG;
  const { width, height } = svgExportDimensions(svg);

  const xml = serializeSvgForExport(svg);
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
