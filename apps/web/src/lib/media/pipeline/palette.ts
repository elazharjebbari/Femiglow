import sharp from 'sharp';
import type { PaletteEntry } from '@/lib/db/types';

const SAMPLE_SIZE = 64;
const K = 3;
const MAX_ITERATIONS = 10;

interface RGB {
  r: number;
  g: number;
  b: number;
}

function distanceSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function clusterMean(points: RGB[]): RGB {
  if (points.length === 0) return { r: 0, g: 0, b: 0 };
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of points) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  return {
    r: Math.round(r / points.length),
    g: Math.round(g / points.length),
    b: Math.round(b / points.length),
  };
}

export async function computePalette(buffer: Buffer): Promise<PaletteEntry[]> {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += channels) {
    pixels.push({ r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 });
  }
  if (pixels.length === 0) return [];

  let centroids: RGB[] = [];
  const step = Math.max(1, Math.floor(pixels.length / K));
  for (let i = 0; i < K; i += 1) {
    centroids.push(pixels[i * step] ?? pixels[0]!);
  }

  for (let iter = 0; iter < MAX_ITERATIONS; iter += 1) {
    const buckets: RGB[][] = Array.from({ length: K }, () => []);
    for (const p of pixels) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < K; i += 1) {
        const d = distanceSq(p, centroids[i]!);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      buckets[best]!.push(p);
    }
    const next = buckets.map((b) => clusterMean(b));
    let stable = true;
    for (let i = 0; i < K; i += 1) {
      if (distanceSq(next[i]!, centroids[i]!) > 1) stable = false;
    }
    centroids = next;
    if (stable) break;
  }

  const total = pixels.length;
  const palette: PaletteEntry[] = centroids.map((c, i) => {
    const count = pixels.filter((p) => {
      let best = 0;
      let bestDist = Infinity;
      for (let j = 0; j < K; j += 1) {
        const d = distanceSq(p, centroids[j]!);
        if (d < bestDist) {
          bestDist = d;
          best = j;
        }
      }
      return best === i;
    }).length;
    const hex = `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    return { ...c, hex, weight: count / total };
  });
  return palette.sort((a, b) => b.weight - a.weight);
}
