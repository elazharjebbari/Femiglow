/**
 * Versionnage & normalisation du payload de campagne (F05 G15).
 *
 * Le `email_campaign_link.payload_json` porte le contenu par étape du wizard.
 * Pour rester ÉVOLUTIF (ajout/réordonnancement d'étape sans casser les drafts
 * en cours), on :
 *  - versionne le payload (`_v`) — un draft legacy sans `_v` est toléré et migré ;
 *  - nomme les étapes (mapping clé ↔ numéro) au lieu d'un smallint 1..6 figé ;
 *  - normalise `wizard_step` (null/legacy/hors-borne → 1re étape).
 *
 * Pur (client+serveur), aucune dépendance DB.
 */

export const CAMPAIGN_PAYLOAD_VERSION = 2 as const;

/** Étapes du wizard, ORDONNÉES (l'index+1 = numéro `wizard_step`). */
export const WIZARD_STEP_KEYS = [
  'meta', // 1 — Nom / métadonnées
  'audience', // 2 — Audience / listes
  'content', // 3 — Contenu (template / corps)
  'subject', // 4 — Sujet / preheader / aperçu
  'schedule', // 5 — Planification (TZ)
  'review', // 6 — Récap / test-send
] as const;

export type WizardStepKey = (typeof WIZARD_STEP_KEYS)[number];

export const WIZARD_STEP_COUNT = WIZARD_STEP_KEYS.length;

/** Numéro 1-based d'une étape nommée (0 si inconnue). */
export function stepNumber(key: WizardStepKey): number {
  return WIZARD_STEP_KEYS.indexOf(key) + 1;
}

/** Clé nommée d'un numéro 1-based (null si hors-borne). */
export function stepKey(n: number): WizardStepKey | null {
  return WIZARD_STEP_KEYS[n - 1] ?? null;
}

/**
 * Normalise un `wizard_step` lu en base : null / non-fini / hors [1..N] →
 * 1 (un draft legacy ou corrompu rouvre à la première étape, jamais de crash).
 */
export function normalizeWizardStep(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 1;
  const n = Math.trunc(raw);
  if (n < 1) return 1;
  if (n > WIZARD_STEP_COUNT) return WIZARD_STEP_COUNT;
  return n;
}

export type CampaignPayload = Record<string, unknown> & { _v?: number };

/**
 * Lit un `payload_json` brut (potentiellement legacy/partiel) et renvoie un
 * payload NORMALISÉ + versionné, sans perte des champs inconnus (forward-compat).
 * Tolère : `null`/`undefined` (→ payload vide versionné), absence de `_v`
 * (legacy v1 → tag v courant), shape déjà à jour (no-op).
 */
export function migratePayload(raw: unknown): CampaignPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { _v: CAMPAIGN_PAYLOAD_VERSION };
  }
  const obj = raw as Record<string, unknown>;
  // v1 (legacy) = pas de `_v`. Aucune transformation de champ nécessaire à ce
  // jour ; on préserve tout et on tague la version courante. Les migrations de
  // forme futures (renommage/déplacement de champ) s'insèrent ICI par palier.
  return { ...obj, _v: CAMPAIGN_PAYLOAD_VERSION };
}
