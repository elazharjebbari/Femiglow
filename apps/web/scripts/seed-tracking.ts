import path from 'node:path';
import { upsertTrackingPage } from '@/lib/db/queries/tracking/pages';
import {
  attachComponentToPage,
  upsertTrackingComponent,
} from '@/lib/db/queries/tracking/components';
import { upsertEventDefinition } from '@/lib/db/queries/tracking/event-definitions';
import { upsertTrackingProvider } from '@/lib/db/queries/tracking/providers';
import { EVENT_CATALOG } from '@/lib/tracking/event-catalog';
import { scanInventory, writeManifest } from '@/lib/tracking/inventory/scanner';
import type { TrackingProviderKind } from '@/lib/db/types';

async function main(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '..');
  const manifest = await scanInventory({
    componentsRoot: path.join(projectRoot, 'src', 'components'),
    pagesRoot: path.join(projectRoot, 'src', 'app'),
    projectRoot,
  });
  await writeManifest(manifest, path.join(projectRoot, 'src', 'lib', 'tracking', 'inventory.generated.json'));

  for (const def of EVENT_CATALOG) {
    await upsertEventDefinition({
      name: def.name,
      category: def.category,
      scope: def.scope,
      description: def.description,
      isConversion: def.isConversion,
      paramsSchema: def.paramsSchema,
      applicableCategories: def.applicableCategories,
      defaultProviders: def.defaultProviders,
    });
  }

  const pageIdByRoute = new Map<string, string>();
  for (const page of manifest.pages) {
    const upserted = await upsertTrackingPage({
      route: page.route,
      title: page.title,
      category: page.category,
    });
    pageIdByRoute.set(page.route, upserted.id);
  }

  const componentIdByPath = new Map<string, string>();
  for (const component of manifest.components) {
    const upserted = await upsertTrackingComponent({
      name: component.name,
      path: component.path,
      category: component.category,
      description: component.description ?? null,
    });
    componentIdByPath.set(component.path, upserted.id);
  }

  for (const [route, pageId] of pageIdByRoute) {
    for (const component of manifest.components) {
      if (!routeMatchesComponent(route, component.path)) continue;
      const componentId = componentIdByPath.get(component.path);
      if (!componentId) continue;
      await attachComponentToPage({ pageId, componentId, position: 0 });
    }
  }

  const providers: TrackingProviderKind[] = [
    'meta',
    'tiktok',
    'google_ga4',
    'google_ads',
    'snap',
    'pinterest',
  ];
  for (const kind of providers) {
    await upsertTrackingProvider({ kind, status: 'disabled' });
  }

  console.log('seed:tracking ok', {
    pages: manifest.pages.length,
    components: manifest.components.length,
    events: EVENT_CATALOG.length,
    providers: providers.length,
  });
}

function routeMatchesComponent(route: string, componentPath: string): boolean {
  const lowerPath = componentPath.toLowerCase();
  if (route === '/') return lowerPath.includes('/sections/') && !lowerPath.includes('/admin/');
  if (route.startsWith('/admin')) return lowerPath.includes('/admin/');
  if (route.startsWith('/journal'))
    return lowerPath.includes('/sections/') || lowerPath.includes('/patterns/');
  if (route.startsWith('/kit') || route.startsWith('/panier') || route.startsWith('/commander'))
    return (
      lowerPath.includes('/commerce/') ||
      lowerPath.includes('/forms/') ||
      lowerPath.includes('/sections/')
    );
  if (route.startsWith('/contact'))
    return lowerPath.includes('/forms/') || lowerPath.includes('/sections/');
  return lowerPath.includes('/sections/');
}

main().catch((err) => {
  console.error('seed:tracking failed', err);
  process.exit(1);
});
