/**
 * Helpers de formatage des sous-produits dans la section « La composition »
 * de la page `/kit`. Fonctions pures, sans I/O — testables sans setup.
 *
 * Centralise les conventions Kolenda :
 *  - volume en minuscule, séparateur `·` collé au nom (§2.3 + Pricing §51-56),
 *  - sensation encadrée par guillemets français (§4.3 induce sensation),
 *  - pastille numérotée 2 digits zero-padded (Annexe A),
 *  - accentColor enum → hex de la palette FemiGlow (Annexe A).
 *
 * cf. docs/composition-reveal-optim-2026-05/04-backend-design.md §3.1
 */
import type { SubProduct, SubProductAccentColor } from '@/lib/schemas';

/**
 * Construit la ligne d'en-tête `{name} · {volume}` avec normalisation
 * de la casse du volume et trim défensif.
 *
 * Exemples :
 *  - `{name: '1 Paste', volume: '15 g'}` → `'1 Paste · 15 g'`
 *  - `{name: '2 Powder', volume: '8 G'}` → `'2 Powder · 8 g'`
 *
 * Si `volume` est vide après trim, renvoie uniquement le nom (pas de
 * séparateur orphelin) pour rester robuste face à des données partielles.
 */
export function buildCardHeader(sub: SubProduct): string {
  const volume = sub.volume.toLowerCase().trim();
  if (!volume) return sub.name;
  return `${sub.name} · ${volume}`;
}

/**
 * Encadre la sensation entre guillemets français.
 * Retourne `null` si la sensation est absente — l'appelant n'affiche rien.
 *
 * Ex. `'Tiède au contact.'` → `'« Tiède au contact. »'`
 */
export function formatSensation(sub: SubProduct): string | null {
  if (!sub.sensation) return null;
  return `« ${sub.sensation.trim()} »`;
}

/**
 * Numéro de la card en notation 2 chiffres zero-padded.
 *
 * Le contrat `kitPageContentSchema.composition` est borné à 3-4 items ;
 * la fonction reste safe au-delà (cap à 99 pour parade vs `padStart`).
 */
export function formatIndex(index: number): string {
  const safe = Math.max(0, Math.min(99, Math.floor(index)));
  return String(safe + 1).padStart(2, '0');
}

/**
 * Mapping `accentColor` enum → hex token de la palette FemiGlow.
 * Source de vérité : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` Annexe A.
 *
 * Fallback `champagne` (or poudré) quand l'accent n'est pas défini —
 * la cliente voit une pastille neutre cohérente avec la palette générale.
 */
const ACCENT_HEX: Record<SubProductAccentColor, string> = {
  sauge: '#A8B89E',
  petale: '#F2CECC',
  ciel: '#C5DBE5',
  champagne: '#B8956B',
};

export function resolveAccentHex(
  accent: SubProductAccentColor | null | undefined,
): string {
  return ACCENT_HEX[accent ?? 'champagne'];
}
