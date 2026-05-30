import { describe, it, expect } from 'vitest';
import {
  upsertBundleAssets,
  upsertPrimaryAsset,
  getDraftBundle,
  getPrimaryAsset,
} from './repository';

/**
 * MP-AR-003 (BUG-004) — per-draft media bundle. These exercise the in-memory
 * store path (no DATABASE_URL in tests). The key guarantee vs the legacy
 * `upsertPrimaryAsset` (which deleted ALL bindings for a draft) is that an
 * upsert is now SCOPED to its (draftId, role): adding a voiceover must not wipe
 * the primary video.
 */
describe('upsertBundleAssets / getDraftBundle (MP-AR-003)', () => {
  it('writes one binding per role and reads them back keyed by role', async () => {
    const draftId = 'cd_bundle_1';
    await upsertBundleAssets({
      draftId,
      assets: [
        { mediaId: 'me_vid', role: 'primary_video' },
        { mediaId: 'me_vo', role: 'voiceover' },
        { mediaId: 'me_mu', role: 'music' },
      ],
    });
    const bundle = await getDraftBundle(draftId);
    expect(bundle.primary_video?.mediaId).toBe('me_vid');
    expect(bundle.voiceover?.mediaId).toBe('me_vo');
    expect(bundle.music?.mediaId).toBe('me_mu');
  });

  it('scopes the upsert to the role — adding voiceover keeps the primary video', async () => {
    const draftId = 'cd_bundle_2';
    await upsertBundleAssets({ draftId, assets: [{ mediaId: 'me_vid', role: 'primary_video' }] });
    await upsertBundleAssets({ draftId, assets: [{ mediaId: 'me_vo', role: 'voiceover' }] });

    const bundle = await getDraftBundle(draftId);
    expect(bundle.primary_video?.mediaId).toBe('me_vid'); // NOT wiped (legacy bug)
    expect(bundle.voiceover?.mediaId).toBe('me_vo');
  });

  it('replaces only the same-role binding on re-upsert', async () => {
    const draftId = 'cd_bundle_3';
    await upsertBundleAssets({ draftId, assets: [{ mediaId: 'me_vo_a', role: 'voiceover' }] });
    await upsertBundleAssets({ draftId, assets: [{ mediaId: 'me_vo_b', role: 'voiceover' }] });
    const bundle = await getDraftBundle(draftId);
    expect(bundle.voiceover?.mediaId).toBe('me_vo_b');
    expect(Object.keys(bundle)).toEqual(['voiceover']);
  });

  it('persists per-role meta (SRT text for subtitles)', async () => {
    const draftId = 'cd_bundle_4';
    const srt = '1\n00:00:00,000 --> 00:00:01,500\nBonjour\n';
    await upsertBundleAssets({
      draftId,
      assets: [{ mediaId: 'srt:cd_bundle_4', role: 'subtitles', meta: { srt, source: 'ai-engine' } }],
    });
    const bundle = await getDraftBundle(draftId);
    expect(bundle.subtitles?.meta.srt).toBe(srt);
  });

  it('upsertPrimaryAsset shim writes primary_image and is found by getPrimaryAsset', async () => {
    const draftId = 'cd_bundle_5';
    await upsertPrimaryAsset({ draftId, mediaId: 'me_img' });
    const primary = await getPrimaryAsset(draftId);
    expect(primary?.role).toBe('primary_image');
    expect(primary?.mediaId).toBe('me_img');
  });

  it('upsertPrimaryAsset honors an explicit primary_video role', async () => {
    const draftId = 'cd_bundle_6';
    await upsertPrimaryAsset({ draftId, mediaId: 'me_clip', role: 'primary_video' });
    const primary = await getPrimaryAsset(draftId);
    expect(primary?.role).toBe('primary_video');
  });
});
