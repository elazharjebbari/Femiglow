import { env } from '@/lib/env';
import { mockAdapter } from './mock';
import { sanityAdapter } from './sanity';
import type { CMSAdapter } from './types';

const adapters: Record<string, CMSAdapter> = {
  mock: mockAdapter,
  sanity: sanityAdapter,
};

export const cms: CMSAdapter = adapters[env.CMS_PROVIDER] ?? mockAdapter;

export type { CMSAdapter, GetArticlesOptions, GetArticlesPageOptions, ArticlesPage } from './types';
