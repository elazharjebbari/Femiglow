import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PhotoValidationError,
  processPhoto,
} from './photo-pipeline';
import {
  fixtureProvider,
  safeManualProvider,
  setVisionMLProvider,
} from './vision-ml-faces';

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 230, b: 220 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

beforeEach(() => {
  // NODE_ENV est readonly en TS strict ; Vitest le pose en 'test' déjà.
  setVisionMLProvider(fixtureProvider);
});

afterEach(() => {
  setVisionMLProvider(safeManualProvider);
});

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
    throw new Error('Expected rejection');
  } catch (e) {
    expect(e).toBeInstanceOf(PhotoValidationError);
    expect((e as PhotoValidationError).code).toBe(code);
  }
}

describe('processPhoto', () => {
  it('photo valide → returns ProcessedPhoto', async () => {
    const buf = await makeJpeg(800, 1000);
    const result = await processPhoto(buf, 'image/jpeg');
    expect(result.width).toBe(800);
    expect(result.height).toBe(1000);
    expect(result.mime).toBe('image/webp');
    expect(result.byteSize).toBeGreaterThan(0);
    expect(result.blobKey).toMatch(/^rituals\/[a-z0-9]+$/);
  });

  it('rejette buffer vide', async () => {
    await expectCode(processPhoto(Buffer.alloc(0), 'image/jpeg'), 'EMPTY_FILE');
  });

  it('rejette image > 5 Mo', async () => {
    const huge = Buffer.alloc(6 * 1024 * 1024, 0xff);
    await expectCode(processPhoto(huge, 'image/jpeg'), 'PHOTO_TOO_LARGE');
  });

  it('rejette mime non accepté', async () => {
    const buf = await makeJpeg(800, 800);
    await expectCode(processPhoto(buf, 'image/gif' as never), 'INVALID_MIME');
  });

  it('rejette image trop petite', async () => {
    const buf = await makeJpeg(200, 200);
    await expectCode(processPhoto(buf, 'image/jpeg'), 'IMAGE_TOO_SMALL');
  });

  it('rejette image corrompue', async () => {
    const bogus = Buffer.from('not an image');
    await expectCode(processPhoto(bogus, 'image/jpeg'), 'CORRUPT_IMAGE');
  });

  it('vision ML sync via fixtureProvider → OK pour hands', async () => {
    setVisionMLProvider({
      name: 'always-ok',
      async check() {
        return { status: 'OK', facesCount: 0 };
      },
    });
    const buf = await makeJpeg(800, 1000);
    const result = await processPhoto(buf, 'image/jpeg');
    expect(result.facesStatus).toBe('OK');
  });

  it('vision ML async → PENDING_CHECK', async () => {
    const buf = await makeJpeg(800, 1000);
    const result = await processPhoto(buf, 'image/jpeg', { visionMlMode: 'async' });
    expect(result.facesStatus).toBe('PENDING_CHECK');
  });
});
