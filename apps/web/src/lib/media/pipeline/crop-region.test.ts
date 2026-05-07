/**
 * Tests unitaires — `computeCropRegion` & `parseAspectRatio`.
 *
 * Couvre :
 *   - parsing des ratios sous formes `'4/5'`, `'16:9'`, valeurs invalides ;
 *   - early-return si la source est déjà au bon ratio (tolérance) ;
 *   - calcul du rectangle pour source plus large (paysage → 1/1) ;
 *   - calcul pour source plus haute (portrait → 16/9) ;
 *   - centrage par défaut (focal 50/50) ;
 *   - décalage du focal point (clamp 0..100, et clamp aux bornes source) ;
 *   - tolérance personnalisée.
 */
import { describe, it, expect } from 'vitest';
import { computeCropRegion, parseAspectRatio } from './crop-region';

describe('parseAspectRatio', () => {
  it('parse `4/5` → 0.8', () => {
    expect(parseAspectRatio('4/5')).toBeCloseTo(0.8, 5);
  });

  it('parse `16:9` → 1.777…', () => {
    expect(parseAspectRatio('16:9')).toBeCloseTo(16 / 9, 5);
  });

  it('parse avec espaces autour', () => {
    expect(parseAspectRatio('  1 / 1  ')).toBe(1);
  });

  it('rejette les valeurs invalides', () => {
    expect(parseAspectRatio('abc')).toBeNull();
    expect(parseAspectRatio('1/0')).toBeNull();
    expect(parseAspectRatio('0/1')).toBeNull();
    expect(parseAspectRatio('')).toBeNull();
    expect(parseAspectRatio('4-5')).toBeNull();
  });
});

describe('computeCropRegion', () => {
  it('renvoie null si la source est déjà au bon ratio (dans la tolérance)', () => {
    expect(
      computeCropRegion({
        sourceWidth: 800,
        sourceHeight: 1000,
        targetAspectRatio: '4/5',
      }),
    ).toBeNull();
  });

  it('renvoie null si la source est très proche (< tolérance par défaut)', () => {
    // 801x1000 → ratio 0.801 vs target 0.8 → 0.125 % d'écart, dans 0.5 %.
    expect(
      computeCropRegion({
        sourceWidth: 801,
        sourceHeight: 1000,
        targetAspectRatio: '4/5',
      }),
    ).toBeNull();
  });

  it('source paysage 1600×900 vers 1/1 → carré centré 900×900', () => {
    const r = computeCropRegion({
      sourceWidth: 1600,
      sourceHeight: 900,
      targetAspectRatio: '1/1',
    });
    expect(r).not.toBeNull();
    expect(r!.width).toBe(900);
    expect(r!.height).toBe(900);
    // Centré horizontalement : (1600 - 900) / 2 = 350.
    expect(r!.left).toBe(350);
    expect(r!.top).toBe(0);
  });

  it('source portrait 800×1600 vers 16/9 → 800×450 centré', () => {
    const r = computeCropRegion({
      sourceWidth: 800,
      sourceHeight: 1600,
      targetAspectRatio: '16/9',
    });
    expect(r).not.toBeNull();
    expect(r!.width).toBe(800);
    expect(r!.height).toBe(450);
    expect(r!.left).toBe(0);
    // Centré verticalement : (1600 - 450) / 2 = 575.
    expect(r!.top).toBe(575);
  });

  it('focal point hors centre : décale le crop côté focal', () => {
    // Source 1600x900 → target 1/1 (900x900). Focal X=80 % → centre=1280px.
    // Crop centré : left=1280-450=830 ; mais clamp à sW-cropW=700.
    const r = computeCropRegion({
      sourceWidth: 1600,
      sourceHeight: 900,
      targetAspectRatio: '1/1',
      focalX: 80,
      focalY: 50,
    });
    expect(r!.left).toBe(700); // clampé à droite
    expect(r!.top).toBe(0);
  });

  it('focal point bien à l’intérieur des bornes : décale réellement', () => {
    // Source 1600x900 → 1/1 (900x900). Focal X=60 % → centre=960.
    // left = 960 - 450 = 510 (sW-cropW=700, donc pas clampé).
    const r = computeCropRegion({
      sourceWidth: 1600,
      sourceHeight: 900,
      targetAspectRatio: '1/1',
      focalX: 60,
    });
    expect(r!.left).toBe(510);
  });

  it('focalX/Y hors plage sont clampés à 0..100', () => {
    const r = computeCropRegion({
      sourceWidth: 1600,
      sourceHeight: 900,
      targetAspectRatio: '1/1',
      focalX: 999,
      focalY: -50,
    });
    // focalX=100 → centre=1600 → left=1150 → clamp à 700.
    expect(r!.left).toBe(700);
    expect(r!.top).toBe(0);
  });

  it('focal NaN tombe sur 50/50', () => {
    const r = computeCropRegion({
      sourceWidth: 1600,
      sourceHeight: 900,
      targetAspectRatio: '1/1',
      focalX: Number.NaN,
    });
    expect(r!.left).toBe(350);
  });

  it('targetAspectRatio invalide → null', () => {
    expect(
      computeCropRegion({
        sourceWidth: 1000,
        sourceHeight: 1000,
        targetAspectRatio: 'not-a-ratio',
      }),
    ).toBeNull();
  });

  it('source dégénérée (w=0) → null', () => {
    expect(
      computeCropRegion({
        sourceWidth: 0,
        sourceHeight: 100,
        targetAspectRatio: '1/1',
      }),
    ).toBeNull();
  });

  it('tolérance personnalisée plus stricte → crop même pour petite déviation', () => {
    // 801x1000 normalement skipped (< 0.5 %). Avec tolerance=0 → on crope.
    const r = computeCropRegion({
      sourceWidth: 801,
      sourceHeight: 1000,
      targetAspectRatio: '4/5',
      toleranceRatio: 0,
    });
    expect(r).not.toBeNull();
  });

  it('triptyque wide-and-short 3000×600 vers 4/5 → crop intense', () => {
    // Cas réel : un triptyque 3000x600 affiché en carte 4/5 doit être recadré
    // fortement au centre pour ne pas avoir de letterbox.
    const r = computeCropRegion({
      sourceWidth: 3000,
      sourceHeight: 600,
      targetAspectRatio: '4/5',
    });
    expect(r).not.toBeNull();
    // sourceRatio=5 > target=0.8 → cropH=600, cropW=600*0.8=480.
    expect(r!.width).toBe(480);
    expect(r!.height).toBe(600);
    expect(r!.left).toBe(1260); // (3000-480)/2
    expect(r!.top).toBe(0);
  });
});
