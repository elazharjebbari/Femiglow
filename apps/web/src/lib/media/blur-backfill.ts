/**
 * Backfill du placeholder `media.blur_data_url` pour les médias image
 * antérieurs à son calcul dans le pipeline (migration 0087).
 *
 * Idempotent : ne traite que les lignes où la colonne est NULL (média
 * image, non supprimé, `ready` / `passthrough`), par lots triés par id
 * (curseur : une ligne en échec n'est jamais relue en boucle). Relancer le
 * script reprend là où il s'est arrêté.
 *
 * Source lue, par ordre de préférence (la plus légère d'abord) :
 *   1. le plus petit variant WebP, puis JPEG, puis AVIF — lu via le driver
 *      de stockage de l'application quand l'URL correspond à la clé
 *      `media/<id>/<format>/<bp>.<format>` (driver local : lecture disque) ;
 *   2. sinon l'URL publique du variant (HTTP) ;
 *   3. sinon `media.original_url` (médias `passthrough` / externes).
 * Le variant reflète le recadrage réellement affiché (crop au ratio du slot).
 *
 * Le CLI est `scripts/backfill-media-blur.ts` ; ce module est testable.
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.5
 */
import { listImageMediaWithoutBlur, updateMedia } from '@/lib/db/queries/media';
import { listVariants } from '@/lib/db/queries/media-variants';
import type { Media, MediaVariant, VariantBreakpoint } from '@/lib/db/types';
import { BREAKPOINT_WIDTHS } from '@/lib/media/pipeline/breakpoints';
import { computeBlurDataUrl } from '@/lib/media/pipeline/blur-data-url';
import { variantStorageKey } from '@/lib/media/pipeline/optimize-image';
import type { StorageAdapter } from '@/lib/media/storage';

export interface BlurBackfillOptions {
  /** N'écrit rien : calcule et compte seulement. */
  dryRun?: boolean;
  /** Nombre maximal de médias examinés (tous lots confondus). */
  limit?: number;
  /** Taille d'un lot de lecture. Défaut 50. */
  batchSize?: number;
  /** Stockage de l'application (lecture des variants). */
  storage: StorageAdapter;
  /** `fetch` injectable (tests). Défaut : `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /**
   * Délai maximal d'un téléchargement HTTP (ms). Défaut
   * `BLUR_BACKFILL_FETCH_TIMEOUT_MS`. Un dépassement compte comme `error`
   * pour le média (pas `no_source` : la source existe, elle ne répond pas).
   */
  fetchTimeoutMs?: number;
  /** Journal de progression (une ligne par média). */
  log?: (line: string) => void;
}

export type BlurBackfillItemStatus = 'updated' | 'would_update' | 'no_source' | 'error';

export interface BlurBackfillItem {
  mediaId: string;
  slug: string;
  status: BlurBackfillItemStatus;
  /** Origine de la source lue (`storage:<clé>`, `http:<url>`). */
  source?: string;
  bytes?: number;
  error?: string;
}

export interface BlurBackfillReport {
  dryRun: boolean;
  scanned: number;
  updated: number;
  wouldUpdate: number;
  noSource: number;
  errors: number;
  items: BlurBackfillItem[];
  durationMs: number;
}

const IMAGE_FORMAT_ORDER = ['webp', 'jpeg', 'avif'] as const;

