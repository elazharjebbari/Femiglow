/**
 * Seed pipeline — `docs/images/values/<group>/*.png` → Media + Binding.
 *
 * Étapes pour chaque image :
 *   1. Lire le PNG depuis docs/images/values.
 *   2. Optimize via `optimizeImage` (génère AVIF/WebP/JPEG aux 6 breakpoints).
 *   3. Insère un `Media` (status=ready) avec alt seedé.
 *   4. Crée les `MediaVariant` produits.
 *   5. Upsert le `componentMediaBindings` (componentKey, slot) :
 *      - À la CRÉATION du binding : `isActive=true` par défaut (fresh-seed
 *        = tout actif, pas d'admin override à protéger).
 *      - À la MISE À JOUR d'un binding existant : `isActive` est préservé
 *        (respect des choix admin faits via la CMS) — sauf si `opts.autoActivate`
 *        (CLI `--auto-activate`) ou `mapping.autoActivate` force la
 *        réactivation explicite (cf. `seed-mapping.ts`).
 *      Cf. « Option B » du runbook seed — `is_active` ne flip jamais
 *      false → true silencieusement sur re-seed.
 *
 * Idempotence :
 *   - Slug du Media = `${pageGroup}-${basenameSansExt}`.
 *   - Si slug existe déjà → skip création Media (réutilise).
 *   - Variants régénérés uniquement avec `force=true`.
 */
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createMedia,
  findMediaBySlug,
  updateMedia,
} from '@/lib/db/queries/media';
import { upsertVariant } from '@/lib/db/queries/media-variants';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import {
  getBindingBySlot,
  upsertBinding,
} from '@/lib/db/queries/component-bindings';
import {
  upsertAnimationFromSeed,
  upsertAnimationBinding,
} from '@/lib/db/queries/component-animations';
import {
  archiveOrphanBindings,
  ensureSeedPublishedBinding,
  listBindingsByComponent,
} from '@/lib/db/queries/component-fields';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { optimizeImage } from '@/lib/media/pipeline/optimize-image';
import { mediaVariantsHealthy } from '@/lib/media/heal';
import {
  DEFAULT_BREAKPOINTS,
  THUMB_BREAKPOINTS,
  THUMB_ONLY_BREAKPOINTS,
} from '@/lib/media/pipeline/breakpoints';
import {
  findComponentSeed,
  SITE_COMPONENT_REGISTRY,
  type ComponentVariantPolicy,
  type SiteComponentSeed,
} from './registry';
import type { VariantBreakpoint } from '@/lib/db/types';
import { ANIMATION_REGISTRY } from './animations-registry';
import { IMAGE_TO_COMPONENT, listSeedSourcePaths } from './seed-mapping';
import { altFor } from './seed-alt';
import type { MediaLoadingStrategy } from '@/lib/db/types';

export interface SeedOptions {
  /** Activer immédiatement les bindings (par défaut : isActive=false). */
  autoActivate?: boolean;
  /** Régénérer les variants même si un Media existe déjà. */
  force?: boolean;
  /** Sur-écrire l'alt déjà présent (sinon : ne touche pas si Media a un alt non vide). */
  forceAlt?: boolean;
  /** Filtrer par pageGroup (ex: 'home', 'kit'). */
  filterPageGroup?: string;
  /** Dry-run : ne touche pas la DB, retourne juste un rapport. */
  dryRun?: boolean;
  /** Chemin racine. Défaut : `<repo>/docs/images/values`. */
  rootDir?: string;
  /** Crée aussi les profils d'animation. Défaut : true. */
  syncAnimations?: boolean;
  /** Sync registry des composants. Défaut : true. */
  syncRegistry?: boolean;
  /** Sync les champs éditoriaux (Components-CMS). Défaut : true. */
  syncFields?: boolean;
  /**
   * En plus de seeder les champs manquants, archiver les bindings dont le
   * fieldKey n'existe plus dans le registre (EC1). Défaut : false (sécurité —
   * réservé au script `seed:components-fields:reconcile`).
   */
  reconcileFields?: boolean;
  /** Filtrer la phase fields à un seul composant (par `key`). */
  filterComponentKey?: string;
  /** ID admin propriétaire des bindings créés. */
  actorId?: string | null;
  /**
   * Callback de progression. Émis aux changements de phase et pour chaque
   * image traitée. Utilisé par la route streamée pour pousser des événements
   * NDJSON au client (UI : barre de progression).
   */
  onProgress?: (event: SeedProgressEvent) => void;
}

