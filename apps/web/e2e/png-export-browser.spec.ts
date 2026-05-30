/**
 * Vérification NAVIGATEUR (Chromium) du pipeline d'export PNG (F-INS-05) — ce que
 * jsdom ne peut pas tester (pas de rendu canvas ni de décodage d'Image).
 *
 * Reproduit `serializeSvgForExport` + `exportSvgAsPngBlob` : SVG (xmlns +
 * width/height explicites) → Image → canvas → PNG. On vérifie que l'image se
 * charge, que le PNG est valide, et qu'il n'est PAS vide (pixels réellement
 * dessinés, hors fond) — i.e. l'export ne produit pas une image blanche.
 *
 * Autonome : aucun serveur, aucune auth admin, aucune base requise.
 */
import { test, expect } from '@playwright/test';

// SVG type « chart » : titre + courbe (contenu non-fond mesurable).
const SAMPLE_SVG_INNER =
  '<rect width="640" height="480" fill="#ffffff"></rect>' +
  '<text x="40" y="60" font-size="28" fill="#111111">FemiGlow — Funnel</text>' +
  '<polyline points="40,420 180,260 340,320 520,120 600,90" fill="none" stroke="#c0392b" stroke-width="6"></polyline>';

test('F-INS-05 — export PNG dans un vrai navigateur produit une image valide non vide', async ({
  page,
}) => {
  await page.setContent('<!doctype html><html><body></body></html>');

  const res = await page.evaluate(async (inner: string) => {
    const NS = 'http://www.w3.org/2000/svg';

    // 1) Construire un SVG (comme un chart Recharts dans le DOM).
    const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
    svg.setAttribute('viewBox', '0 0 640 480');
    svg.innerHTML = inner;
    document.body.appendChild(svg);

    // 2) serializeSvgForExport : clone + xmlns + width/height explicites.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', NS);
    clone.setAttribute('width', '640');
    clone.setAttribute('height', '480');
    const xml = new XMLSerializer().serializeToString(clone);
    const hasXmlns = xml.includes('http://www.w3.org/2000/svg');

    // 3) Charger comme Image (échoue si SVG mal formé / sans namespace).
    const blob = new Blob(['<?xml version="1.0" standalone="no"?>\r\n', xml], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    if (!loaded) {
      URL.revokeObjectURL(url);
      return { loaded: false, hasXmlns, pngLen: 0, nonBgPixels: 0 };
    }

    // 4) Dessiner sur canvas (fond crème) puis exporter en PNG.
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FBF8F1';
    ctx.fillRect(0, 0, 640, 480);
    ctx.drawImage(img, 0, 0, 640, 480);
    URL.revokeObjectURL(url);

    const pngLen = canvas.toDataURL('image/png').length;

    // 5) Mesurer le contenu réellement dessiné (pixels qui s'écartent du fond).
    const data = ctx.getImageData(0, 0, 640, 480).data;
    let nonBgPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const d =
        Math.abs(data[i]! - 251) + Math.abs(data[i + 1]! - 248) + Math.abs(data[i + 2]! - 241);
      if (d > 40) nonBgPixels += 1;
    }
    return { loaded: true, hasXmlns, pngLen, nonBgPixels };
  }, SAMPLE_SVG_INNER);

  expect(res.hasXmlns).toBe(true); // namespace présent dans le SVG sérialisé
  expect(res.loaded).toBe(true); // l'Image SVG s'est bien chargée dans Chromium
  expect(res.pngLen).toBeGreaterThan(1000); // PNG non trivial
  expect(res.nonBgPixels).toBeGreaterThan(500); // titre + courbe réellement dessinés (non blanc)
});
