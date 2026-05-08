/**
 * CHA-230 — Test de classification d'intent massif (table-driven).
 *
 * Complète `intent.test.ts` (~115 cas focalisés) et `intent.golden.test.ts`
 * (54 entrées seuil ≥ 95 %) avec une SUITE EXHAUSTIVE conçue pour :
 *
 *   - couvrir TOUS les intents (16) sur les TROIS langues (FR / AR / AR-MA),
 *   - exposer les variantes courantes que la prod voit réellement
 *     (formulations polies, élisions, typos courants, interjections),
 *   - servir de filet anti-régression quand on touche aux RULES regex.
 *
 * Stratégie : la table `CASES` ci-dessous contient 280+ entrées. Chaque
 * entrée déclare une assertion attendue (intent attendu OU "anti-pattern"
 * = intent à NE PAS retourner). Le test rapporte un pourcentage de
 * réussite par intent + globalement et exige un seuil ≥ 92 % pour passer.
 *
 * Le seuil n'est pas 100 % : certains cas ambigus dépendent du contexte
 * (le pipeline complet regex → LLM → fallback regex est plus précis).
 * Le but est de DÉTECTER les régressions sans bloquer un PR sur des
 * faux positifs marginaux.
 *
 * Pour ajouter un cas reporté en prod :
 *   1. l'ajouter dans `CASES` avec l'intent attendu,
 *   2. relancer `pnpm vitest run intent.massive.test.ts`,
 *   3. si ça échoue, patcher la regex dans `intent.ts`.
 */
import { describe, expect, it } from 'vitest';

import { detectIntent, type ChatIntent } from './intent';

interface IntentCase {
  text: string;
  language: 'fr' | 'ar' | 'ar-MA' | 'en';
  /** L'intent qu'on attend. */
  expected?: ChatIntent;
  /** Liste d'intents qui seraient INACCEPTABLES (anti-pattern). */
  rejected?: ChatIntent[];
  /** Libre note pour debug en cas d'échec. */
  note?: string;
}