export type SeedPhase = 'registry' | 'animations' | 'images' | 'fields';

/**
 * Événement de progression émis par le pipeline. Sérialisable JSON :
 * la route SSE/NDJSON le sérialise tel quel.
 */
export type SeedProgressEvent =
  | {
      type: 'phase';
      phase: SeedPhase;
      total: number;
      message: string;
    }
  | {
      type: 'item';
      phase: SeedPhase;
      current: number;
      total: number;
      item: string;
      status: 'seeded' | 'forced' | 'skipped' | 'error' | 'unmapped' | 'synced';
      message?: string;
    };

export interface SeedReport {
  components: { synced: number };
  animations: { synced: number };
  images: {
    total: number;
    seeded: number;
    skipped: number;
    activated: number;
    unmapped: string[];
    errors: Array<{ path: string; error: string }>;
  };
  fields: ComponentFieldsReport;
  durationMs: number;
}

/**
 * Rapport de la phase Components-CMS (champs éditoriaux).
 * - `seeded` : bindings `published` créés depuis le registre (defaultValue).
 * - `skipped` : déjà présents → l'admin a la priorité (idempotence I0).
 * - `orphansArchived` : champs supprimés du registre → archivés (EC1).
 * - `warnings` : champs `required` sans `defaultValue` (à corriger côté code).
 */
export interface ComponentFieldsReport {
  componentsScanned: number;
  seeded: number;
  skipped: number;
  orphansArchived: number;
  warnings: string[];
}

const REPO_DEFAULT_ROOT = path.resolve(process.cwd(), '../../docs/images/values');

function inferLoadingStrategy(
  componentKey: string,
  slot: string,
): MediaLoadingStrategy {
  // hero éager, og éager, autres viewport
  if (componentKey.includes('hero')) return 'eager';
  if (slot === 'og') return 'eager';
  return 'viewport';
}

/**
 * Calcule les breakpoints à passer à `optimizeImage` selon la politique
 * déclarée sur le composant (cf. `ComponentVariantPolicy`).
 *
 * Cette fonction est la *seule* source de vérité pour la politique de
 * variants côté seed : si demain on ajoute `with-thumbnail-only-mobile`
 * ou `og-only`, c'est ici que la logique vit. Les composants déclarent
 * leur politique en metadata, le pipeline applique.
 */
function breakpointsForPolicy(
  policy: ComponentVariantPolicy | undefined,
): VariantBreakpoint[] {
  switch (policy) {
    case 'with-thumbnail':
      return THUMB_BREAKPOINTS;
    case 'thumb-only':
      return THUMB_ONLY_BREAKPOINTS;
    case 'default':
    case undefined:
    default:
      return DEFAULT_BREAKPOINTS;
  }
}

/**
 * À partir d'un (composant, slotKey) donné, retourne les options à passer
 * à `optimizeImage`. Couvre :
 *  - les breakpoints (cf. `ComponentVariantPolicy`),
 *  - le crop physique au ratio du slot (si `slot.cropToAspect && aspectRatioHint`),
 *  - le focal point par défaut (centré sauf override),
 *  - la couleur de fond aplatie (token résolu en hex pour sharp).
 *
 * Centralise la logique pour les deux branches de seed (création + force)
 * afin qu'un changement de politique au registre se propage uniformément.
 *
 * @internal Exporté principalement pour les tests unitaires.
 */
export function optimizeOptionsForSeed(
  seed: SiteComponentSeed,
  slotKey: string,
): {
  breakpoints: VariantBreakpoint[];
  targetAspectRatio?: string;
  flattenBackground?: string;
} {
  const slotDef = seed.slots.find((s) => s.key === slotKey);
  const breakpoints = breakpointsForPolicy(seed.variantPolicy);
  const out: ReturnType<typeof optimizeOptionsForSeed> = { breakpoints };
  if (slotDef?.cropToAspect && slotDef.aspectRatioHint) {
    out.targetAspectRatio = slotDef.aspectRatioHint;
  }
  // Si le slot a un backdrop par défaut (typiquement creme), on aplatit
  // les variants JPEG sur cette couleur pour ne pas voir un bord noir
  // s'ajouter sur les sources transparentes.
  if (slotDef?.backgroundFillDefault) {
    const resolved = resolveTokenColor(slotDef.backgroundFillDefault);
    if (resolved) out.flattenBackground = resolved;
  }
  return out;
}

