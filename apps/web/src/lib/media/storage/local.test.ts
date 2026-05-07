import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
let originalCwd: string;
let originalDir: string | undefined;

describe('storage.local', () => {
  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'fgstore-'));
    originalCwd = process.cwd();
    originalDir = process.env.MEDIA_LOCAL_DIR;
    process.env.MEDIA_LOCAL_DIR = workdir;
    process.chdir(workdir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (originalDir === undefined) delete process.env.MEDIA_LOCAL_DIR;
    else process.env.MEDIA_LOCAL_DIR = originalDir;
    await rm(workdir, { recursive: true, force: true });
  });

  it('put écrit le buffer puis publicUrl prefixe', async () => {
    const { localAdapter } = await import('./local');
    const result = await localAdapter.put({
      key: 'media/abc/jpg/master.jpg',
      body: Buffer.from('hello'),
      contentType: 'image/jpeg',
    });
    expect(result.sizeBytes).toBe(5);
    expect(result.url).toContain('media/abc/jpg/master.jpg');
    const onDisk = await readFile(join(workdir, 'media/abc/jpg/master.jpg'));
    expect(onDisk.toString()).toBe('hello');
  });

  it('refuse les chemins avec traversal', async () => {
    const { localAdapter } = await import('./local');
    await expect(
      localAdapter.put({ key: '../escape.jpg', body: Buffer.from('x'), contentType: 'image/jpeg' }),
    ).rejects.toThrow();
  });

  it('get retrouve les bytes écrits', async () => {
    const { localAdapter } = await import('./local');
    await localAdapter.put({
      key: 'a/b.txt',
      body: Buffer.from('payload'),
      contentType: 'text/plain',
    });
    const buf = await localAdapter.get!('a/b.txt');
    expect(buf.toString()).toBe('payload');
  });

  it('delete retire le fichier sans erreur', async () => {
    const { localAdapter } = await import('./local');
    await localAdapter.put({
      key: 'd/e.txt',
      body: Buffer.from('to-delete'),
      contentType: 'text/plain',
    });
    await localAdapter.delete('d/e.txt');
    await expect(localAdapter.get!('d/e.txt')).rejects.toThrow();
  });
});
