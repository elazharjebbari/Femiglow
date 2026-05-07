import { describe, expect, it } from 'vitest';

import { buildCsv, type CsvColumn } from './ExportCsvButton';

interface Row {
  source: string;
  sessions: number;
  note?: string;
}

const cols: CsvColumn<Row>[] = [
  { key: 'source', label: 'Source' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'note', label: 'Note' },
];

describe('buildCsv', () => {
  it('generates header + rows separated by CRLF', () => {
    const rows: Row[] = [
      { source: 'google', sessions: 120, note: 'ok' },
      { source: 'direct', sessions: 50 },
    ];
    const csv = buildCsv(rows, cols);
    expect(csv).toBe('Source,Sessions,Note\r\ngoogle,120,ok\r\ndirect,50,');
  });

  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    const rows: Row[] = [
      { source: 'a,b', sessions: 1, note: 'has "quote"\nand newline' },
    ];
    const csv = buildCsv(rows, cols);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"has ""quote""\nand newline"');
  });

  it('uses accessor when provided', () => {
    const colsWithAcc: CsvColumn<Row>[] = [
      { key: 'source', label: 'S', accessor: (r) => r.source.toUpperCase() },
    ];
    const csv = buildCsv([{ source: 'foo', sessions: 1 }], colsWithAcc);
    expect(csv).toContain('FOO');
  });

  it('treats null/undefined as empty string', () => {
    const csv = buildCsv([{ source: 'x', sessions: 0 }], cols);
    expect(csv.endsWith(',')).toBe(true); // empty note column
  });
});