/**
 * Résolution serveur des tokens couleur (en hex). Le client utilise
 * `var(--color-*)` mais sharp a besoin d'une couleur "matérielle" — on
 * duplique donc la table ici. Source de vérité : `tokens.css`.
 */
const SERVER_COLOR_TOKEN_HEX: Record<string, string> = {
  creme: '#FBF8F1',
  'creme-warm': '#F5EFE3',
  encre: '#2C2A28',
  'encre-soft': '#4A4744',
  sauge: '#C5DBC4',
  'sauge-soft': '#E0EDE0',
  'sauge-dark': '#4F6D52',
  petale: '#F2CECC',
  'petale-soft': '#FAE6E5',
  'petale-dark': '#B14F4A',
  ciel: '#C5DBE5',
  'ciel-soft': '#E0EBF1',
  'ciel-dark': '#4F7A92',
  champagne: '#C8A876',
  'champagne-soft': '#E8D9BC',
  'champagne-dark': '#7A5F38',
};

function resolveTokenColor(input: string): string | null {
  if (input.startsWith('#') || input.startsWith('rgb')) return input;
  return SERVER_COLOR_TOKEN_HEX[input] ?? null;
}

async function listSourceFiles(rootDir: string): Promise<string[]> {
  const out: string[] = [];
  const groups = await fs.readdir(rootDir);
  for (const g of groups) {
    const groupPath = path.join(rootDir, g);
    const stat = await fs.stat(groupPath).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const files = await fs.readdir(groupPath);
    for (const f of files) {
      if (f.startsWith('.')) continue;
      if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
      out.push(`${g}/${f}`);
    }
  }
  return out.sort();
}

export async function syncComponentRegistry(): Promise<number> {
  let n = 0;
  for (const seed of SITE_COMPONENT_REGISTRY) {
    await upsertSiteComponentFromSeed(seed);
    n += 1;
  }
  return n;
}

export async function syncAnimationRegistry(): Promise<number> {
  let n = 0;
  for (const a of ANIMATION_REGISTRY) {
    await upsertAnimationFromSeed(a);
    n += 1;
  }
  return n;
}

/**
 * Lie chaque composant à son profil d'animation par défaut (si défini en
 * metadata.animationProfile).
 */
export async function syncDefaultAnimationBindings(): Promise<number> {
  let n = 0;
  for (const seed of SITE_COMPONENT_REGISTRY) {
    const profileKey = (seed.metadata?.animationProfile as string | undefined) ?? null;
    if (!profileKey) continue;
    const profile = ANIMATION_REGISTRY.find((p) => p.key === profileKey);
    if (!profile) continue;
    const cmp = await getSiteComponentByKey(seed.key);
    if (!cmp) continue;
    const anim = await upsertAnimationFromSeed(profile);
    await upsertAnimationBinding({
      componentId: cmp.id,
      animationId: anim.id,
      isDefault: true,
    });
    n += 1;
  }
  return n;
}

/**
 * Phase Components-CMS : pour chaque composant du registre, garantit qu'un
 * binding `published` existe pour chaque field doté d'un `defaultValue`.
 *
 * Idempotent : `ensureSeedPublishedBinding` ne touche pas un binding déjà
 * publié (cf. décision D2 — l'admin a la priorité). Deux runs successifs
 * du seed ⇒ 0 changement.
 *
 * Si `reconcile=true`, archive aussi les bindings orphelins (champs supprimés
 * du registre, EC1).
 */
