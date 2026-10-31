/**
 * Contexte commun des pages /kit (`app/[locale]/kit` et `app/(marketing)/kit`).
 *
 * Résout UNE fois par requête, pour les deux pages :
 *  - l'angle publicitaire (`?angle=` > `utm_content` > cookie `fg_angle`) ;
 *  - le drapeau « images par audience » (env `HERO_MEDIA_VARIANTS` × champ
 *    CMS `kit-hero-produit.mediaVariantsEnabled` × `?hmv=off`) ;
 *  - l'aperçu brouillon admin (`?hmv_preview=draft`, session admin requise) ;
 *  - la galerie du hero et ses paramètres de tracking.
 *
 * La galerie est passée telle quelle aux layouts puis à `HeroProduitBound` :
 * le `view_item` serveur, le `view_item` client et le HTML portent donc la
 * MÊME variante (pas d'écart serveur / client, cf. §8 « Risques »).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.6, §4.9
 */
import 'server-only';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';
import { getAdminSession } from '@/lib/auth/require-admin';
import { resolveComponentFields } from '@/lib/components/field-resolver';
import { isHeroMediaVariantsEnabled } from '@/lib/feature-flags/hero-media-variants';
import {
  KIT_ANGLE_COOKIE,
  kitAngleTrackingValue,
  resolveKitAngle,
  type KitAngle,
  type ResolvedKitAngle,
} from '@/lib/kit/angle';
import { heroMediaTrackingParams, type HeroMediaTracking } from '@/lib/kit/hero-media';
import {
  getKitHeroGallery,
  kitHeroGalleryTracking,
  kitHeroProductFallback,
  type KitHeroGallery,
} from '@/lib/products/kit-hero-gallery';

/** Composant du hero /kit (champs CMS et ensembles de médias). */
export const KIT_HERO_COMPONENT_KEY = 'kit-hero-produit';

/** Champ CMS coupe-circuit (cf. registre `kit-hero-produit`). */
export const HERO_MEDIA_VARIANTS_CMS_FIELD = 'mediaVariantsEnabled';

/** `?hmv_preview=draft` : aperçu des ensembles brouillons (admin uniquement). */
export const HERO_MEDIA_PREVIEW_QUERY_PARAM = 'hmv_preview';
export const HERO_MEDIA_PREVIEW_DRAFT = 'draft';

/** Nombre maximal d'images de la galerie (comme `HeroProduitBound`). */
export const KIT_HERO_GALLERY_MAX_TOTAL = 7;

type QueryValue = string | string[] | undefined;

export interface KitPageSearchParams {
  angle?: QueryValue;
  utm_content?: QueryValue;
  hmv?: QueryValue;
  hmv_preview?: QueryValue;
}

/** Sous-ensemble de `cookies()` utilisé (injectable en test). */
export interface KitPageCookieReader {
  get(name: string): { value: string } | undefined;
}

/** Sous-ensemble du produit utilisé pour la galerie. */
export interface KitPageProduct {
  id: string;
  images: ReadonlyArray<{
    src: string;
    alt: string;
    width: number;
    height: number;
    blurDataURL?: string;
  }>;
}

export interface ResolveKitPageContextInput {
  /** Langue de la page (`(marketing)/kit` : défaut FR). */
  locale?: Locale;
  searchParams?: KitPageSearchParams;
  cookies: KitPageCookieReader;
  product: KitPageProduct;
  /** Alt de dernier recours des images par audience (nom localisé). */
  fallbackAlt?: string;
  /** Valeur d'env injectable (tests). Défaut : `process.env.HERO_MEDIA_VARIANTS`. */
  envValue?: string;
}

export interface KitPageViewItemParams {
  kit_angle: KitAngle | 'none';
  hero_media_variant?: string;
  hero_media_level?: number;
}

export interface KitPageContext {
  kitAngle: ResolvedKitAngle;
  /** Drapeau effectif (aperçu brouillon admin compris). */
  heroMediaVariantsEnabled: boolean;
  /** Aperçu brouillon admin actif (session admin valide). */
  draftPreview: boolean;
  /**
   * Galerie résolue une fois, à passer aux layouts (`heroGallery`). PROMESSE
   * déjà lancée : la lecture des liaisons / ensembles / photos clientes
   * tourne en parallèle du prix, du JSON-LD et des champs du hero au lieu de
   * retarder le rendu (TTFB inchangé drapeau coupé). Ne rejette jamais sans
   * gestionnaire : un `catch` silencieux est attaché, l'erreur reste
   * remontée à qui l'attend (`HeroProduitBound`), comme avant.
   */
  heroGallery: Promise<KitHeroGallery>;
  /** Variante + niveau ; `null` drapeau coupé ou aperçu brouillon. */
  heroMediaTracking: Promise<HeroMediaTracking | null>;
  /** Paramètres propres à /kit à fusionner dans le `view_item` serveur. */
  viewItemParams: Promise<KitPageViewItemParams>;
  /**
   * `false` en aperçu brouillon : l'admin ne doit polluer ni CAPI ni les
   * rapports avec une variante non publiée.
   */
  shouldServerFire: boolean;
}

