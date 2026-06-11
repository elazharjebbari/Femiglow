/**
 * LEGAL-V2 — Feature flag pour le sprint pages légales.
 *
 * Active :
 *  - Nouveau naming des vars (CONTACT_*, HOST_*, CNDP_DECLARATION_REF)
 *  - Preset VERSION dans presetVarsForPage
 *  - UI bouton "+ Nouvelle variable" sur /admin/legal/template-vars
 *
 * Par défaut false pour rollback-safe.
 *
 * Cf. docs/pages-legales-fix-2026-05/00-context/decisions-architecturales.md ADR-002.
 */
import { env } from '@/lib/env';

export function isLegalVarsV2Enabled(): boolean {
  return env.LEGAL_VARS_V2 === 'true';
}