export async function seedComponentFields(opts: {
  filterPageGroup?: string;
  filterComponentKey?: string;
  reconcile?: boolean;
  actorId?: string | null;
} = {}): Promise<ComponentFieldsReport> {
  const report: ComponentFieldsReport = {
    componentsScanned: 0,
    seeded: 0,
    skipped: 0,
    orphansArchived: 0,
    warnings: [],
  };

  for (const seed of SITE_COMPONENT_REGISTRY) {
    if (opts.filterPageGroup && seed.pageGroup !== opts.filterPageGroup) continue;
    if (opts.filterComponentKey && seed.key !== opts.filterComponentKey) continue;

    const cmp = await getSiteComponentByKey(seed.key);
    if (!cmp) {
      report.warnings.push(
        `seedComponentFields: site_component '${seed.key}' introuvable — exécuter syncComponentRegistry d'abord.`,
      );
      continue;
    }
    report.componentsScanned += 1;

    const fields = seed.fields ?? [];
    const validKeys = fields.map((f) => f.key);

    for (const field of fields) {
      // `null` est traité comme "pas de valeur de seed" au même titre que
      // `undefined` : la colonne `value` est `jsonb NOT NULL`, donc on ne
      // peut pas persister null. Le champ reste sans binding tant qu'un
      // admin ne l'a pas saisi via l'éditeur.
      if (field.defaultValue == null) {
        if (field.required) {
          report.warnings.push(
            `${seed.key}.${field.key} : champ requis sans defaultValue (à corriger dans le registre).`,
          );
        }
        continue;
      }
      // Avant l'appel, on regarde si un published existe déjà pour distinguer
      // seeded vs skipped — `ensureSeedPublishedBinding` étant idempotent.
      const before = await listBindingsByComponent(cmp.id);
      const wasPublished = before.some(
        (b) => b.fieldKey === field.key && b.locale === 'fr' && b.status === 'published',
      );
      await ensureSeedPublishedBinding({
        componentId: cmp.id,
        fieldKey: field.key,
        locale: 'fr',
        value: field.defaultValue,
        authorId: opts.actorId ?? null,
      });
      if (wasPublished) {
        report.skipped += 1;
      } else {
        report.seeded += 1;
      }
    }

    if (opts.reconcile) {
      const archived = await archiveOrphanBindings(cmp.id, validKeys);
      report.orphansArchived += archived;
    }
  }

  return report;
}

