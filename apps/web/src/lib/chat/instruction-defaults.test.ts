/**
 * CHA-245 — verrouille la base de connaissance produit injectée dans
 * la prompt système v2.4 (FR + AR + AR-MA).
 *
 * Ces tests existent pour qu'on n'enlève pas par mégarde des **faits
 * durs** lus dans `apps/web/src/data/mock/kit.ts` quand on retouche le
 * style éditorial du prompt. Si l'un de ces tests casse, c'est qu'un
 * fait durci (prix, délais, composition, COD, escalade…) a sauté de
 * la prompt — et l'hôtesse va à nouveau halluciner ou esquiver vers
 * le formulaire sur des questions qu'elle devrait savoir traiter.
 *
 * Les vérifications sont **substring-based** : on cherche la présence
 * du fait, pas un wording exact. Le copywriter garde la main sur la
 * formulation.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INSTRUCTION_AR_MA_V2,
  DEFAULT_INSTRUCTION_AR_V2,
  DEFAULT_INSTRUCTION_FR_V2,
  DEFAULT_INSTRUCTION_NOTES_V2,
} from './instruction-defaults';

describe('DEFAULT_INSTRUCTION_FR_V2 (CHA-245 — connaissance produit)', () => {
  it('mentionne le prix unique 199 dh', () => {
    expect(DEFAULT_INSTRUCTION_FR_V2).toMatch(/199\s*dh/i);
  });

  it('expose la composition (Paste cire d\'abeille + jojoba, Powder talc + riz + silice, Polissoir kaolin)', () => {
    const body = DEFAULT_INSTRUCTION_FR_V2;
    expect(body).toMatch(/1 Paste/);
    expect(body).toMatch(/2 Powder/);
    expect(body).toMatch(/Polissoir Step 4/);
    expect(body).toMatch(/cire d.abeille/i);
    expect(body).toMatch(/jojoba/i);
    expect(body).toMatch(/talc/i);
    expect(body).toMatch(/riz/i);
    expect(body).toMatch(/silice/i);
    expect(body).toMatch(/kaolin/i);
    expect(body).toMatch(/toco?ph[eé]rol/i);
  });

  it('liste les certifications (Cosmos Organic + Halal + Vegan)', () => {
    expect(DEFAULT_INSTRUCTION_FR_V2).toMatch(/Cosmos Organic/);
    expect(DEFAULT_INSTRUCTION_FR_V2).toMatch(/Halal/);
    expect(DEFAULT_INSTRUCTION_FR_V2).toMatch(/Vegan/);
  });

  it('donne les délais de livraison concrets (24 h Rabat, 48-72 h Maroc)', () => {
    const body = DEFAULT_INSTRUCTION_FR_V2;
    expect(body).toMatch(/Rabat/);
    expect(body).toMatch(/24\s*h/);
    expect(body).toMatch(/48\s*[àa]\s*72/);
  });

  it('décrit le COD (paiement à la livraison + vérification du colis avant paiement)', () => {
    const body = DEFAULT_INSTRUCTION_FR_V2;
    expect(body).toMatch(/Paiement à la livraison|cash on delivery/i);
    expect(body).toMatch(/vérifier|vérification/i);
    expect(body).toMatch(/avant.*payer|avant le paiement|avant paiement/i);
  });

  it('mentionne l\'autonomie 4 à 5 mois', () => {
    expect(DEFAULT_INSTRUCTION_FR_V2).toMatch(/quatre à cinq mois|4 à 5 mois/i);
  });

  it('annonce la brillance qui tient au moins trois semaines', () => {
    expect(DEFAULT_INSTRUCTION_FR_V2).toMatch(/trois semaines|3 semaines/i);
  });

  it('a une grille « Questions complexes → formulaire » avec médical, B2B, négociation, SAV, juridique', () => {
    const body = DEFAULT_INSTRUCTION_FR_V2;
    expect(body).toMatch(/Questions complexes.*formulaire/i);
    expect(body).toMatch(/médical|mycose/i);
    expect(body).toMatch(/B2B|revente/i);
    expect(body).toMatch(/Négociation|remise/i);
    expect(body).toMatch(/SAV|colis abîmé/i);
    expect(body).toMatch(/juridique|RGPD/i);
  });

  it('a une section « Réponses-types aux questions simples » qui couvre les sujets fréquents', () => {
    const body = DEFAULT_INSTRUCTION_FR_V2;
    expect(body).toMatch(/Réponses-types/i);
    expect(body).toMatch(/Délais de livraison/i);
    expect(body).toMatch(/Comment commander/i);
    expect(body).toMatch(/Paiement à la livraison/i);
    expect(body).toMatch(/Composition/i);
  });
});

describe('DEFAULT_INSTRUCTION_AR_V2 (CHA-245 — connaissance produit, arabe)', () => {
  it('mentionne le prix 199 درهم', () => {
    expect(DEFAULT_INSTRUCTION_AR_V2).toMatch(/199\s*درهم/);
  });

  it('expose la composition (Paste, Powder, Polissoir avec ingrédients clés)', () => {
    const body = DEFAULT_INSTRUCTION_AR_V2;
    expect(body).toMatch(/1 Paste/);
    expect(body).toMatch(/2 Powder/);
    expect(body).toMatch(/Polissoir Step 4/);
    expect(body).toMatch(/شمع العسل/);
    expect(body).toMatch(/جوجوبا/);
    expect(body).toMatch(/تلك/);
    expect(body).toMatch(/كاولين/);
  });

  it('donne les délais de livraison concrets (24 ساعة Rabat, 48-72 ساعة Maroc)', () => {
    const body = DEFAULT_INSTRUCTION_AR_V2;
    expect(body).toMatch(/الرباط/);
    expect(body).toMatch(/24\s*ساعة/);
    expect(body).toMatch(/48\s*إلى\s*72/);
  });

  it('décrit le COD (الدفع عند الاستلام + التحقّق من الطرد قبل الدفع)', () => {
    const body = DEFAULT_INSTRUCTION_AR_V2;
    expect(body).toMatch(/الدفع عند الاستلام/);
    expect(body).toMatch(/التحقّق|التحقق/);
    expect(body).toMatch(/قبل الدفع/);
  });

  it('a une grille « questions complexes → formulaire »', () => {
    const body = DEFAULT_INSTRUCTION_AR_V2;
    expect(body).toMatch(/الأسئلة المعقّدة|الأسئلة المعقدة/);
    expect(body).toMatch(/B2B/);
    expect(body).toMatch(/RGPD|قانوني/);
  });
});

describe('DEFAULT_INSTRUCTION_AR_MA_V2 (CHA-245 — connaissance produit, darija)', () => {
  it('mentionne le prix 199 dh', () => {
    expect(DEFAULT_INSTRUCTION_AR_MA_V2).toMatch(/199\s*dh/i);
  });

  it('expose la composition (Paste, Powder, Polissoir avec ingrédients clés)', () => {
    const body = DEFAULT_INSTRUCTION_AR_MA_V2;
    expect(body).toMatch(/1 Paste/);
    expect(body).toMatch(/2 Powder/);
    expect(body).toMatch(/Polissoir Step 4/);
    expect(body).toMatch(/shem3 n7l/i);
    expect(body).toMatch(/jojoba/i);
    expect(body).toMatch(/talc/i);
    expect(body).toMatch(/kaolin/i);
  });

  it('donne les délais de livraison concrets (24 sa3a Rabat, 48-72 sa3a Maroc)', () => {
    const body = DEFAULT_INSTRUCTION_AR_MA_V2;
    expect(body).toMatch(/Rabat/i);
    expect(body).toMatch(/24\s*sa3a/i);
    expect(body).toMatch(/48\s*l\s*72/i);
  });

  it('décrit le COD (khalsan f l-livraison + tafti7 9bel l-khalss)', () => {
    const body = DEFAULT_INSTRUCTION_AR_MA_V2;
    expect(body).toMatch(/Khalsan f l-livraison|cash on delivery/i);
    expect(body).toMatch(/Tafti7 l-colis 9bel l-khalss|t2akkid mn l-mantouj 9bel/i);
  });

  it('a une grille « L-souwa2el l-mou3aqada → formulaire »', () => {
    const body = DEFAULT_INSTRUCTION_AR_MA_V2;
    expect(body).toMatch(/souwa2el l-mou3aqada/i);
    expect(body).toMatch(/B2B/);
    expect(body).toMatch(/RGPD|qanouni/i);
  });
});

describe('DEFAULT_INSTRUCTION_NOTES_V2 (CHA-245 — bump v2.4)', () => {
  it('commence par le label v2.4', () => {
    expect(DEFAULT_INSTRUCTION_NOTES_V2.startsWith('v2.4-')).toBe(true);
  });

  it('mentionne les ajouts clés (composition, 199 dh, livraison concrète, brillance 3 semaines, questions complexes)', () => {
    const notes = DEFAULT_INSTRUCTION_NOTES_V2;
    expect(notes).toMatch(/199\s*dh/i);
    expect(notes).toMatch(/cire d.abeille|composition/i);
    expect(notes).toMatch(/24\s*h|Rabat/);
    expect(notes).toMatch(/3 semaines|brillance/i);
    expect(notes).toMatch(/questions complexes|formulaire/i);
  });
});
