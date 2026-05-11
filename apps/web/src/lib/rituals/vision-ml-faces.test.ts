import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkFacesWithTimeout,
  fixtureProvider,
  getVisionMLProvider,
  safeManualProvider,
  setVisionMLProvider,
} from './vision-ml-faces';

beforeEach(() => {
  setVisionMLProvider(safeManualProvider);
});

afterEach(() => {
  setVisionMLProvider(safeManualProvider);
});

describe('safeManualProvider (défaut)', () => {
  it('marque toute photo en MANUAL_REVIEW', async () => {
    const result = await safeManualProvider.check({ url: 'anything' });
    expect(result.status).toBe('MANUAL_REVIEW');
  });
});

describe('fixtureProvider', () => {
  beforeEach(() => setVisionMLProvider(fixtureProvider));

  it('REJECTED_FACE si URL contient /face/', async () => {
    const result = await fixtureProvider.check({ url: 'blob://photos/face/test.jpg' });
    expect(result.status).toBe('REJECTED_FACE');
    expect(result.facesCount).toBeGreaterThan(0);
  });

  it('MANUAL_REVIEW si URL contient hijab', async () => {
    const result = await fixtureProvider.check({ url: 'blob://photos/hijab-partial.jpg' });
    expect(result.status).toBe('MANUAL_REVIEW');
  });

  it('OK si URL contient hands', async () => {
    const result = await fixtureProvider.check({ url: 'blob://photos/hands-only.jpg' });
    expect(result.status).toBe('OK');
  });

  it('MANUAL_REVIEW pour buffer vide', async () => {
    const result = await fixtureProvider.check({ buffer: Buffer.alloc(0) });
    expect(result.status).toBe('MANUAL_REVIEW');
  });
});

describe('checkFacesWithTimeout', () => {
  it('utilise le provider actif', async () => {
    setVisionMLProvider(fixtureProvider);
    const result = await checkFacesWithTimeout({ url: '/hands/ok.jpg' });
    expect(result.status).toBe('OK');
  });

  it('timeout retourne MANUAL_REVIEW', async () => {
    setVisionMLProvider({
      name: 'slow',
      async check() {
        return new Promise<never>(() => {
          // jamais résolu
        });
      },
    });
    const result = await checkFacesWithTimeout({ url: 'x' }, 50);
    expect(result.status).toBe('MANUAL_REVIEW');
  });
});

describe('setVisionMLProvider', () => {
  it('change le provider courant', () => {
    setVisionMLProvider(fixtureProvider);
    expect(getVisionMLProvider().name).toBe('fixture');
  });
});
