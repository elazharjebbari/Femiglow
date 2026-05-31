/**
 * Wrappers `Link` / `useRouter` / `redirect` — exports type-safe vers next-intl.
 *
 * Importer ces wrappers (et NON ceux de `next/link` ou `next/navigation`)
 * dans tous les composants qui doivent respecter le routing locale-aware.
 *
 * Usage typique :
 *
 * ```tsx
 * import { Link, useRouter } from '@/i18n/navigation';
 *
 * <Link href="/kit">{t('navigation.kit')}</Link>
 * const router = useRouter();
 * router.push('/kit'); // → /{currentLocale}/kit
 * ```
 *
 * @see docs/i18n-strategy-2026-05/04-frontend/component-strategy.md
 */
import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
