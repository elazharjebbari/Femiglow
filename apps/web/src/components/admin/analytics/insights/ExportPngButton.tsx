/**
 * Bouton "Exporter PNG" pour un chart SVG.
 * cf. docs/analytics-insights/08-filtres-exports.md §7
 */
'use client';

import { useState, type RefObject } from 'react';
import { downloadBlob, exportSvgAsPngBlob } from '@/lib/analytics/insights/png-export';

interface Props {
  svgRef: RefObject<SVGSVGElement>;
  filename: string;
}

export function ExportPngButton({ svgRef, filename }: Props) {
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (!svgRef.current) return;
    setBusy(true);
    try {
      const blob = await exportSvgAsPngBlob(svgRef.current);
      downloadBlob(blob, filename);
    } catch {
      // pas de toast V1 — silencieux pour ne pas saturer
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-xs font-medium text-stone-600 underline hover:text-stone-900 disabled:opacity-50"
      data-testid="export-png"
    >
      {busy ? 'Génération…' : 'Exporter PNG'}
    </button>
  );
}
