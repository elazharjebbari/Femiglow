import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { ExportPngButton } from './ExportPngButton';

vi.mock('@/lib/analytics/insights/png-export', () => ({
  exportSvgAsPngBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  downloadBlob: vi.fn(),
}));

import { exportSvgAsPngBlob, downloadBlob } from '@/lib/analytics/insights/png-export';

function Harness({ filename = 'test.png' }: { filename?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  return (
    <>
      <svg ref={ref} viewBox="0 0 100 100" data-testid="svg" />
      <ExportPngButton svgRef={ref} filename={filename} />
    </>
  );
}

describe('ExportPngButton', () => {
  it('rend un bouton "Exporter PNG"', () => {
    render(<Harness />);
    expect(screen.getByTestId('export-png')).toHaveTextContent('Exporter PNG');
  });

  it('clic appelle exportSvgAsPngBlob + downloadBlob', async () => {
    vi.mocked(downloadBlob).mockClear();
    vi.mocked(exportSvgAsPngBlob).mockClear();
    render(<Harness filename="my-chart.png" />);
    fireEvent.click(screen.getByTestId('export-png'));
    await waitFor(() => {
      expect(exportSvgAsPngBlob).toHaveBeenCalled();
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'my-chart.png');
    });
  });

  it('label change pendant la génération puis revient', async () => {
    render(<Harness />);
    const btn = screen.getByTestId('export-png');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveTextContent('Exporter PNG');
    });
  });
});
