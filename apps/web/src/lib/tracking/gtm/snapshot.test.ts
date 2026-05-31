/**
 * Tests du snapshot Git.
 *
 * On utilise un dossier temporaire OS pour ne pas polluer infra/gtm
 * du worktree pendant l'exécution des tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gtmSnapshot } from './snapshot';
import { gtmConfigStore } from './config-store';

let tmpRoot = '';
let originalCwd = '';

beforeEach(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gtm-snapshot-'));
  // Crée un faux infra/gtm que le snapshot peut localiser.
  await fs.mkdir(path.join(tmpRoot, 'infra', 'gtm'), { recursive: true });
  process.chdir(tmpRoot);
  await gtmConfigStore._resetForTests({ actorId: 'test' });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('gtmSnapshot.writeAll', () => {
  it('écrit les 4 fichiers container.<env>.json', async () => {
    const r = await gtmSnapshot.writeAll();
    expect(r.errors).toHaveLength(0);
    expect(r.written).toHaveLength(4);
    expect(r.written.map((w) => w.env).sort()).toEqual([
      'dev',
      'preview',
      'production',
      'stage',
    ]);
    for (const w of r.written) {
      const exists = await fs
        .stat(w.path)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }
  });

  it('chaque fichier contient un JSON parsable avec exportFormatVersion=2', async () => {
    await gtmSnapshot.writeAll();
    const prodPath = path.join(tmpRoot, 'infra', 'gtm', 'container.production.json');
    const content = await fs.readFile(prodPath, 'utf8');
    const json = JSON.parse(content);
    expect(json.exportFormatVersion).toBe(2);
  });

  it('idempotent — second appel sans changement → skipped=true', async () => {
    await gtmSnapshot.writeAll();
    const r2 = await gtmSnapshot.writeAll();
    for (const w of r2.written) {
      expect(w.skipped).toBe(true);
    }
  });
});

describe('gtmSnapshot.writeOne', () => {
  it('écrit un seul env', async () => {
    const r = await gtmSnapshot.writeOne('production');
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.path).toMatch(/container\.production\.json$/);
    expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.bytes).toBeGreaterThan(0);
  });

  it('idempotent : 2e appel skipped', async () => {
    await gtmSnapshot.writeOne('production');
    const r2 = await gtmSnapshot.writeOne('production');
    expect(r2!.skipped).toBe(true);
  });
});

describe('gtmSnapshot — sécurité', () => {
  it("écrit uniquement dans infra/gtm/, pas ailleurs", async () => {
    await gtmSnapshot.writeAll();
    const expected = path.join(tmpRoot, 'infra', 'gtm');
    const entries = await fs.readdir(expected);
    // Tous les fichiers doivent être container.<env>.json
    for (const e of entries) {
      expect(e).toMatch(/^container\.(production|stage|preview|dev)\.json$/);
    }
  });
});
