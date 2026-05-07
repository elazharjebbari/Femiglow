import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { TrackingComponentCategory } from '@/lib/db/types';

export interface ScannedComponent {
  name: string;
  path: string;
  category: TrackingComponentCategory;
  description?: string;
  events?: string[];
}

export interface ScannedPage {
  route: string;
  title: string;
  category: 'landing' | 'content' | 'commerce' | 'admin' | 'dev';
  filePath: string;
}

export interface InventoryManifest {
  generatedAt: string;
  components: ScannedComponent[];
  pages: ScannedPage[];
}

const COMPONENT_DIR_CATEGORIES: Record<string, TrackingComponentCategory> = {
  sections: 'section_content',
  commerce: 'commerce_cart',
  admin: 'admin',
  forms: 'form_input',
  layout: 'navigation',
  patterns: 'card',
  media: 'media_image',
  overlays: 'modal',
  ui: 'card',
};

const SUFFIX_CATEGORIES: { suffix: string; category: TrackingComponentCategory }[] = [
  { suffix: 'Hero', category: 'section_hero' },
  { suffix: 'Faq', category: 'section_faq' },
  { suffix: 'Testimonial', category: 'section_testimonial' },
  { suffix: 'Card', category: 'card' },
  { suffix: 'Form', category: 'form_input' },
  { suffix: 'Submit', category: 'form_submit' },
  { suffix: 'Button', category: 'cta_secondary' },
  { suffix: 'Cta', category: 'cta_primary' },
  { suffix: 'Modal', category: 'modal' },
  { suffix: 'Drawer', category: 'modal' },
  { suffix: 'Carousel', category: 'carousel' },
  { suffix: 'Tabs', category: 'tab' },
  { suffix: 'Accordion', category: 'accordion' },
  { suffix: 'Search', category: 'search' },
  { suffix: 'Filter', category: 'filter' },
  { suffix: 'Banner', category: 'banner' },
  { suffix: 'Newsletter', category: 'newsletter' },
  { suffix: 'Pricing', category: 'pricing' },
  { suffix: 'Cart', category: 'commerce_cart' },
  { suffix: 'Checkout', category: 'commerce_checkout' },
  { suffix: 'Video', category: 'media_video' },
  { suffix: 'Audio', category: 'media_audio' },
  { suffix: 'Image', category: 'media_image' },
  { suffix: 'Picture', category: 'media_image' },
  { suffix: 'Nav', category: 'navigation' },
  { suffix: 'Menu', category: 'navigation' },
  { suffix: 'Progress', category: 'progress' },
  { suffix: 'Share', category: 'social_share' },
];

export interface InventoryScanOptions {
  componentsRoot: string;
  pagesRoot: string;
  /** Project root for computing repo-relative paths. */
  projectRoot: string;
}

export async function scanInventory(opts: InventoryScanOptions): Promise<InventoryManifest> {
  const components = await scanComponents(opts.componentsRoot, opts.projectRoot);
  const pages = await scanPages(opts.pagesRoot, opts.projectRoot);
  return {
    generatedAt: new Date().toISOString(),
    components,
    pages,
  };
}

async function scanComponents(root: string, projectRoot: string): Promise<ScannedComponent[]> {
  const files = await walkDir(root);
  const out: ScannedComponent[] = [];
  for (const filePath of files) {
    if (!filePath.endsWith('.tsx')) continue;
    if (filePath.endsWith('.test.tsx') || filePath.endsWith('.stories.tsx')) continue;
    const content = await fs.readFile(filePath, 'utf8');
    const componentName = pickComponentName(filePath, content);
    if (!componentName) continue;
    const relPath = path.relative(projectRoot, filePath);
    const category = inferCategory(filePath, componentName, content);
    const annotated = parseAnnotations(content);
    out.push({
      name: componentName,
      path: relPath,
      category: annotated.category ?? category,
      description: annotated.description,
      events: annotated.events,
    });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function scanPages(root: string, projectRoot: string): Promise<ScannedPage[]> {
  const files = await walkDir(root);
  const out: ScannedPage[] = [];
  for (const filePath of files) {
    if (!filePath.endsWith('page.tsx')) continue;
    const relPath = path.relative(projectRoot, filePath);
    const route = filePathToRoute(filePath, root);
    const category = pageCategory(route);
    const content = await fs.readFile(filePath, 'utf8');
    const title = pickPageTitle(content) ?? route;
    out.push({ route, title, category, filePath: relPath });
  }
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

async function walkDir(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walkDir(full);
      out.push(...sub);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function pickComponentName(filePath: string, content: string): string | null {
  const matchExportFn = content.match(/export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]+)/);
  if (matchExportFn) return matchExportFn[1] ?? null;
  const matchExportConst = content.match(/export\s+(?:default\s+)?const\s+([A-Z][A-Za-z0-9_]+)\s*[:=]/);
  if (matchExportConst) return matchExportConst[1] ?? null;
  const base = path.basename(filePath, '.tsx');
  if (/^[A-Z]/.test(base)) return base;
  return null;
}

function inferCategory(
  filePath: string,
  componentName: string,
  _content: string,
): TrackingComponentCategory {
  for (const { suffix, category } of SUFFIX_CATEGORIES) {
    if (componentName.includes(suffix)) return category;
  }
  const segments = filePath.split(path.sep);
  for (const segment of segments) {
    const cat = COMPONENT_DIR_CATEGORIES[segment];
    if (cat) return cat;
  }
  return 'card';
}

interface Annotations {
  category?: TrackingComponentCategory;
  description?: string;
  events?: string[];
}

function parseAnnotations(content: string): Annotations {
  const out: Annotations = {};
  const catMatch = content.match(/@tracking-category\s+([a-z_]+)/);
  if (catMatch) out.category = catMatch[1] as TrackingComponentCategory;
  const eventsMatch = content.match(/@tracking-events\s+([a-z0-9_,\s]+)/i);
  if (eventsMatch && eventsMatch[1]) {
    out.events = eventsMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const descMatch = content.match(/@tracking-description\s+(.+)/);
  if (descMatch) out.description = descMatch[1]?.trim();
  return out;
}

function filePathToRoute(filePath: string, root: string): string {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  let route = rel.replace(/\/page\.tsx$/, '');
  route = route.replace(/\([^)]+\)\//g, '');
  route = route.replace(/\[\.{3}([^\]]+)\]/g, ':$1*');
  route = route.replace(/\[([^\]]+)\]/g, ':$1');
  if (!route.startsWith('/')) route = `/${route}`;
  if (route === '/') return '/';
  return route.replace(/\/+$/, '') || '/';
}

function pageCategory(route: string): ScannedPage['category'] {
  if (route.startsWith('/admin')) return 'admin';
  if (route.startsWith('/dev')) return 'dev';
  if (
    route.startsWith('/panier') ||
    route.startsWith('/commander') ||
    route.startsWith('/merci') ||
    route.startsWith('/checkout')
  )
    return 'commerce';
  if (route.startsWith('/journal') || route.startsWith('/contact')) return 'content';
  return 'landing';
}

function pickPageTitle(content: string): string | null {
  const exportTitle = content.match(/title:\s*['"]([^'"]+)['"]/);
  if (exportTitle) return exportTitle[1] ?? null;
  return null;
}

export async function writeManifest(
  manifest: InventoryManifest,
  outputPath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
}
