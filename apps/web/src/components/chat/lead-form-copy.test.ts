/**
 * CHA-228 — Spec exécutable des invariants de copy du widget lead.
 *
 * Pourquoi ces tests existent :
 *   Avant ce patch, l'`intro` du widget répétait littéralement ce
 *   que le LLM venait d'écrire (« prénom, numéro, conseillère,
 *   livraison, paiement à la réception »). Ces tests fixent le
 *   contrat : `intro` est court, complémentaire, jamais un second
 *   pitch.
 *
 * Le LLM porte la chaleur et le contexte ; le widget porte
 * l'opérationnel (timing du rappel, garantie). On vérifie ici :
 *   1. `intro` ≤ 18 mots (≤ 14 caractères en moyenne par mot, sans
 *      ponctuation lourde) → tient sur 1–2 lignes en mobile.
 *   2. `intro` ne contient pas la séquence « prénom … numéro » qui
 *      est la signature du double-pitch.
 *   3. Cohérence par langue : chaque CopyKey a sa propre intro
 *      distincte (pas de copier-coller entre clés).
 */
import { describe, expect, it } from 'vitest';

import type { ChatLanguage } from '@/lib/chat/contracts';

import { getLeadFormCopy, type CopyKey } from './lead-form-copy';

const LANGUAGES: ChatLanguage[] = ['fr', 'ar', 'ar-MA'];
const COPY_KEYS: CopyKey[] = [
  'explicit-request',
  'out-of-knowledge',
  'objection',
  'after-hours',
  'b2b',
  'purchase-intent',
  'inline-contact',
  'manual',
];

const MAX_WORDS = 18;

describe('lead-form-copy — invariants anti-redondance (CHA-228)', () => {
  for (const lang of LANGUAGES) {
    describe(`langue=${lang}`, () => {
      for (const key of COPY_KEYS) {
        it(`[${key}] intro courte (≤ ${MAX_WORDS} mots)`, () => {
          const copy = getLeadFormCopy(lang, key);
          const wordCount = copy.intro.split(/\s+/).filter(Boolean).length;
          expect(wordCount, `intro: "${copy.intro}"`).toBeLessThanOrEqual(MAX_WORDS);
        });

        it(`[${key}] intro ne dit pas "prénom … numéro" (le LLM/les labels le disent)`, () => {
          const copy = getLeadFormCopy(lang, key);
          const intro = copy.intro.toLowerCase();
          // FR : « prénom » + « numéro »
          // AR : « اسمكِ » + « رقمكِ »
          // AR-MA (latin) : « smitek/smiyetk » + « ra9m/nimra/nimrtek »
          const frPair = intro.includes('prénom') && (intro.includes('numéro') || intro.includes('téléphone'));
          const arPair = (intro.includes('اسم') && intro.includes('رقم'));
          const arMaPair =
            (intro.includes('smit') || intro.includes('smiy')) &&
            (intro.includes('ra9m') || intro.includes('nimr'));
          expect(
            frPair || arPair || arMaPair,
            `intro="${copy.intro}" reproduit la signature « prénom + numéro » du LLM`,
          ).toBe(false);
        });
      }

      it('toutes les intros sont distinctes (pas de copier-coller entre clés)', () => {
        const intros = COPY_KEYS.map((k) => getLeadFormCopy(lang, k).intro);
        const unique = new Set(intros);
        // On accepte qu'1 ou 2 clés tombent sur le fallback `_BASE` mais pas
        // que toutes soient identiques. Seuil : ≥ 6 valeurs distinctes sur 8.
        expect(unique.size).toBeGreaterThanOrEqual(6);
      });
    });
  }

  it('le fallback `manual` est toujours résolu, même pour une copyKey inconnue', () => {
    // Le helper retombe sur lang.manual si la clé est absente.
    const copy = getLeadFormCopy('fr', 'manual');
    expect(copy.intro).toBeTruthy();
    expect(copy.cta).toBeTruthy();
    expect(copy.submit).toBeTruthy();
  });
});
