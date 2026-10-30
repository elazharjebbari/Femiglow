/**
 * Ingestion d'une image source → `Media` prêt à l'affichage.
 *
 * Extrait de `seedFromDocs` (seed des images de `docs/images/values`) pour
 * être partagé avec l'import des images générées
 * (`lib/media/import/run-component-media-import.ts`). Pour une image :
 *   1. `createMedia` (statut `processing`, breakpoints et empreinte source
 *      mémorisés dans `overrides` pour qu'une ré-optimisation admin
 *      — worker `process-job` — applique la même politique) ;
 *   2. `optimizeImage` (AVIF/WebP/JPEG par breakpoint, blurhash, palette,
 *      phash, placeholder `blur_data_url`) ;
 *   3. `upsertVariant` pour chaque variant ;
 *   4. statut `ready` + métadonnées calculées.
 *
 * Idempotence (clé = slug, puis empreinte) :
 *   - slug inconnu → création (`created`) ;
 *   - slug connu, même empreinte (ou empreinte non fournie) → rien
 *     (`skipped`), sauf `force` ou variants physiques manquants (heal) →
 *     ré-optimisation en place (`reprocessed`) ;
 *   - slug connu, empreinte DIFFÉRENTE → rien n'est touché
 *     (`checksum_mismatch`) : le média peut être publié, on ne remplace
 *     jamais une image en ligne en silence. L'appelant décide (l'import
 *     crée un nouveau média au slug suffixé par l'empreinte). `force`
 *     ré-optimise quand même en place avec le nouveau contenu.
 *
 * Échec d'optimisation : un média créé par le passage est marqué `failed` ;
 * un média existant (peut-être publié) n'est pas modifié — ni statut, ni
 * overrides, ni empreinte — et l'erreur remonte.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.8
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  createMedia,
  findMediaBySlug,
  normalizeSlug,
  updateMedia,
  type UpdateMediaInput,
} from '@/lib/db/queries/media';
import { upsertVariant } from '@/lib/db/queries/media-variants';
import type { Media, MediaOverrides, VariantBreakpoint } from '@/lib/db/types';
import { mediaVariantsHealthy } from '@/lib/media/heal';
import { BREAKPOINT_WIDTHS } from '@/lib/media/pipeline/breakpoints';
import { optimizeImage, type OptimizeImageInput } from '@/lib/media/pipeline/optimize-image';
import type { StorageAdapter } from '@/lib/media/storage';

/** Options d'optimisation transmises telles quelles à `optimizeImage`. */
export type IngestOptimizeOptions = Pick<
  OptimizeImageInput,
  'formats' | 'qualities' | 'targetAspectRatio' | 'focalX' | 'focalY' | 'flattenBackground'
>;

export interface IngestImageInput {
  /**
   * Contenu source, ou chargeur paresseux : lu seulement si un traitement
   * est nécessaire (le seed évite ainsi de relire les fichiers déjà ingérés).
   */
  buffer: Buffer | (() => Promise<Buffer>);
  /** Nom du fichier d'origine (`media.original_filename`). */
  filename: string;
  /** Slug cible (normalisé par `normalizeSlug`). */
  slug: string;
  /** Alt du média (texte de la médiathèque). */
  alt: string;
  /** Type MIME d'origine. Défaut : déduit de l'extension de `filename`. */
  mime?: string;
  /** Breakpoints des variants. Défaut : ceux de `optimizeImage`. */
  breakpoints?: VariantBreakpoint[];
  /**
   * Ré-optimisation d'un média existant : `replace` (défaut, seed) applique
   * `breakpoints` tels quels ; `union` garde aussi ceux déjà mémorisés dans
   * `overrides.breakpoints`. L'import utilise `union` : un média dédoublonné
   * peut servir à plusieurs composants aux politiques différentes, et un
   * `--force` ne doit pas supprimer les variants dont l'autre a besoin.
   */
  breakpointsMode?: 'replace' | 'union';
  optimize?: IngestOptimizeOptions;
  /**
   * Empreinte de la source (`sha256-<hex>`, cf. `sha256Checksum`). Stockée
   * dans `media.overrides.sourceChecksum`. Absente = idempotence par slug
   * seul (comportement historique du seed).
   */
  sourceChecksum?: string;
  /** Ré-optimise un média existant (même slug). */
  force?: boolean;
  /** Lors d'une ré-optimisation, réécrit aussi l'alt du média. */
  forceAlt?: boolean;
  /** Admin à l'origine de la création (`media.created_by`). */
  actorId?: string | null;
  /** Stockage des variants. Défaut : driver de l'application. */
  storage?: StorageAdapter;
}

