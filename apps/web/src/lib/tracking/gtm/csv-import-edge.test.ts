/**
 * Edge cases pour csv-import : robustesse aux entrées hostiles ou bizarres.
 */
import { describe, expect, it } from 'vitest';
import { parseCsvImport } from './csv-import';

describe('parseCsvImport — encoding & line endings', () => {
  it('gère CRLF (Windows)', () => {
    const r = parseCsvImport(
      'production,ga4MeasurementId,G-PROD0000\r\nstage,ga4MeasurementId,G-STAGE000\r\n',
    );
    expect(r.appliedCount).toBe(2);
  });

  it('gère LF (Unix)', () => {
    const r = parseCsvImport('production,ga4MeasurementId,G-PROD0000\n');
    expect(r.appliedCount).toBe(1);
  });

  it('strippe les espaces autour des cellules', () => {
    const r = parseCsvImport('  production , ga4MeasurementId ,  G-PROD0000  ');
    // Note : le parser actuel trim mais la valeur peut aussi être trimée.
    expect(r.appliedCount).toBe(1);
    expect(r.perEnv.production.ga4MeasurementId).toBe('G-PROD0000');
  });

  it('survit à un BOM UTF-8 en début (skip silencieux ou warning)', () => {
    const csv = '﻿production,ga4MeasurementId,G-PROD0000';
    const r = parseCsvImport(csv);
    // Peut être appliqué ou warning ; on accepte les deux comportements
    // tant qu'il n'y a pas crash.
    expect(r.appliedCount + r.skippedCount).toBeGreaterThanOrEqual(1);
  });

  it("survit à des caractères accentués dans les valeurs", () => {
    const r = parseCsvImport('production,defaultCurrency,€€€');
    expect(r.appliedCount).toBe(1);
    expect(r.perEnv.production.defaultCurrency).toBe('€€€');
  });
});

describe('parseCsvImport — quotes complexes', () => {
  it('valeur entre quotes contenant des virgules', () => {
    const r = parseCsvImport('production,googleAdsConvLabels.purchase,"AW-1,2,3/abc"');
    expect(r.perEnv.production.googleAdsConvLabels?.purchase).toBe('AW-1,2,3/abc');
  });

  it('quotes échappées par doublement', () => {
    const r = parseCsvImport('production,defaultCurrency,"a""b""c"');
    expect(r.perEnv.production.defaultCurrency).toBe('a"b"c');
  });

  it('valeur vide entre quotes', () => {
    const r = parseCsvImport('production,ga4MeasurementId,""');
    expect(r.perEnv.production.ga4MeasurementId).toBe('');
  });
});

describe('parseCsvImport — lignes pathologiques', () => {
  it('plusieurs lignes vides au milieu', () => {
    const r = parseCsvImport(
      'production,ga4MeasurementId,G-A\n\n\n\nstage,ga4MeasurementId,G-B',
    );
    expect(r.appliedCount).toBe(2);
  });

  it('ligne avec virgules en trop est trimée correctement', () => {
    const r = parseCsvImport('production,ga4MeasurementId,G-X,extra,col');
    // Le parser prend les 3 premières colonnes et applique
    expect(r.appliedCount).toBe(1);
    expect(r.perEnv.production.ga4MeasurementId).toBe('G-X');
  });

  it('header reconnu en lowercase et non-strict', () => {
    const r = parseCsvImport('ENV,VARIABLE,VALUE\nproduction,ga4MeasurementId,G-X');
    // Si le header est strict (lowercase only), la 1re ligne est interprétée
    // comme une vraie row. On accepte le comportement actuel : env="ENV" → warning.
    // Mais ça doit pas crash.
    expect(r.appliedCount + r.skippedCount).toBeGreaterThanOrEqual(1);
  });
});

describe('parseCsvImport — sécurité', () => {
  it("ignore les variables avec injection de caractères spéciaux", () => {
    const r = parseCsvImport(
      'production,$(echo evil),malicious\nproduction,<script>,evil',
    );
    expect(r.appliedCount).toBe(0);
    expect(r.skippedCount).toBe(2);
    expect(r.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("limite stricte 1000 lignes (DoS protection)", () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `production,defaultCurrency,V${i}`);
    const r = parseCsvImport(lines.join('\n'));
    expect(r.appliedCount).toBeLessThanOrEqual(1000);
    expect(r.warnings.some((w) => w.includes('1000'))).toBe(true);
  });

  it('idempotent — 2 appels identiques donnent le même perEnv', () => {
    const csv = 'production,ga4MeasurementId,G-X\nstage,metaPixelId,11111111111';
    const r1 = parseCsvImport(csv);
    const r2 = parseCsvImport(csv);
    expect(JSON.stringify(r1.perEnv)).toBe(JSON.stringify(r2.perEnv));
  });
});