export async function seedFromDocs(opts: SeedOptions = {}): Promise<SeedReport> {
  const start = Date.now();
  const root = opts.rootDir ?? REPO_DEFAULT_ROOT;
  const emit = (event: SeedProgressEvent): void => {
    try {
      opts.onProgress?.(event);
    } catch {
      // un consommateur défaillant ne doit jamais casser le pipeline.
    }
  };
  const report: SeedReport = {
    components: { synced: 0 },
    animations: { synced: 0 },
    images: { total: 0, seeded: 0, skipped: 0, activated: 0, unmapped: [], errors: [] },
    fields: { componentsScanned: 0, seeded: 0, skipped: 0, orphansArchived: 0, warnings: [] },
    durationMs: 0,
  };

  if (opts.syncRegistry !== false) {
    emit({
      type: 'phase',
      phase: 'registry',
      total: SITE_COMPONENT_REGISTRY.length,
      message: 'Synchronisation du registre…',
    });
    if (opts.dryRun) {
      report.components.synced = SITE_COMPONENT_REGISTRY.length;
    } else {
      report.components.synced = await syncComponentRegistry();
    }
    emit({
      type: 'item',
      phase: 'registry',
      current: report.components.synced,
      total: SITE_COMPONENT_REGISTRY.length,
      item: 'site_components',
      status: 'synced',
    });
  }
  if (opts.syncAnimations !== false) {
    emit({
      type: 'phase',
      phase: 'animations',
      total: ANIMATION_REGISTRY.length,
      message: 'Synchronisation des animations…',
    });
    if (opts.dryRun) {
      report.animations.synced = ANIMATION_REGISTRY.length;
    } else {
      report.animations.synced = await syncAnimationRegistry();
      await syncDefaultAnimationBindings();
    }
    emit({
      type: 'item',
      phase: 'animations',
      current: report.animations.synced,
      total: ANIMATION_REGISTRY.length,
      item: 'animations',
      status: 'synced',
    });
  }

  if (opts.syncFields !== false) {
    const targetCount = SITE_COMPONENT_REGISTRY.filter((s) => {
      if (opts.filterPageGroup && s.pageGroup !== opts.filterPageGroup) return false;
      if (opts.filterComponentKey && s.key !== opts.filterComponentKey) return false;
      return true;
    }).length;
    emit({
      type: 'phase',
      phase: 'fields',
      total: targetCount,
      message: 'Synchronisation des champs éditoriaux…',
    });
    if (opts.dryRun) {
      report.fields.componentsScanned = targetCount;
    } else {
      report.fields = await seedComponentFields({
        filterPageGroup: opts.filterPageGroup,
        ...(opts.filterComponentKey ? { filterComponentKey: opts.filterComponentKey } : {}),
        reconcile: opts.reconcileFields ?? false,
        actorId: opts.actorId ?? null,
      });
    }
    emit({
      type: 'item',
      phase: 'fields',
      current: report.fields.componentsScanned,
      total: targetCount,
      item: 'component_field_bindings',
      status: 'synced',
      message: `seeded=${report.fields.seeded} skipped=${report.fields.skipped} orphans=${report.fields.orphansArchived}`,
    });
  }

  const present: string[] = await listSourceFiles(root).catch(() => [] as string[]);
  const known = new Set(listSeedSourcePaths());
  for (const f of present) if (!known.has(f)) report.images.unmapped.push(f);

  const candidates = listSeedSourcePaths();
  // Compter d'abord les images réellement traitées pour donner un total fiable
  // à la barre de progression (sans cela, %=current/total varie en cours de
  // route si filterPageGroup ou fichiers manquants).
  const plannedPaths = candidates.filter((sp) => {
    if (!present.includes(sp)) return false;
    const m = IMAGE_TO_COMPONENT[sp];
    if (!m) return false;
    const s = findComponentSeed(m.componentKey);
    if (!s) return false;
    if (opts.filterPageGroup && s.pageGroup !== opts.filterPageGroup) return false;
    return true;
  });

  emit({
    type: 'phase',
    phase: 'images',
    total: plannedPaths.length,
    message: 'Optimisation et liaison des images…',
  });

  let imageIndex = 0;
  for (const sourcePath of candidates) {
    if (!present.includes(sourcePath)) {
      // mapping connu mais fichier absent → on saute
      continue;
    }
    const mapping = IMAGE_TO_COMPONENT[sourcePath]!;
    const seed = findComponentSeed(mapping.componentKey);
    if (!seed) {
      report.images.errors.push({
        path: sourcePath,
        error: `unknown componentKey ${mapping.componentKey}`,
      });
      continue;
    }
    if (opts.filterPageGroup && seed.pageGroup !== opts.filterPageGroup) continue;
    report.images.total += 1;
    imageIndex += 1;

    let itemStatus: 'seeded' | 'forced' | 'skipped' | 'error' = 'seeded';
    let itemMessage: string | undefined;

    try {
      const [pageGroup, basename] = sourcePath.split('/') as [string, string];
      const slug = `${pageGroup}-${basename.replace(/\.(png|jpe?g|webp)$/i, '')}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (opts.dryRun) {
        report.images.seeded += 1;
        if (opts.autoActivate) report.images.activated += 1;
        emit({
          type: 'item',
          phase: 'images',
          current: imageIndex,
          total: plannedPaths.length,
          item: sourcePath,
          status: 'seeded',
          message: 'dry-run',
        });
        continue;
      }

      let media = await findMediaBySlug(slug);

      // Heal automatique : si le media est déjà ready mais ses variantes
      // physiques manquent sur disque (driver local), on force la
      // ré-optimisation comme si `--force` avait été passé. Sans ça, un
      // reset soft re-seed la DB mais laisse l'utilisateur avec des 404
      // partout.
      const mediaHealthy = media ? await mediaVariantsHealthy(media.id) : true;
      const shouldOptimize = !media || opts.force || !mediaHealthy;

      if (!media) {
        const buf = await fs.readFile(path.join(root, sourcePath));
        const seedOptimize = optimizeOptionsForSeed(seed, mapping.slot);
        media = await createMedia({
          kind: 'image',
          source: 'upload',
          slug,
          alt: altFor(sourcePath),
          originalFilename: basename,
          originalSizeBytes: buf.byteLength,
          originalMime: 'image/png',
          status: 'processing',
          // On persiste les breakpoints utilisés en `overrides` pour qu'une
          // re-optimisation déclenchée par l'admin (worker `process-job`)
          // applique la même politique que le seed.
          overrides: { breakpoints: seedOptimize.breakpoints },
        });

        const optim = await optimizeImage({
          mediaId: media.id,
          buffer: buf,
          ...seedOptimize,
        });
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
        media = await updateMedia(media.id, {
          status: 'ready',
          blurhash: optim.blurhash,
          phash: optim.phash,
          palette: optim.palette,
          originalWidth: optim.width,
          originalHeight: optim.height,
        });
        report.images.seeded += 1;
        itemStatus = 'seeded';
      } else if (shouldOptimize) {
        const buf = await fs.readFile(path.join(root, sourcePath));
        const seedOptimize = optimizeOptionsForSeed(seed, mapping.slot);
        // Synchronise les overrides si la politique du registre a évolué
        // depuis le dernier seed (ex : on flag un composant en
        // `with-thumbnail` pour la première fois, ou on bascule un slot
        // en `cropToAspect`).
        media = await updateMedia(media.id, {
          overrides: {
            ...(media.overrides ?? {}),
            breakpoints: seedOptimize.breakpoints,
          },
        });
        const optim = await optimizeImage({
          mediaId: media.id,
          buffer: buf,
          ...seedOptimize,
        });
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
        media = await updateMedia(media.id, {
          status: 'ready',
          blurhash: optim.blurhash,
          phash: optim.phash,
          palette: optim.palette,
          originalWidth: optim.width,
          originalHeight: optim.height,
          ...(opts.forceAlt ? { alt: altFor(sourcePath) } : {}),
        });
        report.images.seeded += 1;
        itemStatus = 'forced';
      } else {
        report.images.skipped += 1;
        itemStatus = 'skipped';
      }

      // Upsert binding
      const cmp = await getSiteComponentByKey(seed.key);
      if (!cmp) {
        itemMessage = `composant ${seed.key} introuvable`;
        emit({
          type: 'item',
          phase: 'images',
          current: imageIndex,
          total: plannedPaths.length,
          item: sourcePath,
          status: itemStatus,
          ...(itemMessage ? { message: itemMessage } : {}),
        });
        continue;
      }
      // Option B — `is_active` est résolu différemment selon que le binding
      // existe déjà ou non :
      //  - CRÉATION (binding inexistant) : `isActive=true` par défaut. Sur
      //    un fresh-seed il n'y a aucun override admin à protéger, donc on
      //    activate les bindings d'office — sinon la page tombe sur le SVG
      //    fallback alors que les Media optimisés sont prêts. Le drapeau
      //    `--auto-activate` et `mapping.autoActivate` deviennent
      //    redondants pour ce cas mais restent rétro-compatibles.
      //  - MISE À JOUR (binding existant) : `isActive` est PRÉSERVÉ. C'est
      //    le nouveau garde-fou anti-écrasement : si l'admin a désactivé
      //    un slot via la CMS, un re-seed ne le réactive plus en silence.
      //    Pour forcer la réactivation, passer explicitement
      //    `--auto-activate` (override CLI) ou marquer le mapping
      //    `autoActivate: true` (override per-asset).
      const existingBinding = await getBindingBySlot(cmp.id, mapping.slot);
      const forceActivate = !!opts.autoActivate || !!mapping.autoActivate;
      let isActiveDecision: boolean | undefined;
      if (!existingBinding) {
        // Fresh-seed : on active toujours (sinon le site reste vide).
        isActiveDecision = true;
      } else if (forceActivate) {
        // Re-seed avec override explicite → on force.
        isActiveDecision = true;
      } else {
        // Re-seed sans override → on omet `isActive` pour laisser
        // `upsertBinding` retomber sur `existing.isActive`.
        isActiveDecision = undefined;
      }
      const slotDef = seed.slots.find((s) => s.key === mapping.slot);
      await upsertBinding({
        componentId: cmp.id,
        slot: mapping.slot,
        mediaId: media!.id,
        loadingStrategy: inferLoadingStrategy(seed.key, mapping.slot),
        fetchPriority: seed.defaultFetchPriority,
        ...(isActiveDecision !== undefined ? { isActive: isActiveDecision } : {}),
        placeholderStrategy: 'svg',
        // Hérite des défauts du slot pour que les images affichées
        // immédiatement après seed aient une présentation cohérente.
        // L'admin peut toujours surcharger ensuite.
        ...(slotDef?.objectFitDefault
          ? { objectFit: slotDef.objectFitDefault }
          : {}),
        ...(slotDef?.objectPositionDefault
          ? { objectPosition: slotDef.objectPositionDefault }
          : {}),
        ...(slotDef?.backgroundFillDefault
          ? { backgroundFill: slotDef.backgroundFillDefault }
          : {}),
        createdBy: opts.actorId ?? null,
      });
      // Compte comme "activé" :
      //  - création avec isActive=true, OU
      //  - update avec forceActivate (qui passe isActive=true).
      // Ne compte PAS les updates qui ont conservé existing.isActive=true
      // (déjà actifs avant le re-seed).
      if (isActiveDecision === true) report.images.activated += 1;
    } catch (e) {
      itemStatus = 'error';
      itemMessage = e instanceof Error ? e.message : String(e);
      report.images.errors.push({
        path: sourcePath,
        error: itemMessage,
      });
    }

    emit({
      type: 'item',
      phase: 'images',
      current: imageIndex,
      total: plannedPaths.length,
      item: sourcePath,
      status: itemStatus,
      ...(itemMessage ? { message: itemMessage } : {}),
    });
  }

  report.durationMs = Date.now() - start;
  return report;
}
