import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import type { PostizIntegration } from '@/lib/content-studio/postiz';
import {
  syncPostizSocialAccounts,
  syncSocialAccounts,
} from './admin-service';
import { listSocialAccounts } from './repository';

beforeEach(() => {
  resetMemoryStore();
});

describe('syncSocialAccounts', () => {
  it('sync les 2 comptes dry-run + ne plante pas si Postiz est indisponible', async () => {
    const failingFetcher = vi.fn().mockRejectedValue(new Error('POSTIZ_BASE_URL manquant'));
    const accounts = await syncSocialAccounts({ fetchPostizIntegrations: failingFetcher });
    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => `${a.provider}:${a.platform}`).sort()).toEqual([
      'dry_run:facebook',
      'dry_run:instagram',
    ]);
    expect(failingFetcher).toHaveBeenCalledTimes(1);
  });

  it('sync les comptes dry-run + Postiz Instagram + Facebook (mapping via identifier)', async () => {
    // Forme réelle de l'API Postiz : la plateforme est dans `identifier`,
    // pas dans `provider`.
    const fetcher = vi.fn().mockResolvedValue([
      { id: 'postiz_ig_1', identifier: 'instagram', name: 'FemiGlow Maroc', disabled: false },
      { id: 'postiz_fb_1', identifier: 'facebook-page', name: 'FemiGlow Page', disabled: false },
    ] satisfies PostizIntegration[]);

    const accounts = await syncSocialAccounts({ fetchPostizIntegrations: fetcher });
    expect(accounts).toHaveLength(4);
    expect(accounts.map((a) => `${a.provider}:${a.platform}`).sort()).toEqual([
      'dry_run:facebook',
      'dry_run:instagram',
      'postiz:facebook',
      'postiz:instagram',
    ]);
  });

  it('ignore les providers Postiz non supportés (linkedin, etc.)', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      { id: 'postiz_li_1', identifier: 'linkedin', name: 'LinkedIn FemiGlow' },
      { id: 'postiz_ig_1', identifier: 'instagram', name: 'FemiGlow IG' },
    ] satisfies PostizIntegration[]);

    const accounts = await syncSocialAccounts({ fetchPostizIntegrations: fetcher });
    const postizAccounts = accounts.filter((a) => a.provider === 'postiz');
    expect(postizAccounts).toHaveLength(1);
    expect(postizAccounts[0]?.platform).toBe('instagram');
  });

  it('marque les comptes Postiz disabled comme status=disabled', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      { id: 'postiz_ig_disabled', identifier: 'instagram', name: 'Old account', disabled: true },
    ] satisfies PostizIntegration[]);

    const accounts = await syncSocialAccounts({ fetchPostizIntegrations: fetcher });
    const postiz = accounts.find((a) => a.provider === 'postiz');
    expect(postiz?.status).toBe('disabled');
  });

  it('est idempotent : upsert au lieu de dupliquer', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      { id: 'postiz_ig_idem', identifier: 'instagram', name: 'FemiGlow' },
    ] satisfies PostizIntegration[]);

    await syncSocialAccounts({ fetchPostizIntegrations: fetcher });
    await syncSocialAccounts({ fetchPostizIntegrations: fetcher });

    const stored = await listSocialAccounts({ provider: 'postiz' });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.remoteId).toBe('postiz_ig_idem');
  });

  it('respecte includePostiz=false (skip l appel réseau)', async () => {
    const fetcher = vi.fn();
    const accounts = await syncSocialAccounts({ fetchPostizIntegrations: fetcher, includePostiz: false });
    expect(accounts).toHaveLength(2);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fallback à "Postiz {platform}" si name absent', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      { id: 'postiz_ig_noname', identifier: 'instagram' },
    ] satisfies PostizIntegration[]);

    const accounts = await syncSocialAccounts({ fetchPostizIntegrations: fetcher });
    const ig = accounts.find((a) => a.remoteId === 'postiz_ig_noname');
    expect(ig?.name).toBe('Postiz instagram');
  });

  it('fallback à `provider` si `identifier` absent (rétro-compat)', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      { id: 'postiz_legacy', provider: 'instagram', name: 'Legacy account' },
    ] satisfies PostizIntegration[]);

    const accounts = await syncSocialAccounts({ fetchPostizIntegrations: fetcher });
    const postiz = accounts.find((a) => a.provider === 'postiz');
    expect(postiz?.platform).toBe('instagram');
  });
});

describe('syncPostizSocialAccounts', () => {
  it('retourne [] si Postiz API échoue (sans throw)', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('network error'));
    const accounts = await syncPostizSocialAccounts(failing);
    expect(accounts).toEqual([]);
  });

  it('mappe instagram-business → instagram', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      { id: 'postiz_igb_1', identifier: 'instagram-business', name: 'IG Business' },
    ] satisfies PostizIntegration[]);
    const accounts = await syncPostizSocialAccounts(fetcher);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.platform).toBe('instagram');
  });
});