function variantWidth(v: MediaVariant): number {
  if (v.width) return v.width;
  if (v.breakpoint) return BREAKPOINT_WIDTHS[v.breakpoint as VariantBreakpoint] ?? Number.MAX_SAFE_INTEGER;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Variants image triés du plus pertinent au moins pertinent : format
 * (WebP > JPEG > AVIF, du plus rapide à décoder au plus lent) puis largeur
 * croissante. Exporté pour les tests.
 */
export function orderBlurSourceVariants(variants: readonly MediaVariant[]): MediaVariant[] {
  return variants
    .filter((v): v is MediaVariant => (IMAGE_FORMAT_ORDER as readonly string[]).includes(v.format))
    .sort((a, b) => {
      const fa = IMAGE_FORMAT_ORDER.indexOf(a.format as (typeof IMAGE_FORMAT_ORDER)[number]);
      const fb = IMAGE_FORMAT_ORDER.indexOf(b.format as (typeof IMAGE_FORMAT_ORDER)[number]);
      return fa - fb || variantWidth(a) - variantWidth(b);
    });
}

function isHttpUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

/** Délai par défaut d'un téléchargement HTTP de source. */
export const BLUR_BACKFILL_FETCH_TIMEOUT_MS = 15_000;

/** Téléchargement trop long : remonté en `error` pour le média. */
export class BlurSourceTimeoutError extends Error {}

async function fetchBuffer(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Buffer> {
  // Le signal couvre aussi la lecture du corps (`arrayBuffer`).
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetchImpl(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    // `signal.aborted` plutôt que le nom de l'erreur : la forme de l'erreur
    // (DOMException `TimeoutError`, `AbortError`…) varie selon le runtime.
    if (signal.aborted) {
      throw new BlurSourceTimeoutError(`délai dépassé (${timeoutMs} ms) sur ${url}`);
    }
    throw err;
  }
}

/**
 * Lit la meilleure source disponible pour un média. Renvoie `null` si
 * aucune n'est lisible ; les erreurs de lecture d'un candidat font passer
 * au suivant (la dernière est rapportée). Lève `BlurSourceTimeoutError` si
 * aucune source n'a répondu et qu'un téléchargement a dépassé le délai.
 */
export async function readBlurSource(
  media: Media,
  variants: readonly MediaVariant[],
  storage: StorageAdapter,
  fetchImpl: typeof fetch | undefined,
  fetchTimeoutMs: number = BLUR_BACKFILL_FETCH_TIMEOUT_MS,
): Promise<{ buffer: Buffer; source: string } | { buffer: null; lastError: string | null }> {
  let lastError: string | null = null;
  // Un délai dépassé n'interrompt pas la recherche (un autre candidat peut
  // répondre) ; s'il n'y en a aucun, il est relevé en erreur.
  let timeout: BlurSourceTimeoutError | null = null;
  const remember = (err: unknown): void => {
    if (err instanceof BlurSourceTimeoutError) timeout = err;
    lastError = err instanceof Error ? err.message : String(err);
  };
  for (const v of orderBlurSourceVariants(variants)) {
    if (v.breakpoint && storage.get) {
      const key = variantStorageKey(media.id, v.format, v.breakpoint as VariantBreakpoint);
      if (v.url === storage.publicUrl(key) || v.url.endsWith(`/${key}`)) {
        try {
          return { buffer: await storage.get(key), source: `storage:${key}` };
        } catch (err) {
          remember(err);
        }
      }
    }
    if (isHttpUrl(v.url) && fetchImpl) {
      try {
        return { buffer: await fetchBuffer(v.url, fetchImpl, fetchTimeoutMs), source: `http:${v.url}` };
      } catch (err) {
        remember(err);
      }
    }
  }
  if (isHttpUrl(media.originalUrl) && fetchImpl) {
    try {
      return {
        buffer: await fetchBuffer(media.originalUrl, fetchImpl, fetchTimeoutMs),
        source: `http:${media.originalUrl}`,
      };
    } catch (err) {
      remember(err);
    }
  }
  if (timeout) throw timeout;
  return { buffer: null, lastError };
}

/** Exécute le backfill. Voir l'en-tête du module. */
export async function backfillMediaBlur(opts: BlurBackfillOptions): Promise<BlurBackfillReport> {
  const start = Date.now();
  const dryRun = !!opts.dryRun;
  const batchSize = Math.min(Math.max(opts.batchSize ?? 50, 1), 1000);
  const limit = opts.limit && opts.limit > 0 ? opts.limit : Number.POSITIVE_INFINITY;
  const fetchImpl = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  const log = opts.log ?? (() => {});
  const report: BlurBackfillReport = {
    dryRun,
    scanned: 0,
    updated: 0,
    wouldUpdate: 0,
    noSource: 0,
    errors: 0,
    items: [],
    durationMs: 0,
  };

  let afterId: string | null = null;
  while (report.scanned < limit) {
    const pageSize = Math.min(batchSize, limit - report.scanned);
    const page = await listImageMediaWithoutBlur({ afterId, limit: pageSize });
    if (page.length === 0) break;
    afterId = page[page.length - 1]!.id;

    for (const media of page) {
      report.scanned += 1;
      const item: BlurBackfillItem = { mediaId: media.id, slug: media.slug, status: 'error' };
      try {
        const variants = await listVariants(media.id);
        const read = await readBlurSource(
          media,
          variants,
          opts.storage,
          fetchImpl,
          opts.fetchTimeoutMs ?? BLUR_BACKFILL_FETCH_TIMEOUT_MS,
        );
        if (!read.buffer) {
          item.status = 'no_source';
          if (read.lastError) item.error = read.lastError;
          report.noSource += 1;
        } else {
          item.source = read.source;
          const blurDataUrl = await computeBlurDataUrl(read.buffer);
          item.bytes = blurDataUrl.length;
          if (dryRun) {
            item.status = 'would_update';
            report.wouldUpdate += 1;
          } else {
            await updateMedia(media.id, { blurDataUrl });
            item.status = 'updated';
            report.updated += 1;
          }
        }
      } catch (err) {
        item.status = 'error';
        item.error = err instanceof Error ? err.message : String(err);
        report.errors += 1;
      }
      report.items.push(item);
      log(
        `[backfill-blur] ${item.status.padEnd(12)} ${media.id} ${media.slug}` +
          (item.source ? ` ← ${item.source}` : '') +
          (item.error ? ` (${item.error})` : ''),
      );
    }
    if (page.length < pageSize) break;
  }

  report.durationMs = Date.now() - start;
  return report;
}
