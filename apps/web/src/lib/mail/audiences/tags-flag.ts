/**
 * Neutralisation des règles `has_tag` / `not_has_tag` (AUD-01, F08 étape 1).
 *
 * Le moteur de tags (M5.5) n'est pas livré : la table `lead_tag` est quasi
 * vide. Compiler ces règles donnerait :
 *   - has_tag     → EXISTS sur table vide → ~0 contact ciblé ;
 *   - not_has_tag → NOT EXISTS sur table vide → TOUTE la base (envoi de
 *     masse hors cible — défaut critique).
 * Les 3 surfaces (compilateur, menu d'ajout, règle existante) lisent CE flag :
 * la levée M5.5 consiste à passer ce flag à true ET à rebrancher les EXISTS
 * dans rules-compiler.ts (cf. commentaire sur les cases has_tag/not_has_tag).
 * Ne JAMAIS lever une surface sans les autres.
 *
 * Module client-safe (pas de 'server-only') : consommé par le menu du builder
 * et la bannière RuleEditor côté client, et par le compilateur côté serveur.
 */
export const TAGS_ENABLED = false;

/** Message de la bannière sur une règle tag existante (verbatim spec F08 §neutralisation). */
export const TAG_RULE_BANNER =
  "⛔ Critère inactif : le moteur de tags (M5.5) n'est pas livré. " +
  'Cette règle ne cible actuellement AUCUN contact. Retirez-la ou attendez M5.5.';

/** Message bloquant de l'étape 2 du wizard quand une règle tag est présente. */
export const TAG_RULE_STEP2_ERROR =
  'Une règle « tag » est inactive (M5.5 non livré). Retirez-la pour continuer.';