export type IngestStatus = 'created' | 'reprocessed' | 'skipped' | 'checksum_mismatch';

export interface IngestImageResult {
  status: IngestStatus;
  media: Media;
  /** Ré-optimisation déclenchée par des variants physiques manquants. */
  healed: boolean;
}

/** Empreinte au format des checksums de variants (`sha256-<hex>`). */
export function sha256Checksum(buffer: Buffer): string {
  return `sha256-${createHash('sha256').update(buffer).digest('hex')}`;
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

/** Type MIME d'après l'extension (défaut `application/octet-stream`). */
export function mimeFromFilename(filename: string): string {
  return MIME_BY_EXT[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

async function loadBuffer(source: IngestImageInput['buffer']): Promise<Buffer> {
  return typeof source === 'function' ? source() : source;
}

function withIngestOverrides(
  base: MediaOverrides,
  input: Pick<IngestImageInput, 'breakpoints' | 'sourceChecksum'>,
): MediaOverrides {
  const next: MediaOverrides = { ...base };
  if (input.breakpoints) next.breakpoints = input.breakpoints;
  if (input.sourceChecksum) next.sourceChecksum = input.sourceChecksum;
  return next;
}

/** Ordre canonique des breakpoints (du plus petit au plus grand). */
const BREAKPOINT_ORDER = Object.keys(BREAKPOINT_WIDTHS) as VariantBreakpoint[];

/** Union ordonnée de deux listes de breakpoints. */
export function unionBreakpoints(
  a: readonly VariantBreakpoint[] | undefined,
  b: readonly VariantBreakpoint[] | undefined,
): VariantBreakpoint[] {
  const all = new Set([...(a ?? []), ...(b ?? [])]);
  return BREAKPOINT_ORDER.filter((bp) => all.has(bp));
}

interface StoreContext {
  breakpoints: VariantBreakpoint[] | undefined;
  /** Champs écrits avec le passage en `ready` (overrides, alt, taille). */
  onSuccess: UpdateMediaInput;
  /**
   * `true` : média créé par ce passage (statut `processing`) → marqué
   * `failed` si l'optimisation échoue. `false` : média existant, peut-être
   * publié → laissé tel quel (statut, overrides, empreinte), l'erreur
   * remonte seule ; un passage suivant retentera.
   */
  createdHere: boolean;
}

/** Optimise, enregistre les variants et passe le média en `ready`. */
async function optimizeAndStore(
  media: Media,
  buffer: Buffer,
  input: IngestImageInput,
  ctx: StoreContext,
): Promise<Media> {
  try {
    const optim = await optimizeImage(
      {
        mediaId: media.id,
        buffer,
        ...(ctx.breakpoints ? { breakpoints: ctx.breakpoints } : {}),
        ...(input.optimize ?? {}),
      },
      // `undefined` → paramètre par défaut (driver de l'application).
      input.storage,
    );
    for (const v of optim.variants) {
      await upsertVariant({
        mediaId: media.id,
        format: v.format,
        breakpoint: v.breakpoint,
        width: v.width,
        height: v.height,
        quality: v.quality,
        sizeBytes: v.sizeBytes,
        url: v.url,
        checksum: v.checksum,
      });
    }
    return await updateMedia(media.id, {
      ...ctx.onSuccess,
      status: 'ready',
      failureReason: null,
      blurhash: optim.blurhash,
      // `null` si le calcul a échoué (non bloquant) : un flou périmé de
      // l'ancienne source est effacé, le backfill le recalculera.
      blurDataUrl: optim.blurDataUrl,
      phash: optim.phash,
      palette: optim.palette,
      originalWidth: optim.width,
      originalHeight: optim.height,
    });
  } catch (err) {
    if (ctx.createdHere) {
      // Trace l'échec sur le média créé (best-effort) : un nouveau passage
      // le reprendra (variants absents → heal).
      const reason = err instanceof Error ? err.message : String(err);
      await updateMedia(media.id, { status: 'failed', failureReason: reason }).catch(() => {});
    }
    throw err;
  }
}

/**
 * Ingère une image (création ou ré-optimisation idempotente). Voir l'en-tête
 * du module pour la table de décision.
 */
export async function ingestImageBuffer(input: IngestImageInput): Promise<IngestImageResult> {
  const slug = normalizeSlug(input.slug);
  if (!slug) throw new Error(`ingest: slug vide pour ${input.filename}`);

  const existing = await findMediaBySlug(slug);

  if (!existing) {
    const buffer = await loadBuffer(input.buffer);
    const created = await createMedia({
      kind: 'image',
      source: 'upload',
      slug,
      alt: input.alt,
      originalFilename: input.filename,
      originalSizeBytes: buffer.byteLength,
      originalMime: input.mime ?? mimeFromFilename(input.filename),
      status: 'processing',
      overrides: withIngestOverrides({}, input),
      createdBy: input.actorId ?? null,
    });
    const media = await optimizeAndStore(created, buffer, input, {
      breakpoints: input.breakpoints,
      onSuccess: {},
      createdHere: true,
    });
    return { status: 'created', media, healed: false };
  }

  const storedChecksum = existing.overrides?.sourceChecksum;
  const mismatch =
    !!input.sourceChecksum && !!storedChecksum && storedChecksum !== input.sourceChecksum;
  if (mismatch && !input.force) {
    return { status: 'checksum_mismatch', media: existing, healed: false };
  }

  const healthy = await mediaVariantsHealthy(existing.id);
  if (input.force || !healthy) {
    const buffer = await loadBuffer(input.buffer);
    const breakpoints =
      input.breakpointsMode === 'union'
        ? unionBreakpoints(existing.overrides?.breakpoints, input.breakpoints)
        : input.breakpoints;
    // Overrides (politique de breakpoints, nouvelle empreinte), alt et taille
    // ne sont écrits qu'APRÈS une optimisation réussie : un échec laisse le
    // média exactement dans son état précédent.
    const media = await optimizeAndStore(existing, buffer, input, {
      breakpoints: breakpoints && breakpoints.length > 0 ? breakpoints : undefined,
      onSuccess: {
        overrides: withIngestOverrides(existing.overrides ?? {}, {
          ...(breakpoints && breakpoints.length > 0 ? { breakpoints } : {}),
          ...(input.sourceChecksum ? { sourceChecksum: input.sourceChecksum } : {}),
        }),
        ...(input.sourceChecksum ? { originalSizeBytes: buffer.byteLength } : {}),
        ...(input.forceAlt ? { alt: input.alt } : {}),
      },
      createdHere: false,
    });
    return { status: 'reprocessed', media, healed: !input.force && !healthy };
  }

  // Média antérieur à l'empreinte (seed historique) : on la mémorise pour
  // que les passages suivants puissent détecter un changement de fichier.
  if (input.sourceChecksum && !storedChecksum) {
    const media = await updateMedia(existing.id, {
      overrides: { ...(existing.overrides ?? {}), sourceChecksum: input.sourceChecksum },
    });
    return { status: 'skipped', media, healed: false };
  }
  return { status: 'skipped', media: existing, healed: false };
}