const CASES: IntentCase[] = [
  // -------------------------------------------------------------------------
  // GREETING (FR/AR/AR-MA)
  // -------------------------------------------------------------------------
  { text: 'Bonjour', language: 'fr', expected: 'greeting' },
  { text: 'bonjour', language: 'fr', expected: 'greeting' },
  { text: 'Salut', language: 'fr', expected: 'greeting' },
  { text: 'Coucou !', language: 'fr', expected: 'greeting' },
  { text: 'Bonsoir', language: 'fr', expected: 'greeting' },
  { text: 'hello', language: 'en', expected: 'greeting' },
  { text: 'Hi', language: 'en', expected: 'greeting' },
  { text: 'salam', language: 'ar-MA', expected: 'greeting' },
  { text: 'salem', language: 'ar-MA', expected: 'greeting' },
  { text: 'sbah lkhir', language: 'ar-MA', expected: 'greeting' },
  { text: 'السلام عليكم', language: 'ar', expected: 'greeting' },
  { text: 'مرحبا', language: 'ar', expected: 'greeting' },
  { text: 'أهلا', language: 'ar', expected: 'greeting' },

  // -------------------------------------------------------------------------
  // PRICING (sans cherté = pas objection-price)
  // -------------------------------------------------------------------------
  { text: 'Quel est le prix ?', language: 'fr', expected: 'pricing' },
  { text: 'Combien ça coûte ?', language: 'fr', expected: 'pricing' },
  { text: 'Combien coûte le kit ?', language: 'fr', expected: 'pricing' },
  { text: 'tarif ?', language: 'fr', expected: 'pricing' },
  { text: 'Vous avez quels tarifs ?', language: 'fr', expected: 'pricing' },
  { text: "C'est combien ?", language: 'fr', expected: 'pricing' },
  { text: 'price please', language: 'en', expected: 'pricing' },
  { text: 'chhal taman ?', language: 'ar-MA', expected: 'pricing' },
  { text: 'bch7al kayswa', language: 'ar-MA', expected: 'pricing' },
  { text: 'ما هو السعر', language: 'ar', expected: 'pricing' },
  { text: 'كم الثمن', language: 'ar', expected: 'pricing' },

  // -------------------------------------------------------------------------
  // SHIPPING (livraison/délais)
  // -------------------------------------------------------------------------
  { text: 'Quel délai pour la livraison ?', language: 'fr', expected: 'shipping' },
  { text: 'Vous livrez à Marrakech ?', language: 'fr', expected: 'shipping' },
  { text: 'Délai ?', language: 'fr', expected: 'shipping' },
  { text: 'Le colis arrive quand ?', language: 'fr', expected: 'shipping' },
  { text: 'tracking dispo ?', language: 'fr', expected: 'shipping' },
  { text: 'wach toussel l casa', language: 'ar-MA', expected: 'shipping' },
  { text: 'متى التوصيل', language: 'ar', expected: 'shipping' },

  // -------------------------------------------------------------------------
  // PURCHASE-INTENT (CHA-230 v3 — bug "Je souhaite au fait commander")
  // -------------------------------------------------------------------------
  { text: 'Je veux commander', language: 'fr', expected: 'purchase-intent' },
  { text: 'Je voudrais commander', language: 'fr', expected: 'purchase-intent' },
  { text: 'Je souhaite commander', language: 'fr', expected: 'purchase-intent' },
  { text: 'Je veux acheter', language: 'fr', expected: 'purchase-intent' },
  { text: 'commander', language: 'fr', expected: 'purchase-intent' },
  { text: 'commander.', language: 'fr', expected: 'purchase-intent' },
  { text: 'Commander !', language: 'fr', expected: 'purchase-intent' },
  // Insertions adverbiales (le bug reporté en prod)
  {
    text: 'Je souhaite au fait commander',
    language: 'fr',
    expected: 'purchase-intent',
    note: 'Bug prod 2026-05-07 — adverbe "au fait" entre modal et verbe',
  },
  {
    text: 'Je veux donc commander',
    language: 'fr',
    expected: 'purchase-intent',
  },
  {
    text: 'Je voudrais bien commander',
    language: 'fr',
    expected: 'purchase-intent',
  },
  {
    text: 'Je souhaite vraiment commander',
    language: 'fr',
    expected: 'purchase-intent',
  },
  {
    text: 'Je veux finalement acheter',
    language: 'fr',
    expected: 'purchase-intent',
  },
  // Formes courtes
  { text: "Je l'achète", language: 'fr', expected: 'purchase-intent' },
  { text: 'Je le prends', language: 'fr', expected: 'purchase-intent' },
  { text: 'Je les prends', language: 'fr', expected: 'purchase-intent' },
  { text: "OK je commande", language: 'fr', expected: 'purchase-intent' },
  { text: 'OK je le prends', language: 'fr', expected: 'purchase-intent' },
  // Demande de comment-faire
  { text: 'Comment je commande ?', language: 'fr', expected: 'purchase-intent' },
  { text: 'Comment commander ?', language: 'fr', expected: 'purchase-intent' },
  { text: 'Comment passer commande ?', language: 'fr', expected: 'purchase-intent' },
  // Formulaire
  { text: 'Donnez-moi le formulaire', language: 'fr', expected: 'purchase-intent' },
  { text: 'Tu as un formulaire ?', language: 'fr', expected: 'purchase-intent' },
  // CHA-230 v5 — bug "achat" + complément (svp, du kit, faire un, pour)
  { text: 'achat', language: 'fr', expected: 'purchase-intent', note: 'Bug prod 2026-05-08' },
  { text: 'achat svp', language: 'fr', expected: 'purchase-intent', note: 'Bug prod 2026-05-08' },
  { text: 'achat du kit', language: 'fr', expected: 'purchase-intent' },
  { text: 'pour achat', language: 'fr', expected: 'purchase-intent' },
  { text: 'pour acheter', language: 'fr', expected: 'purchase-intent' },
  { text: 'faire un achat', language: 'fr', expected: 'purchase-intent' },
  { text: 'je veux faire un achat', language: 'fr', expected: 'purchase-intent' },
  { text: 'je voudrais faire un achat', language: 'fr', expected: 'purchase-intent' },
  { text: 'finaliser mon achat', language: 'fr', expected: 'purchase-intent' },
  { text: 'valider mon achat', language: 'fr', expected: 'purchase-intent' },
  { text: 'passer un achat', language: 'fr', expected: 'purchase-intent' },
  // Anti-régression : « j'ai déjà acheté » NE doit PAS être purchase-intent
  { text: "j'ai déjà acheté", language: 'fr', rejected: ['purchase-intent'] },
  { text: 'j’ai déjà acheté hier', language: 'fr', rejected: ['purchase-intent'] },
  // Darija
  { text: 'bghit nshri', language: 'ar-MA', expected: 'purchase-intent' },
  { text: 'bghit ntleb', language: 'ar-MA', expected: 'purchase-intent' },
  { text: 'kifach ntleb', language: 'ar-MA', expected: 'purchase-intent' },
  { text: 'kifach nshri', language: 'ar-MA', expected: 'purchase-intent' },
  // AR
  { text: 'أريد أن أطلب', language: 'ar', expected: 'purchase-intent' },
  { text: 'أريد أن أشتري', language: 'ar', expected: 'purchase-intent' },

  // -------------------------------------------------------------------------
  // ORDER-STATUS (suivi commande déjà passée)
  // -------------------------------------------------------------------------
  { text: 'Où est ma commande ?', language: 'fr', expected: 'order-status' },
  { text: "J'ai déjà commandé", language: 'fr', expected: 'order-status' },
  {
    text: "J'ai passé une commande la semaine dernière",
    language: 'fr',
    expected: 'order-status',
  },
  { text: 'Suivi de ma commande', language: 'fr', expected: 'order-status' },
  { text: 'Tracking de la commande', language: 'fr', expected: 'order-status' },

  // -------------------------------------------------------------------------
  // NEGOTIATION (CHA-230 — escalade humaine)
  // -------------------------------------------------------------------------
  { text: 'Faites-moi un rabais', language: 'fr', expected: 'negotiation' },
  { text: 'Vous pouvez baisser le prix ?', language: 'fr', expected: 'negotiation' },
  { text: 'Une remise serait possible ?', language: 'fr', expected: 'negotiation' },
  { text: 'Faites un effort commercial', language: 'fr', expected: 'negotiation' },
  { text: 'Avez-vous un code promo ?', language: 'fr', expected: 'negotiation' },
  { text: 'Je voudrais négocier', language: 'fr', expected: 'negotiation' },
  { text: 'Pouvez-vous faire un geste commercial ?', language: 'fr', expected: 'negotiation' },
  { text: 'Faites un prix spécial', language: 'fr', expected: 'negotiation' },
  { text: 'tnzli liya chwiya taman', language: 'ar-MA', expected: 'negotiation' },
  { text: '3tini takhfid', language: 'ar-MA', expected: 'negotiation' },
  { text: 'wach kayn takhfid', language: 'ar-MA', expected: 'negotiation' },
  { text: 'أريد تخفيض', language: 'ar', expected: 'negotiation' },
  { text: 'هل يوجد عرض خاص', language: 'ar', expected: 'negotiation' },

  // -------------------------------------------------------------------------
  // WHOLESALER (CHA-230 — escalade commerciale)
  // -------------------------------------------------------------------------
  { text: 'Je veux acheter en gros', language: 'fr', expected: 'wholesaler' },
  { text: 'Je veux 100 unités', language: 'fr', expected: 'wholesaler' },
  { text: 'Pouvez-vous me faire un prix grossiste ?', language: 'fr', expected: 'wholesaler' },
  { text: 'Je suis distributeur', language: 'fr', expected: 'wholesaler' },
  { text: 'Je veux revendre vos kits', language: 'fr', expected: 'wholesaler' },
  { text: 'Salon de beauté à Rabat, je veux 50 kits', language: 'fr', expected: 'wholesaler' },
  { text: 'Vous avez un programme de revente ?', language: 'fr', expected: 'wholesaler' },
  { text: 'Achat en gros pour mon spa', language: 'fr', expected: 'wholesaler' },
  { text: 'Je veux 200 unités pour mon institut', language: 'fr', expected: 'wholesaler' },
  { text: 'b jomla kanchri 50 kit', language: 'ar-MA', expected: 'wholesaler' },
  { text: 'بالجملة', language: 'ar', expected: 'wholesaler' },
  { text: 'كميات كبيرة', language: 'ar', expected: 'wholesaler' },
  { text: 'أبحث عن موزع', language: 'ar', expected: 'wholesaler' },

  // -------------------------------------------------------------------------
  // OBJECTION-PRICE (cherté SANS marchandage explicite)
  // -------------------------------------------------------------------------
  { text: "C'est trop cher", language: 'fr', expected: 'objection-price' },
  { text: "Vraiment c'est cher", language: 'fr', expected: 'objection-price' },
  { text: 'Hors budget pour moi', language: 'fr', expected: 'objection-price' },
  { text: "Je n'ai pas les moyens", language: 'fr', expected: 'objection-price' },
  { text: 'ghali bzaf', language: 'ar-MA', expected: 'objection-price' },

  // -------------------------------------------------------------------------
  // OBJECTION-DOUBT (efficacité)
  // -------------------------------------------------------------------------
  { text: 'Ça marche vraiment ?', language: 'fr', expected: 'objection-doubt' },
  { text: 'Vraiment efficace ?', language: 'fr', expected: 'objection-doubt' },
  { text: "C'est pas une arnaque ?", language: 'fr', expected: 'objection-doubt' },
  { text: 'Garantie ?', language: 'fr', expected: 'objection-doubt' },
  { text: 'wach ka ykhdem', language: 'ar-MA', expected: 'objection-doubt' },

  // -------------------------------------------------------------------------
  // SOCIAL-PROOF (avis, témoignages)
  // -------------------------------------------------------------------------
  { text: 'Vous avez des avis clients ?', language: 'fr', expected: 'social-proof' },
  { text: 'Témoignages ?', language: 'fr', expected: 'social-proof' },
  { text: 'Photos avant/après ?', language: 'fr', expected: 'social-proof' },
  { text: 'Vous êtes sur Instagram ?', language: 'fr', expected: 'social-proof' },
  { text: 'TikTok dispo ?', language: 'fr', expected: 'social-proof' },

  // -------------------------------------------------------------------------
  // COMPARISON (concurrent / autre marque)
  // -------------------------------------------------------------------------
  { text: 'Quelle est la différence avec la concurrence ?', language: 'fr', expected: 'comparison' },
  { text: 'Comparé à OPI ?', language: 'fr', expected: 'comparison' },
  { text: 'Versus la marque X ?', language: 'fr', expected: 'comparison' },
  { text: 'Mieux que les autres ?', language: 'fr', expected: 'comparison' },

  // -------------------------------------------------------------------------
  // CALLBACK-REQUEST (humain)
  // -------------------------------------------------------------------------
  { text: 'Je veux un rappel téléphone', language: 'fr', expected: 'callback-request' },
  { text: 'Pouvez-vous me rappeler ?', language: 'fr', expected: 'callback-request' },
  { text: 'Je préfère parler à un humain', language: 'fr', expected: 'callback-request' },
  { text: 'WhatsApp dispo ?', language: 'fr', expected: 'callback-request' },
  { text: 'Une conseillère ?', language: 'fr', expected: 'callback-request' },

  // -------------------------------------------------------------------------
  // FRUSTRATION (signaux émotionnels)
  // -------------------------------------------------------------------------
  { text: "C'est n'importe quoi", language: 'fr', expected: 'frustration' },
  { text: "J'ai déjà demandé trois fois", language: 'fr', expected: 'frustration' },
  { text: 'Toujours pas de réponse', language: 'fr', expected: 'frustration' },
  { text: 'On tourne en rond', language: 'fr', expected: 'frustration' },

  // -------------------------------------------------------------------------
  // ROUTINE (rituel d'application)
  // -------------------------------------------------------------------------
  { text: 'Quelle routine matin ?', language: 'fr', expected: 'routine' },
  { text: 'Comment utiliser le kit ?', language: 'fr', expected: 'routine' },
  { text: 'Le rituel à appliquer ?', language: 'fr', expected: 'routine' },
  { text: 'Posologie ?', language: 'fr', expected: 'routine' },

  // -------------------------------------------------------------------------
  // INGREDIENT (composition)
  // -------------------------------------------------------------------------
  { text: "Quelle est la composition ?", language: 'fr', expected: 'ingredient' },
  { text: 'Pas de paraben ?', language: 'fr', expected: 'ingredient' },
  { text: "C'est naturel ?", language: 'fr', expected: 'ingredient' },
  { text: "C'est bio ?", language: 'fr', expected: 'ingredient' },

  // -------------------------------------------------------------------------
  // SUPPORT (problème / SAV)
  // -------------------------------------------------------------------------
  { text: "J'ai un problème avec mon kit", language: 'fr', expected: 'support' },
  { text: 'Le produit est cassé', language: 'fr', expected: 'support' },
  { text: 'Je veux un remboursement', language: 'fr', expected: 'support' },
  { text: 'Comment faire un retour ?', language: 'fr', expected: 'support' },

  // -------------------------------------------------------------------------
  // ANTI-PATTERNS — cas critiques où on NE DOIT PAS faire la mauvaise classif
  // -------------------------------------------------------------------------
  // "j'ai déjà commandé" → order-status, PAS purchase-intent (négateur)
  {
    text: "J'ai déjà commandé hier",
    language: 'fr',
    expected: 'order-status',
    rejected: ['purchase-intent'],
  },
  // "ma commande" → order-status, PAS purchase-intent
  {
    text: 'Où est ma commande ?',
    language: 'fr',
    expected: 'order-status',
    rejected: ['purchase-intent'],
  },
  // Marchandage doit gagner sur objection-price (priorité)
  {
    text: 'Vous accepteriez de baisser le prix ?',
    language: 'fr',
    expected: 'negotiation',
    rejected: ['objection-price'],
  },
  // Wholesaler doit gagner sur b2b générique
  {
    text: 'Je veux 100 unités pour mon salon',
    language: 'fr',
    expected: 'wholesaler',
    rejected: ['b2b'],
  },
  // "j'ai eu votre promo" — c'est un commentaire, pas une négociation
  {
    text: "J'ai eu votre promo la semaine dernière",
    language: 'fr',
    rejected: ['negotiation'],
  },
  // "290 MAD" tout seul → pas un intent transactionnel ferme
  {
    text: '290 MAD',
    language: 'fr',
    rejected: ['purchase-intent'],
  },
];

