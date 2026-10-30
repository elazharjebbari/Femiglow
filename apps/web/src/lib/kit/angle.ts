/**
 * Kit CRO v2 §3 — angle publicitaire de la visiteuse (titre du hero /kit).
 *
 * Les publicités Meta portent l'angle dans `utm_content` (`A-darija`,
 * `E-fr`, `temoin-manucure-chine`, ou le nom d'annonce `E_salon-ou-99dh_darija`).
 * Règle en code, sans table en base :
 *  - une lettre `a` à `e` en tête, suivie de `-`, `_` ou de la fin → cet angle ;
 *  - une valeur qui commence par `temoin` → angle témoin ;
 *  - toute autre valeur → aucun angle (titre par défaut).
 *
 * Résolution côté serveur : `?angle=` (recette) > `?utm_content=` > cookie
 * `fg_angle` (visiteuse revenue sans UTM). Module pur : utilisable côté
 * serveur et côté client.
 */

export const KIT_ANGLES = ['a', 'b', 'c', 'd', 'e', 'temoin'] as const;

export type KitAngle = (typeof KIT_ANGLES)[number];

/** Cookie qui garde l'angle venu de l'URL pour les visites suivantes. */
export const KIT_ANGLE_COOKIE = 'fg_angle';
/** Durée de vie du cookie : 7 jours (fenêtre d'attribution courte). */
export const KIT_ANGLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** Longueur maximale lue (une valeur plus longue est tronquée). */
const MAX_RAW_LENGTH = 80;

const LETTER_ANGLE = /^([a-e])(?:[-_].*)?$/;
const TEMOIN_ANGLE = /^temoin/;

/** Vrai si la valeur est un angle connu (lecture du cookie, props). */
export function isKitAngle(value: unknown): value is KitAngle {
  return typeof value === 'string' && (KIT_ANGLES as readonly string[]).includes(value);
}

/**
 * Normalise une valeur brute (`utm_content`, `?angle=`, cookie) en angle.
 * Accepte un tableau (paramètre répété) : seule la première valeur compte.
 */
export function normalizeKitAngle(raw: unknown): KitAngle | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string') return null;
  const cleaned = first
    .trim()
    .slice(0, MAX_RAW_LENGTH)
    .normalize('NFD')
    // Accents retirés (« Témoin » → « temoin »), puis tout caractère hors
    // [a-z0-9_-] ignoré.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  if (cleaned.length === 0) return null;
  if (TEMOIN_ANGLE.test(cleaned)) return 'temoin';
  const letter = LETTER_ANGLE.exec(cleaned);
  return letter ? (letter[1] as KitAngle) : null;
}

export type KitAngleSource = 'query' | 'utm' | 'cookie';

export interface ResolvedKitAngle {
  angle: KitAngle | null;
  /** Origine de l'angle ; `null` sans angle. */
  source: KitAngleSource | null;
}

export interface KitAngleInputs {
  /** `?angle=` — forçage pour la recette. */
  angleParam?: unknown;
  /** `?utm_content=` — porté par les publicités. */
  utmContent?: unknown;
  /** Valeur du cookie `fg_angle`. */
  cookie?: unknown;
}

/**
 * Ordre : `?angle=` > `?utm_content=` > cookie. Une valeur non reconnue est
 * ignorée et on passe à la source suivante.
 */
export function resolveKitAngle({ angleParam, utmContent, cookie }: KitAngleInputs): ResolvedKitAngle {
  const fromQuery = normalizeKitAngle(angleParam);
  if (fromQuery) return { angle: fromQuery, source: 'query' };
  const fromUtm = normalizeKitAngle(utmContent);
  if (fromUtm) return { angle: fromUtm, source: 'utm' };
  const fromCookie = normalizeKitAngle(cookie);
  if (fromCookie) return { angle: fromCookie, source: 'cookie' };
  return { angle: null, source: null };
}

/** Valeur envoyée au tracking (`kit_angle`) : l'angle, ou `none`. */
export function kitAngleTrackingValue(angle: KitAngle | null | undefined): KitAngle | 'none' {
  return angle ?? 'none';
}

/** Attribut posé sur le hero /kit pour que les boutons lisent l'angle au clic. */
export const KIT_ANGLE_DATA_ATTRIBUTE = 'data-kit-angle';

/**
 * Lit l'angle de la page courante depuis le DOM (attribut posé par le hero).
 * `null` hors de /kit (aucun attribut) : le paramètre n'est alors pas envoyé.
 */
export function readKitAngleFromDocument(): KitAngle | 'none' | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(`[${KIT_ANGLE_DATA_ATTRIBUTE}]`);
  if (!el) return null;
  const value = el.getAttribute(KIT_ANGLE_DATA_ATTRIBUTE);
  if (value === 'none') return 'none';
  return isKitAngle(value) ? value : null;
}
