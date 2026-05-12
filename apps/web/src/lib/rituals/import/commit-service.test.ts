import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { commitImportBatch } from './commit-service';

beforeEach(() => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();
});

afterEach(() => {
  resetMemoryStore();
});

const VALID_CSV =
  'body;wouldRecommend\n' +
  '"' +
  'a'.repeat(60) +
  '";oui\n' +
  '"' +
  'b'.repeat(60) +
  '";hesite\n';

describe('commitImportBatch', () => {
  it('commit 2 rows depuis CSV', async () => {
    const result = await commitImportBatch(
      { format: 'csv', content: VALID_CSV },
      { actorId: 'admin-1' },
    );
    expect(result.totalParsed).toBe(2);
    expect(result.totalCommitted).toBe(2);
    expect(result.totalError).toBe(0);
    const stored = Array.from(memoryStore().ritualTestimonials.values());
    expect(stored).toHaveLength(2);
    expect(stored.every((r) => r.status === 'PENDING')).toBe(true);
    expect(stored.every((r) => r.source === 'import_csv')).toBe(true);
    expect(stored.every((r) => r.importBatchId === result.batchId)).toBe(true);
  });

  it('audit `imported` par row + audit global', async () => {
    await commitImportBatch(
      { format: 'csv', content: VALID_CSV },
      { actorId: 'admin-1' },
    );
    const audit = Array.from(memoryStore().ritualAuditLog.values());
    expect(audit.filter((e) => e.action === 'imported')).toHaveLength(2);
    expect(audit.filter((e) => e.action === 'import_committed')).toHaveLength(1);
  });

  it('skip les rows ERROR', async () => {
    const csv =
      'body;wouldRecommend\n' +
      '"' +
      'a'.repeat(60) +
      '";oui\n' +
      'court;oui\n' +
      '"' +
      'b'.repeat(60) +
      '";\n';
    const result = await commitImportBatch(
      { format: 'csv', content: csv },
      { actorId: 'admin-1' },
    );
    expect(result.totalCommitted).toBe(1);
    expect(result.totalError).toBe(2);
  });

  it('JSON array racine', async () => {
    const json = JSON.stringify([
      { body: 'a'.repeat(60), wouldRecommend: 'oui' },
    ]);
    const result = await commitImportBatch(
      { format: 'json', content: json },
      { actorId: 'admin-1' },
    );
    expect(result.totalCommitted).toBe(1);
    const stored = Array.from(memoryStore().ritualTestimonials.values());
    expect(stored[0]?.source).toBe('import_json');
  });

  it('JSONL ligne par ligne', async () => {
    const jsonl =
      `{"body":"${'a'.repeat(60)}","wouldRecommend":"oui"}\n` +
      `{"body":"${'b'.repeat(60)}","wouldRecommend":"non"}\n`;
    const result = await commitImportBatch(
      { format: 'jsonl', content: jsonl },
      { actorId: 'admin-1' },
    );
    expect(result.totalCommitted).toBe(2);
  });

  it('warnings → flag import_{code}', async () => {
    const csv =
      'body;wouldRecommend;ritualTags\n' +
      '"' +
      'a'.repeat(60) +
      '";oui;patience\n';
    await commitImportBatch(
      { format: 'csv', content: csv },
      { actorId: 'admin-1' },
    );
    const ritual = Array.from(memoryStore().ritualTestimonials.values())[0];
    expect(ritual?.autoFlags).toContain('import_tag_unknown');
  });

  it('importNote propagée à l’audit global', async () => {
    await commitImportBatch(
      { format: 'csv', content: VALID_CSV, importNote: 'Lot WhatsApp mai 2026' },
      { actorId: 'admin-1' },
    );
    const audit = Array.from(memoryStore().ritualAuditLog.values()).find(
      (e) => e.action === 'import_committed',
    );
    expect(audit?.note).toBe('Lot WhatsApp mai 2026');
  });
});
