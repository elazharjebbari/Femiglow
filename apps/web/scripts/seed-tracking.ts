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

export interface TrackingSeedReport {
  pages: number;
  components: number;
  events: number;
  providers: number;
}

export async function runTrackingSeed(opts: {
  onProgress?: (label: string, fraction?: number) => void;
} = {}): Promise<TrackingSeedReport> {
  const projectRoot = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
  );
  opts.onProgress?.('Scan inventory (components + pages)', 0.05);
  const manifest = await scanInventory({
    componentsRoot: path.join(projectRoot, 'src', 'components'),
    pagesRoot: path.join(projectRoot, 'src', 'app'),
    projectRoot,
  });
  await writeManifest(manifest, path.join(projectRoot, 'src', 'lib', 'tracking', 'inventory.generated.json'));

  opts.onProgress?.(`Upsert ${EVENT_CATALOG.length} event definitions`, 0.2);
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

  opts.onProgress?.(`Upsert ${manifest.pages.length} pages`, 0.4);
  const pageIdByRoute = new Map<string, string>();
  for (const page of manifest.pages) {
    const upserted = await upsertTrackingPage({
      route: page.route,
      title: page.title,
      category: page.category,
    });
    pageIdByRoute.set(page.route, upserted.id);
  }

  opts.onProgress?.(`Upsert ${manifest.components.length} components`, 0.55);
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

  opts.onProgress?.('Attachement components → pages', 0.75);
  for (const [route, pageId] of pageIdByRoute) {
    for (const component of manifest.components) {
      if (!routeMatchesComponent(route, component.path)) continue;
      const componentId = componentIdByPath.get(component.path);
      if (!componentId) continue;
      await attachComponentToPage({ pageId, componentId, position: 0 });
    }
  }

  opts.onProgress?.('Upsert providers tracking', 0.9);
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

  return {
    pages: manifest.pages.length,
    components: manifest.components.length,
    events: EVENT_CATALOG.length,
    providers: providers.length,
  };
}

async function main(): Promise<void> {
  const report = await runTrackingSeed();
  console.log('seed:tracking ok', report);
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

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('seed:tracking failed', err);
    process.exit(1);
  });
}
