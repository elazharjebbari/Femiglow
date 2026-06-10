/**
 * Validation pure des règles d'audience (F08 étape 2 — AUD-02/05/07/09).
 *
 * Logique testable hors UI, consommée par :
 *  - RuleEditor (erreur de borne + bouton « Inverser les bornes ») ;
 *  - AudienceWizard étape 2 (erreurs BLOQUANTES à la sauvegarde — jamais au
 *    chargement : une audience legacy invalide reste éditable, on propose la
 *    correction au lieu de bloquer sans issue).
 *
 * Pourquoi bloquer un between inversé : `BETWEEN 500 AND 100` est un SQL
 * valide qui ne matche PERSONNE — audience vide silencieuse (AUD-02), même
 * famille de défaut que le code pays inconnu qui compile en FALSE (AUD-07).
 */
import type { Rule, RulesGroup } from '@/lib/mail/audiences/rules-types';
import { TAGS_ENABLED, TAG_RULE_STEP2_ERROR } from '@/lib/mail/audiences/tags-flag';
import { isKnownCountry } from './countries';

// ── Between (numérique + date) ─────────────────────────────────────────────

export const BETWEEN_ERROR = '⚠ La borne basse doit être ≤ la borne haute.';
export const BETWEEN_INCOMPLETE_ERROR =
  'Renseigne les deux bornes des critères « entre ».';
export const SWAP_BOUNDS_LABEL = 'Inverser les bornes';

export type BetweenValidation = { ok: true } | { ok: false; error: string };

function boundEmpty(x: unknown): boolean {
  return x === '' || x === null || x === undefined;
}

/**
 * lo <= hi (numérique) / début <= fin (date ISO). Les bornes vides ne sont
 * PAS une inversion (cas « borne manquante », message dédié séparé).
 */
export function validateBetween(
  value: readonly [number, number] | readonly [string, string],
): BetweenValidation {
  const [lo, hi] = value;
  if (boundEmpty(lo) || boundEmpty(hi)) return { ok: true };
  if (typeof lo === 'number' && typeof hi === 'number') {
    return lo <= hi ? { ok: true } : { ok: false, error: BETWEEN_ERROR };
  }
  // Dates : input type="date" produit YYYY-MM-DD → comparaison chronologique
  // via Date.parse ; fallback lexicographique si non parsable (même format).
  const a = Date.parse(String(lo));
  const b = Date.parse(String(hi));
  const inverted =
    Number.isFinite(a) && Number.isFinite(b) ? a > b : String(lo) > String(hi);
  return inverted ? { ok: false, error: BETWEEN_ERROR } : { ok: true };
}

/** Auto-correction proposée par le bouton « Inverser les bornes ». */
export function swapBounds(
  value: readonly [number, number] | readonly [string, string],
): [number, number] | [string, string] {
  return [value[1], value[0]] as [number, number] | [string, string];
}

// ── email_pattern in — chips (AUD-09) ──────────────────────────────────────

export const EMAIL_PATTERN_IN_EMPTY_ERROR = 'Ajoutez au moins une valeur';

/**
 * Normalise la value d'un `email_pattern in` en liste de chips : migration de
 * lecture TOLÉRANTE du legacy CSV texte-libre (« foo, bar ») vers string[].
 * Trim + anti-doublon + vide ignoré.
 */
export function toPatternChips(value: string | string[]): string[] {
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const out: string[] = [];
  for (const v of raw) {
    const t = v.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

// ── Erreurs bloquantes étape 2 (sauvegarde) ────────────────────────────────

export const COUNTRY_IN_EMPTY_ERROR = 'Ajoute au moins un pays à cibler.';

export const PRODUCT_EMPTY_ERROR =
  'Choisis un produit pour le critère « A commandé produit X ».';

export function unknownCountryError(code: string): string {
  return `Code pays inconnu « ${code.trim().toUpperCase()} » — retire-le ou remplace-le.`;
}

function ruleBetweenTuple(rule: Rule): readonly [number, number] | readonly [string, string] | null {
  const r = rule as { operator?: string; value?: unknown };
  if (r.operator !== 'between') return null;
  if (!Array.isArray(r.value) || r.value.length !== 2) return null;
  return r.value as [number, number] | [string, string];
}

/**
 * Erreurs BLOQUANTES d'un RulesGroup avant sauvegarde (étape 2 du wizard).
 * Dédupliquées : chaque message n'apparaît qu'une fois même si plusieurs
 * règles le déclenchent.
 */
export function validateRulesForSave(group: RulesGroup): string[] {
  const errors: string[] = [];
  const push = (msg: string) => {
    if (!errors.includes(msg)) errors.push(msg);
  };

  const walk = (g: RulesGroup) => {
    for (const cond of g.conditions) {
      if ('conditions' in cond && Array.isArray(cond.conditions)) {
        walk(cond as RulesGroup);
        continue;
      }
      const rule = cond as Rule;

      // AUD-01 — règle tag neutralisée (legacy) : retrait obligatoire.
      if ((rule.kind === 'has_tag' || rule.kind === 'not_has_tag') && !TAGS_ENABLED) {
        push(TAG_RULE_STEP2_ERROR);
      }

      // AUD-02 — between : 2 bornes saisies, lo <= hi.
      const r = rule as { operator?: string; value?: unknown };
      if (r.operator === 'between') {
        const v = r.value;
        const incomplete =
          !Array.isArray(v) ||
          v.length !== 2 ||
          boundEmpty((v as unknown[])[0]) ||
          boundEmpty((v as unknown[])[1]);
        if (incomplete) {
          push(BETWEEN_INCOMPLETE_ERROR);
        } else {
          const tuple = ruleBetweenTuple(rule);
          if (tuple && !validateBetween(tuple).ok) push(BETWEEN_ERROR);
        }
      }

      // AUD-07 — country : codes connus uniquement, `in` non vide.
      if (rule.kind === 'country') {
        const codes = (Array.isArray(rule.value) ? rule.value : [rule.value])
          .map((c) => String(c).trim())
          .filter((c) => c.length > 0);
        if (rule.operator === 'in' && codes.length === 0) push(COUNTRY_IN_EMPTY_ERROR);
        for (const code of codes) {
          if (!isKnownCountry(code)) push(unknownCountryError(code));
        }
      }

      // AUD-09 — email_pattern in : au moins une chip.
      if (rule.kind === 'email_pattern' && rule.operator === 'in') {
        if (toPatternChips(rule.value).length === 0) push(EMAIL_PATTERN_IN_EMPTY_ERROR);
      }

      // has_ordered_product : productId vide → l'API renverrait 422 (Zod
      // min 1) — on bloque AVANT, avec un message actionnable.
      if (rule.kind === 'has_ordered_product' && rule.productId.trim().length === 0) {
        push(PRODUCT_EMPTY_ERROR);
      }
    }
  };

  walk(group);
  return errors;
}