function firstValue(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `?hmv_preview=draft` présent (la session est vérifiée à part). */
export function isDraftPreviewRequested(searchParams: KitPageSearchParams | undefined): boolean {
  const raw = firstValue(searchParams?.hmv_preview);
  return typeof raw === 'string' && raw.trim().toLowerCase() === HERO_MEDIA_PREVIEW_DRAFT;
}

/**
 * Valeur du champ CMS coupe-circuit. Lue en langue par défaut : c'est un
 * interrupteur GLOBAL, pas un réglage par langue (le résolveur de champs ne
 * retombe pas sur le FR quand une langue n'a pas de valeur publiée). Base
 * indisponible → `false` (galerie historique).
 */
export async function readHeroMediaVariantsCmsEnabled(): Promise<boolean> {
  try {
    const fields = await resolveComponentFields(KIT_HERO_COMPONENT_KEY, DEFAULT_LOCALE);
    return fields[HERO_MEDIA_VARIANTS_CMS_FIELD]?.value === true;
  } catch {
    return false;
  }
}

/**
 * Drapeau « images par audience » pour une requête publique (sans aperçu).
 * Le champ CMS n'est lu que si l'environnement l'autorise.
 */
export async function resolveHeroMediaVariantsFlag({
  queryOverride,
  envValue = process.env.HERO_MEDIA_VARIANTS,
}: {
  queryOverride?: unknown;
  envValue?: string;
} = {}): Promise<boolean> {
  // Court-circuit : drapeau d'env coupé → aucune lecture CMS.
  if (!isHeroMediaVariantsEnabled({ cmsEnabled: true, queryOverride, envValue })) return false;
  const cmsEnabled = await readHeroMediaVariantsCmsEnabled();
  return isHeroMediaVariantsEnabled({ cmsEnabled, queryOverride, envValue });
}

/**
 * Aperçu brouillon : `?hmv_preview=draft` ET session admin valide. Sans
 * session, le paramètre est ignoré silencieusement (page publique normale).
 */
async function resolveDraftPreview(searchParams: KitPageSearchParams | undefined): Promise<boolean> {
  if (!isDraftPreviewRequested(searchParams)) return false;
  try {
    return (await getAdminSession()) !== null;
  } catch {
    return false;
  }
}

/**
 * Résout le contexte d'une page /kit (angle, drapeau, galerie, tracking).
 *
 * Aperçu brouillon admin : la galerie est résolue drapeau FORCÉ (l'admin
 * relit les ensembles avant d'activer le drapeau, cf. runbook §7 étape 4),
 * avec les brouillons sans cache ; `?hmv=off` reste prioritaire.
 */
export async function resolveKitPageContext({
  locale = DEFAULT_LOCALE,
  searchParams,
  cookies,
  product,
  fallbackAlt,
  envValue = process.env.HERO_MEDIA_VARIANTS,
}: ResolveKitPageContextInput): Promise<KitPageContext> {
  const draftPreview = await resolveDraftPreview(searchParams);
  const kitAngle = resolveKitAngle({
    angleParam: searchParams?.angle,
    utmContent: searchParams?.utm_content,
    // Aperçu : seule l'URL décide (comme le diagnostic `GET /resolve`).
    cookie: draftPreview ? undefined : cookies.get(KIT_ANGLE_COOKIE)?.value,
  });

  const heroMediaVariantsEnabled = draftPreview
    ? isHeroMediaVariantsEnabled({ cmsEnabled: true, queryOverride: searchParams?.hmv, envValue: 'on' })
    : await resolveHeroMediaVariantsFlag({ queryOverride: searchParams?.hmv, envValue });

  const heroGallery = getKitHeroGallery({
    productId: product.id,
    maxTotal: KIT_HERO_GALLERY_MAX_TOTAL,
    productFallback: kitHeroProductFallback(product.images[0]),
    locale,
    angle: kitAngle.angle,
    flagEnabled: heroMediaVariantsEnabled,
    draft: draftPreview && heroMediaVariantsEnabled,
    fallbackAlt,
  });
  // Marque la promesse comme gérée (pas d'`unhandledRejection` tant que le
  // hero ne l'a pas encore attendue) ; l'erreur reste visible pour lui.
  heroGallery.catch(() => undefined);
  // Galerie brouillon → `null` (cf. `kitHeroGalleryTracking`).
  const heroMediaTracking = heroGallery.then(kitHeroGalleryTracking);
  heroMediaTracking.catch(() => undefined);
  const kitAngleValue = kitAngleTrackingValue(kitAngle.angle);
  const viewItemParams = heroMediaTracking.then(
    (tracking): KitPageViewItemParams => ({
      kit_angle: kitAngleValue,
      ...heroMediaTrackingParams(tracking),
    }),
  );
  viewItemParams.catch(() => undefined);

  return {
    kitAngle,
    heroMediaVariantsEnabled,
    draftPreview,
    heroGallery,
    heroMediaTracking,
    viewItemParams,
    shouldServerFire: !draftPreview,
  };
}