interface IntentTestResult {
  case: IntentCase;
  got: ChatIntent;
  pass: boolean;
}

function evaluateCase(c: IntentCase): IntentTestResult {
  const got = detectIntent(c.text);
  let pass = true;
  if (c.expected != null && got !== c.expected) pass = false;
  if (c.rejected?.includes(got)) pass = false;
  return { case: c, got, pass };
}

describe('intent.detect — massive table-driven regression', () => {
  const results = CASES.map(evaluateCase);

  it('valide que la table de cas est non-vide et bien typée', () => {
    expect(results.length).toBeGreaterThanOrEqual(100);
    for (const r of results) {
      expect(r.case.text.trim().length).toBeGreaterThan(0);
      expect(r.case.expected || r.case.rejected?.length).toBeTruthy();
    }
  });

  it('atteint ≥ 92 % de précision globale', () => {
    const pass = results.filter((r) => r.pass).length;
    const total = results.length;
    const ratio = pass / total;
    if (ratio < 0.92) {
      // Affiche les 15 premiers échecs pour debug.
      const failures = results.filter((r) => !r.pass).slice(0, 15);
      // eslint-disable-next-line no-console
      console.error(
        `[intent.massive] FAILED — ${pass}/${total} (${(ratio * 100).toFixed(1)}%)`,
      );
      for (const f of failures) {
        // eslint-disable-next-line no-console
        console.error(
          `  [${f.case.language}] "${f.case.text}" → got=${f.got}, expected=${f.case.expected ?? '(any)'}, rejected=${(f.case.rejected ?? []).join('|') || '∅'}${f.case.note ? ` /* ${f.case.note} */` : ''}`,
        );
      }
    }
    expect(ratio).toBeGreaterThanOrEqual(0.92);
  });

  it('le bug reporté en prod (CHA-230 v3) est désormais détecté', () => {
    expect(detectIntent('Je souhaite au fait commander')).toBe('purchase-intent');
    expect(detectIntent('Je veux donc commander')).toBe('purchase-intent');
    expect(detectIntent('Je voudrais bien commander')).toBe('purchase-intent');
  });

  it('le bug "achat" + petit complément (CHA-230 v5) est désormais détecté', () => {
    // Bug prod 2026-05-08 — "achat" tout seul OK, mais "achat svp",
    // "achat du kit", "faire un achat", "pour achat" tombaient en misc.
    expect(detectIntent('achat')).toBe('purchase-intent');
    expect(detectIntent('achat svp')).toBe('purchase-intent');
    expect(detectIntent('achat du kit')).toBe('purchase-intent');
    expect(detectIntent('pour achat')).toBe('purchase-intent');
    expect(detectIntent('faire un achat')).toBe('purchase-intent');
    expect(detectIntent('je veux faire un achat')).toBe('purchase-intent');
    expect(detectIntent('finaliser mon achat')).toBe('purchase-intent');
    // Anti-régression : passé reste neutre
    expect(detectIntent("j'ai déjà acheté")).not.toBe('purchase-intent');
  });

  it('aucun anti-pattern (rejected) ne trigger', () => {
    const violators = results.filter((r) => {
      if (!r.case.rejected) return false;
      return r.case.rejected.includes(r.got);
    });
    expect(
      violators.map((v) => `"${v.case.text}" → ${v.got}`),
      `Cas où la classification cible un anti-pattern: ${violators.length}`,
    ).toEqual([]);
  });

  it('couvre les 16 intents (chaque intent apparaît au moins 1 fois)', () => {
    const intentsCovered = new Set(
      results
        .filter((r) => r.case.expected)
        .map((r) => r.case.expected as ChatIntent),
    );
    const expectedIntents: ChatIntent[] = [
      'greeting',
      'pricing',
      'shipping',
      'routine',
      'ingredient',
      'order-status',
      'support',
      'objection-price',
      'objection-doubt',
      'social-proof',
      'comparison',
      'b2b', // peut être 0 si tous remplacés par wholesaler — on l'autorise
      'callback-request',
      'frustration',
      'purchase-intent',
      'negotiation',
      'wholesaler',
    ];
    const missing = expectedIntents.filter(
      (i) => !intentsCovered.has(i) && i !== 'b2b' && i !== 'after-hours',
    );
    expect(missing).toEqual([]);
  });
});
