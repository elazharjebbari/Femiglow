import { describe, expect, it } from 'vitest';
import { externalAdapter } from './external';

describe('storage.external', () => {
  it('put accepte une URL https publique', async () => {
    const result = await externalAdapter.put({
      key: 'https://example.com/img.jpg',
      body: Buffer.alloc(0),
      contentType: 'image/jpeg',
    });
    expect(result.url).toBe('https://example.com/img.jpg');
  });

  it('refuse http', async () => {
    await expect(
      externalAdapter.put({
        key: 'http://example.com/x',
        body: Buffer.alloc(0),
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow();
  });

  it('refuse les hôtes privés (anti-SSRF)', async () => {
    await expect(
      externalAdapter.put({
        key: 'https://127.0.0.1/x',
        body: Buffer.alloc(0),
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow();
    await expect(
      externalAdapter.put({
        key: 'https://192.168.1.1/x',
        body: Buffer.alloc(0),
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow();
  });

  it('publicUrl renvoie la clé inchangée', () => {
    expect(externalAdapter.publicUrl('https://x.com/a')).toBe('https://x.com/a');
  });
});
