/**
 * CHA-032 / CHA-075 — Détection de langue.
 *
 * Heuristique :
 * - Si le texte contient ≥ 3 caractères arabes consécutifs → `ar`.
 * - Si le texte contient ≥ 2 mots du dictionnaire darija FR-script
 *   (`bzzaf`, `wakha`, `chno`, `bghit`, …) → `ar-MA`.
 * - Sinon défaut FR.
 *
 * cf. docs/chat-assistant/06-multilingue-humanisation.md
 */
import type { ChatLanguage } from '../contracts';

import { DARIJA_AR_TOKENS, DARIJA_FR_TOKENS, MSA_AR_TOKENS } from './dictionary';

const ARABIC_BLOCK = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Source unique : `dictionary.ts` (versionné). On indexe en lower-case
// pour matcher le tokenisateur.
const DARIJA_FR_DICT = new Set(DARIJA_FR_TOKENS.map((t) => t.toLowerCase()));

export function detectLanguage(text: string): ChatLanguage {
  if (!text) return 'fr';
  const trimmed = text.trim();
  if (!trimmed) return 'fr';
  // Compte les caractères arabes
  let arabicCount = 0;
  for (const ch of trimmed) {
    if (ARABIC_BLOCK.test(ch)) arabicCount++;
    if (arabicCount >= 3) break;
  }
  if (arabicCount >= 3) {
    // Affine ar vs ar-MA via le dictionnaire darija script arabe.
    let darijaArHits = 0;
    let msaHits = 0;
    for (const tok of DARIJA_AR_TOKENS) {
      if (trimmed.includes(tok)) darijaArHits++;
      if (darijaArHits >= 1) break;
    }
    for (const tok of MSA_AR_TOKENS) {
      if (trimmed.includes(tok)) msaHits++;
      if (msaHits >= 2) break;
    }
    if (darijaArHits >= 1 && msaHits < 2) return 'ar-MA';
    return 'ar';
  }
  // Heuristique darija FR-script
  const tokens = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9'\u00C0-\u017F\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let hits = 0;
  for (const t of tokens) {
    if (DARIJA_FR_DICT.has(t)) hits++;
    if (hits >= 2) break;
  }
  if (hits >= 2) return 'ar-MA';
  return 'fr';
}
