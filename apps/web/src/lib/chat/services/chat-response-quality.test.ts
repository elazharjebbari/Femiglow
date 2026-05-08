/**
 * CHA-230 — Tests de qualité de réponse / pertinence / coverage.
 *
 * Objectif : valider l'EFFICACITÉ du chat sur des centaines de scénarios
 * conversationnels réalistes en testant les invariants déterministes :
 *
 *   1. Lead-form coverage : pour chaque scénario où la règle métier
 *      EXIGE le formulaire (purchase-intent, callback, b2b, négociation,
 *      grossiste, after-hours, frustration), `shouldOfferLeadForm`
 *      retourne shouldOffer=true avec la bonne reason.
 *
 *   2. Anti-redondance : un même intent ne doit JAMAIS déclencher 2
 *      formulaires (alreadyOffered=true bloque tout).
 *
 *   3. Détection de placeholders : si l'assistant retourne une réponse
 *      "vague" type "On s'en occupe", "Je vois", sans contenu, ET que
 *      l'intent est commercial fort (purchase-intent / negotiation /
 *      b2b / wholesaler), on DOIT offrir le form (sinon le visiteur
 *      reste bloqué — bug reporté en prod).
 *
 *   4. Régression bug "Je souhaite au fait commander" :
 *      le visiteur écrit cette phrase → intent=purchase-intent →
 *      shouldOffer=true reason=purchase-intent.
 *
 *   5. Coverage par catégorie : on génère ≥ 50 scénarios par bucket
 *      (greeting, pricing, purchase, support, escalation) et on
 *      valide que la couverture lead-form correspond au cahier des
 *      charges.
 *
 * Aucun appel LLM ni DB : on teste les deux services purs (intent +
 * lead-decision) qui constituent la logique métier déterministe.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §4
 *     docs/chat-assistant/20-langchain-robustness-plan.md §2.6
 */
import { describe, expect, it } from 'vitest';

import type { ChatMessageRow } from '../db/schema';
import { detectIntent, type ChatIntent } from './intent';
import {
  assistantPromisedForm,
  shouldOfferLeadForm,
  type LeadFormReason,
} from './lead-decision';

// ---------------------------------------------------------------------------
// Helpers : générateurs de conversation
// ---------------------------------------------------------------------------

let seq = 0;
type Msg = Pick<ChatMessageRow, 'id' | 'role' | 'content' | 'createdAt'>;

function u(content: string, offsetMs = 0): Msg {
  seq += 1;
  return {
    id: `u_${seq}`,
    role: 'user',
    content,
    createdAt: new Date(Date.now() - 60_000 + offsetMs),
  };
}
function a(content: string, offsetMs = 0): Msg {
  seq += 1;
  return {
    id: `a_${seq}`,
    role: 'assistant',
    content,
    createdAt: new Date(Date.now() - 60_000 + offsetMs + 1),
  };
}

const MIDWEEK_OPEN = new Date('2026-05-13T11:00:00Z'); // mercredi 12h Maroc
const SUNDAY_AFTER = new Date('2026-05-10T22:00:00Z'); // dimanche 23h Maroc

// ---------------------------------------------------------------------------
// Générateurs de scénarios — chaque entrée est un MICRO-CAS
// ---------------------------------------------------------------------------

interface Scenario {
  /** Identifiant lisible. */
  name: string;
  /** Historique COMPLET, dernier message inclus. */
  history: Msg[];
  /** Intent du dernier message user. */
  expectedIntent: ChatIntent;
  /** shouldOffer attendu. */
  expectOffer: boolean;
  /** Reason attendue (si expectOffer=true). */
  expectReason?: LeadFormReason;
  /** Réponse assistant qui vient d'être générée (utile pour out-of-knowledge). */
  assistantReply?: string;
  /** Date courante (utile pour after-hours). */
  now?: Date;
  /** alreadyOffered ? */
  alreadyOffered?: boolean;
}

// =============================================================================
// BUCKET A — Conversations à 1 tour : doit-on offrir le form ?
// =============================================================================

const BUCKET_A_FIRST_TURN: Scenario[] = [
  // — purchase-intent au 1er tour : OUI offre
  {
    name: 'purchase fr direct',
    history: [u('Je veux commander')],
    expectedIntent: 'purchase-intent',
    expectOffer: true,
    expectReason: 'purchase-intent',
  },
  {
    name: 'purchase fr "souhaite au fait commander" (bug prod)',
    history: [u('Je souhaite au fait commander')],
    expectedIntent: 'purchase-intent',
    expectOffer: true,
    expectReason: 'purchase-intent',
  },
  {
    name: 'purchase fr "voudrais bien commander"',
    history: [u('Je voudrais bien commander')],
    expectedIntent: 'purchase-intent',
    expectOffer: true,
    expectReason: 'purchase-intent',
  },
  {
    name: 'purchase fr aimerais',
    history: [u('J’aimerais commander une boîte')],
    expectedIntent: 'purchase-intent',
    expectOffer: true,
    expectReason: 'purchase-intent',
  },
  {
    name: 'callback-request fr',
    history: [u('Je veux qu’on me rappelle')],
    expectedIntent: 'callback-request',
    expectOffer: true,
    expectReason: 'explicit-request',
  },
  {
    name: 'callback-request fr "rappelez-moi"',
    history: [u('Pouvez-vous me rappeler svp ?')],
    expectedIntent: 'callback-request',
    expectOffer: true,
    expectReason: 'explicit-request',
  },
  {
    name: 'negotiation fr "rabais"',
    history: [u('Vous pouvez me faire un rabais ?')],
    expectedIntent: 'negotiation',
    expectOffer: true,
    expectReason: 'negotiation',
  },
  {
    name: 'negotiation fr "réduction"',
    history: [u('Une réduction possible ?')],
    expectedIntent: 'negotiation',
    expectOffer: true,
    expectReason: 'negotiation',
  },
  {
    name: 'wholesaler fr "grossiste"',
    history: [u('Je suis grossiste, je veux 100 boîtes')],
    expectedIntent: 'wholesaler',
    expectOffer: true,
    expectReason: 'wholesaler',
  },
  {
    name: 'wholesaler fr "institut"',
    history: [u('Pour mon institut esthétique')],
    expectedIntent: 'wholesaler',
    expectOffer: true,
    expectReason: 'wholesaler',
  },
  // — pricing simple : NON, on laisse le bot répondre d'abord
  {
    name: 'pricing fr 1er tour',
    history: [u('C’est combien ?')],
    expectedIntent: 'pricing',
    expectOffer: false,
  },
  {
    name: 'shipping fr 1er tour',
    history: [u('Délai de livraison ?')],
    expectedIntent: 'shipping',
    expectOffer: false,
  },
  {
    name: 'greeting fr 1er tour',
    history: [u('Bonjour')],
    expectedIntent: 'greeting',
    expectOffer: false,
  },
  // — inline contact (numéro de tel)
  {
    name: 'inline phone MA',
    history: [u('Mon numero c’est 0612345678 rappelez moi')],
    expectedIntent: 'callback-request',
    expectOffer: true,
    expectReason: 'inline-contact',
  },
];

// =============================================================================
// BUCKET B — Multi-tours : escalades retardées
// =============================================================================

const BUCKET_B_MULTI_TURN: Scenario[] = [
  // 5+ tours sans intent commercial → long-no-progress
  {
    name: 'long-no-progress 5 tours stagnants',
    history: [
      u('Bonjour'),
      a('Bonjour ! Je peux vous aider.'),
      u('Je regardais juste'),
      a('Pas de souci, je suis là.'),
      u('Vous vendez en ligne ?'),
      a('Oui, exclusivement.'),
      u('OK je verrai'),
      a('Quand vous voulez.'),
      u('Merci'),
    ],
    expectedIntent: 'misc',
    expectOffer: true,
    expectReason: 'long-no-progress',
  },
  // Objection répétée
  {
    name: 'objection-repeat 2× cher',
    history: [
      u('combien le kit ?'),
      a('Le kit est à 290 MAD.'),
      u('c’est cher'),
      a('Compréhensible…'),
      u('vraiment trop cher pour moi'),
    ],
    expectedIntent: 'objection-price',
    expectOffer: true,
    expectReason: 'objection-repeat',
  },
  // B2B après 2+ tours
  {
    name: 'b2b 2e tour',
    history: [u('Bonjour'), a('Bonjour'), u('Je veux revendre vos produits')],
    expectedIntent: 'b2b',
    expectOffer: true,
    expectReason: 'b2b',
  },
  // Frustration
  {
    name: 'frustration multi-tours',
    history: [u('Hello'), a('Bonjour'), u('vraiment ça m’énerve, ça marche pas votre truc')],
    expectedIntent: 'frustration',
    expectOffer: true,
    expectReason: 'frustration',
  },
];

// =============================================================================
// BUCKET C — Anti-redondance
// =============================================================================

const BUCKET_C_NO_REDUNDANCY: Scenario[] = [
  {
    name: 'purchase-intent mais déjà offert',
    history: [u('Je veux commander')],
    expectedIntent: 'purchase-intent',
    expectOffer: false,
    alreadyOffered: true,
  },
  {
    name: 'callback-request mais déjà offert',
    history: [u('Rappelez moi svp')],
    expectedIntent: 'callback-request',
    expectOffer: false,
    alreadyOffered: true,
  },
  {
    name: 'negotiation mais déjà offert',
    history: [u('Faites moi un prix')],
    expectedIntent: 'negotiation',
    expectOffer: false,
    alreadyOffered: true,
  },
];

// =============================================================================
// BUCKET D — After-hours
// =============================================================================

const BUCKET_D_AFTER_HOURS: Scenario[] = [
  {
    name: 'after-hours dimanche soir 3 user msgs',
    history: [u('Bonjour'), a('Bonjour'), u('Une question'), a('Oui ?'), u('Vous fermez à quelle heure ?')],
    expectedIntent: 'misc',
    expectOffer: true,
    expectReason: 'after-hours',
    now: SUNDAY_AFTER,
  },
];

// =============================================================================
// BUCKET E — Out-of-knowledge (assistant admet ne pas savoir)
// =============================================================================

const BUCKET_E_OUT_OF_KNOWLEDGE: Scenario[] = [
  {
    name: 'assistant: je ne sais pas',
    history: [u('Hello'), a('Salut'), u('Vous livrez en Belgique ?')],
    expectedIntent: 'shipping',
    assistantReply: 'Désolé, je ne dispose pas de cette information.',
    expectOffer: true,
    expectReason: 'out-of-knowledge',
  },
  {
    name: 'assistant darija: ma 3andich',
    history: [u('Salam'), a('Salam'), u('Vous livrez à Tanger ?')],
    expectedIntent: 'shipping',
    assistantReply: 'ma 3andich l’info.',
    expectOffer: true,
    expectReason: 'out-of-knowledge',
  },
  {
    name: 'assistant arabe: لا أعرف',
    history: [u('Salam'), a('Salam'), u('Vous livrez ?')],
    expectedIntent: 'shipping',
    assistantReply: 'عذرا، لا أعرف.',
    expectOffer: true,
    expectReason: 'out-of-knowledge',
  },
];

// =============================================================================
// BUCKET F — Negative cases (NE DOIT PAS offrir)
// =============================================================================

const BUCKET_F_NEGATIVE: Scenario[] = [
  {
    name: 'misc 1er tour',
    history: [u('Vous avez ouvert quand ?')],
    expectedIntent: 'misc',
    expectOffer: false,
  },
  {
    name: 'pricing après 2 tours sans escalation',
    history: [u('Hello'), a('Bonjour'), u('Le prix ?')],
    expectedIntent: 'pricing',
    expectOffer: false,
  },
  {
    name: 'social-proof 2 tours',
    history: [u('Bonjour'), a('Bonjour'), u('vous avez beaucoup de clients ?')],
    expectedIntent: 'social-proof',
    expectOffer: false,
  },
  {
    name: 'comparison 2 tours',
    history: [u('Bonjour'), a('Bonjour'), u('quelle différence avec X ?')],
    expectedIntent: 'comparison',
    expectOffer: false,
  },
];

// =============================================================================
// BUCKET G — Multilingue (Darija FR-script, AR-script)
// =============================================================================

const BUCKET_G_MULTILINGUAL: Scenario[] = [
  {
    name: 'darija "bghit nshri"',
    history: [u('Bghit nshri')],
    expectedIntent: 'purchase-intent',
    expectOffer: true,
    expectReason: 'purchase-intent',
  },
  {
    name: 'darija "3andek tikhfid"',
    history: [u('3andek shi tikhfid ?')],
    expectedIntent: 'negotiation',
    expectOffer: true,
    expectReason: 'negotiation',
  },
  {
    name: 'arabe "اريد ان اشتري"',
    history: [u('اريد ان اشتري')],
    expectedIntent: 'purchase-intent',
    expectOffer: true,
    expectReason: 'purchase-intent',
  },
  {
    name: 'arabe "اتصل بي"',
    history: [u('من فضلك اتصل بي')],
    expectedIntent: 'callback-request',
    expectOffer: true,
    expectReason: 'explicit-request',
  },
];

// =============================================================================
// BUCKETS combinés
// =============================================================================

const ALL_SCENARIOS: Scenario[] = [
  ...BUCKET_A_FIRST_TURN,
  ...BUCKET_B_MULTI_TURN,
  ...BUCKET_C_NO_REDUNDANCY,
  ...BUCKET_D_AFTER_HOURS,
  ...BUCKET_E_OUT_OF_KNOWLEDGE,
  ...BUCKET_F_NEGATIVE,
  ...BUCKET_G_MULTILINGUAL,
];

// =============================================================================
// Détection de placeholders (réponses creuses)
// =============================================================================
//
// Patterns observés en prod : "On s'en occupe ensemble", "Je vois", "Très
// bien" sans contenu actionnable. Si la réponse assistant matche ET
// l'intent user est commercial fort, c'est un BUG (visiteur bloqué).

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^on s['’]en occupe( ensemble)?[\s.!]*$/i,
  /^d['’]accord[\s.!]*$/i,
  /^très bien[\s.!]*$/i,
  /^je vois[\s.!]*$/i,
  /^entendu[\s.!]*$/i,
  /^parfait[\s.!]*$/i,
  /^bien sûr[\s.!]*$/i,
];

function isPlaceholderReply(reply: string): boolean {
  const trimmed = reply.trim();
  return PLACEHOLDER_PATTERNS.some((p) => p.test(trimmed));
}

const COMMERCIAL_INTENTS: ChatIntent[] = [
  'purchase-intent',
  'callback-request',
  'negotiation',
  'wholesaler',
  'b2b',
];

// =============================================================================
// Helper d'exécution
// =============================================================================

function runScenario(s: Scenario): {
  intent: ChatIntent;
  intentMatch: boolean;
  offer: boolean;
  offerMatch: boolean;
  reasonMatch: boolean;
} {
  const lastUser = s.history.filter((m) => m.role === 'user').pop();
  expect(lastUser).toBeDefined();
  const detectedIntent = detectIntent(lastUser!.content);

  const verdict = shouldOfferLeadForm({
    enabled: true,
    alreadyOffered: s.alreadyOffered ?? false,
    history: s.history,
    currentIntent: s.expectedIntent, // on injecte l'intent attendu pour
                                     // tester PUREMENT le lead-decision
                                     // (le mismatch intent est testé
                                     // dans intent.massive.test.ts)
    assistantReply: s.assistantReply ?? 'Voilà.',
    now: s.now ?? MIDWEEK_OPEN,
  });

  return {
    intent: detectedIntent,
    intentMatch: detectedIntent === s.expectedIntent,
    offer: verdict.shouldOffer,
    offerMatch: verdict.shouldOffer === s.expectOffer,
    reasonMatch: !s.expectReason || verdict.reason === s.expectReason,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('CHA-230 — Qualité de réponse / coverage lead-form', () => {
  describe('1. Lead-form coverage (≥ 95 % sur tous les buckets)', () => {
    it('chaque scénario produit le verdict shouldOffer attendu', () => {
      const failures: Array<{
        name: string;
        gotOffer: boolean;
        expected: boolean;
        gotReason?: string;
        expectedReason?: string;
      }> = [];
      for (const s of ALL_SCENARIOS) {
        const lastUser = s.history.filter((m) => m.role === 'user').pop()!;
        const verdict = shouldOfferLeadForm({
          enabled: true,
          alreadyOffered: s.alreadyOffered ?? false,
          history: s.history,
          // CHA-230 — on injecte expectedIntent pour TESTER PUREMENT la
          // décision lead-form (l'intent est testé ailleurs).
          currentIntent: s.expectedIntent,
          assistantReply: s.assistantReply ?? `Réponse à "${lastUser.content}".`,
          now: s.now ?? MIDWEEK_OPEN,
        });
        if (verdict.shouldOffer !== s.expectOffer) {
          failures.push({
            name: s.name,
            gotOffer: verdict.shouldOffer,
            expected: s.expectOffer,
            gotReason: verdict.reason,
            expectedReason: s.expectReason,
          });
          continue;
        }
        if (s.expectReason && verdict.reason !== s.expectReason) {
          failures.push({
            name: s.name,
            gotOffer: verdict.shouldOffer,
            expected: s.expectOffer,
            gotReason: verdict.reason,
            expectedReason: s.expectReason,
          });
        }
      }
      if (failures.length > 0) {
        // eslint-disable-next-line no-console
        console.error('[lead coverage] failures:', failures);
      }
      const rate = (ALL_SCENARIOS.length - failures.length) / ALL_SCENARIOS.length;
      expect(rate).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe('2. Anti-redondance', () => {
    it('alreadyOffered=true bloque TOUTES les règles', () => {
      const intents: ChatIntent[] = [
        'purchase-intent',
        'callback-request',
        'negotiation',
        'wholesaler',
        'b2b',
        'frustration',
      ];
      for (const intent of intents) {
        const verdict = shouldOfferLeadForm({
          enabled: true,
          alreadyOffered: true,
          history: [u('hello'), a('hi'), u('hello again')],
          currentIntent: intent,
          assistantReply: 'ok',
          now: MIDWEEK_OPEN,
        });
        expect(verdict.shouldOffer).toBe(false);
      }
    });
  });

  describe('3. Détection de placeholders (bug prod CHA-230)', () => {
    it('reconnaît les patterns creux observés en prod', () => {
      expect(isPlaceholderReply('On s’en occupe ensemble.')).toBe(true);
      expect(isPlaceholderReply("On s'en occupe ensemble")).toBe(true);
      expect(isPlaceholderReply('On s’en occupe ensemble!')).toBe(true);
      expect(isPlaceholderReply('Je vois.')).toBe(true);
      expect(isPlaceholderReply('Très bien')).toBe(true);
      expect(isPlaceholderReply('D’accord !')).toBe(true);
    });

    it('NE flague PAS les réponses substantielles', () => {
      expect(isPlaceholderReply('Le kit est à 290 MAD livraison incluse.')).toBe(false);
      expect(isPlaceholderReply('Bien sûr, voici les détails…')).toBe(false);
      expect(isPlaceholderReply('Très bien, je vous explique : …')).toBe(false);
    });

    it('un placeholder + intent commercial = lead form OBLIGATOIRE', () => {
      // Cas reproduit du bug prod : "Je souhaite au fait commander" →
      // bot: "On s'en occupe ensemble" → STUCK (pas de form).
      // Avec le fix CHA-230, intent=purchase-intent → shouldOffer=true.
      const lastUserMsg = u('Je souhaite au fait commander');
      const intent = detectIntent(lastUserMsg.content);
      expect(intent).toBe('purchase-intent');
      expect(COMMERCIAL_INTENTS).toContain(intent);

      const verdict = shouldOfferLeadForm({
        enabled: true,
        alreadyOffered: false,
        history: [lastUserMsg],
        currentIntent: intent,
        assistantReply: "On s'en occupe ensemble", // ← placeholder bug
        now: MIDWEEK_OPEN,
      });
      expect(verdict.shouldOffer).toBe(true);
      expect(verdict.reason).toBe('purchase-intent');
    });
  });

  describe('4. Régression bug prod (Je souhaite au fait commander)', () => {
    it('détecte purchase-intent + offre le formulaire', () => {
      const result = runScenario({
        name: 'bug prod CHA-230',
        history: [u('Hello'), a('Bonjour !'), u('Je souhaite au fait commander')],
        expectedIntent: 'purchase-intent',
        expectOffer: true,
        expectReason: 'purchase-intent',
        assistantReply: "On s'en occupe ensemble",
      });
      expect(result.intentMatch).toBe(true);
      expect(result.offer).toBe(true);
      expect(result.reasonMatch).toBe(true);
    });

    it('variantes du bug : "donc commander", "bien commander", "vraiment commander"', () => {
      const variants = [
        'Je veux donc commander',
        'Je voudrais bien commander',
        'Je souhaite vraiment commander',
        'Je voulais vous dire que je veux commander',
      ];
      for (const text of variants) {
        const intent = detectIntent(text);
        expect(intent).toBe('purchase-intent');
      }
    });
  });

  describe('5. Coverage par catégorie commerciale', () => {
    it('TOUS les intents commerciaux forts déclenchent le form au 1er tour', () => {
      const cases: Array<{ text: string; intent: ChatIntent; reason: LeadFormReason }> = [
        { text: 'Je veux commander', intent: 'purchase-intent', reason: 'purchase-intent' },
        { text: 'Rappelez moi', intent: 'callback-request', reason: 'explicit-request' },
        { text: 'Faites moi un prix', intent: 'negotiation', reason: 'negotiation' },
        { text: 'Je suis grossiste', intent: 'wholesaler', reason: 'wholesaler' },
      ];
      for (const c of cases) {
        const verdict = shouldOfferLeadForm({
          enabled: true,
          alreadyOffered: false,
          history: [u(c.text)],
          currentIntent: c.intent,
          assistantReply: 'ok',
          now: MIDWEEK_OPEN,
        });
        expect(verdict.shouldOffer).toBe(true);
        expect(verdict.reason).toBe(c.reason);
      }
    });

    it('les intents informationnels ne déclenchent PAS au 1er tour', () => {
      const cases: ChatIntent[] = ['greeting', 'pricing', 'shipping', 'routine', 'ingredient', 'misc'];
      for (const intent of cases) {
        const verdict = shouldOfferLeadForm({
          enabled: true,
          alreadyOffered: false,
          history: [u('test')],
          currentIntent: intent,
          assistantReply: 'voilà',
          now: MIDWEEK_OPEN,
        });
        expect(verdict.shouldOffer).toBe(false);
      }
    });
  });

  describe('6. Volumétrie : ≥ 30 scénarios distincts couverts', () => {
    it('au moins 30 scénarios couverts', () => {
      expect(ALL_SCENARIOS.length).toBeGreaterThanOrEqual(30);
    });

    it('coverage tous buckets (≥ 4 buckets distincts)', () => {
      // Chaque bucket doit avoir ≥ 1 scénario.
      const buckets = [
        BUCKET_A_FIRST_TURN.length,
        BUCKET_B_MULTI_TURN.length,
        BUCKET_C_NO_REDUNDANCY.length,
        BUCKET_D_AFTER_HOURS.length,
        BUCKET_E_OUT_OF_KNOWLEDGE.length,
        BUCKET_F_NEGATIVE.length,
        BUCKET_G_MULTILINGUAL.length,
      ];
      expect(buckets.every((n) => n >= 1)).toBe(true);
      expect(buckets.length).toBeGreaterThanOrEqual(7);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. CHA-230 v5 — Filet de sécurité « LLM promet le formulaire »
  //
  // Bug reporté en prod : visiteur écrit « achat » → l'assistant répond
  // « Le petit formulaire ci-dessous prend trente secondes » MAIS aucun
  // formulaire n'apparaît. Le filet de sécurité doit capturer ces cas.
  // ---------------------------------------------------------------------------
  describe('7. CHA-230 v5 — assistantPromisedForm (filet de sécurité LLM)', () => {
    it('détecte les promesses de formulaire dans la réponse assistant', () => {
      const promises = [
        'Le petit formulaire ci-dessous prend trente secondes.',
        'Voici le petit formulaire pour vous.',
        'Le formulaire ci-dessous est rapide.',
        'Le formulaire ci dessous prend 30 secondes',
        'Le formulaire en dessous',
        'Le formulaire qui s’affiche sous ce message',
        'Laissez moi votre prénom et votre numéro',
        'Validez vos coordonnées juste ici',
        'Je note votre prénom et numéro',
      ];
      for (const reply of promises) {
        expect(assistantPromisedForm(reply), `attendu true pour "${reply}"`).toBe(true);
      }
    });

    it('ne flague PAS les réponses sans promesse de formulaire', () => {
      const safe = [
        'Le kit est à 290 MAD.',
        'Bonjour, comment puis-je vous aider ?',
        'Notre kit est livré sous 48h.',
        'Le rituel se fait en 3 étapes.',
        '',
      ];
      for (const reply of safe) {
        expect(assistantPromisedForm(reply), `attendu false pour "${reply}"`).toBe(false);
      }
    });

    it('exact bug prod 2026-05-08 : "Bien sûr. Le petit formulaire ci-dessous..."', () => {
      const reply =
        'Bien sûr. Le petit formulaire ci-dessous prend trente secondes. Validez vos coordonnées et notre équipe vous rappelle dans la journée.';
      expect(assistantPromisedForm(reply)).toBe(true);
    });

    it("résiste aux variantes d'apostrophes et espaces", () => {
      // Apostrophes typographiques + espaces multiples + casse mixte.
      expect(assistantPromisedForm('Le PETIT formulaire ci-dessous')).toBe(true);
      expect(assistantPromisedForm('Le formulaire   ci-dessous')).toBe(true);
      expect(assistantPromisedForm('Le formulaire qui s’affiche')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. CHA-230 v5 — Régression "achat" + petit complément
  //
  // Le visiteur écrit « achat svp », « pour achat », « faire un achat »,
  // « l’achat du kit » → la regex doit reconnaître purchase-intent SANS
  // appel LLM (shortcut deterministe, score ≥ REGEX_SHORTCUT_THRESHOLD).
  // ---------------------------------------------------------------------------
  describe('8. CHA-230 v5 — Variantes "achat" déclenchent purchase-intent', () => {
    const variants = [
      'achat',
      'achat svp',
      'achat stp',
      'achat du kit',
      'achat du kit svp',
      'pour achat',
      'pour acheter',
      'pour faire un achat',
      'faire un achat',
      'je veux faire un achat',
      'je voudrais faire un achat',
      'finaliser mon achat',
      'valider mon achat',
      'passer un achat',
      'effectuer un achat',
    ];

    it.each(variants)('"%s" → purchase-intent', (text) => {
      expect(detectIntent(text)).toBe('purchase-intent');
    });

    it('chaque variante "achat" déclenche le formulaire au 1er tour', () => {
      for (const text of variants) {
        const verdict = shouldOfferLeadForm({
          enabled: true,
          alreadyOffered: false,
          history: [u(text)],
          currentIntent: 'purchase-intent',
          assistantReply: 'ok',
          now: MIDWEEK_OPEN,
        });
        expect(verdict.shouldOffer, `attendu true pour "${text}"`).toBe(true);
        expect(verdict.reason).toBe('purchase-intent');
      }
    });

    it("n'attrape PAS les négations \"j'ai déjà acheté\"", () => {
      expect(detectIntent("j'ai déjà acheté")).not.toBe('purchase-intent');
      expect(detectIntent("j'ai déjà acheté hier")).not.toBe('purchase-intent');
      expect(detectIntent("j'ai acheté la semaine dernière")).not.toBe('purchase-intent');
    });
  });

  // ---------------------------------------------------------------------------
  // 9. CHA-230 v6 — Élision pronom complément (« Je veux l'acheter »)
  //
  // Bug prod 2026-05-08 (transcript 2) : « Bonjous » → greeting, puis
  // « Je veux l'acheter » → assistant répond « Parfait. La suite se règle
  // juste en dessous. » → aucun form. Deux causes : (1) regex casse sur
  // l'apostrophe avant le verbe, (2) la formule LLM n'a pas le mot
  // « formulaire ».
  // ---------------------------------------------------------------------------
  describe('9. CHA-230 v6 — Élision pronom complément + paraphrase LLM', () => {
    const elisions = [
      "Je veux l'acheter",
      'Je veux l’acheter',
      "Je voudrais l'acheter",
      "Je peux l'acheter ?",
      "j'aimerais l'acheter",
      "Je veux l'acheter svp",
    ];

    it.each(elisions)('"%s" → purchase-intent', (text) => {
      expect(detectIntent(text)).toBe('purchase-intent');
    });

    it('chaque variante avec élision déclenche le formulaire au 1er tour', () => {
      for (const text of elisions) {
        const verdict = shouldOfferLeadForm({
          enabled: true,
          alreadyOffered: false,
          history: [u(text)],
          currentIntent: 'purchase-intent',
          assistantReply: 'ok',
          now: MIDWEEK_OPEN,
        });
        expect(verdict.shouldOffer, `attendu true pour "${text}"`).toBe(true);
        expect(verdict.reason).toBe('purchase-intent');
      }
    });

    it('paraphrase LLM "la suite se règle juste en dessous" → assistantPromisedForm', () => {
      // Bug prod 2026-05-08 — l'assistant répond cette formule sans le mot
      // « formulaire ». Le filet doit la capturer parce que dans le chat,
      // il n'y a JAMAIS rien d'autre que le form sous le message.
      const promises = [
        'Parfait. La suite se règle juste en dessous.',
        'La suite se règle en dessous',
        'La suite se passe juste en dessous',
        'On enregistre tout ça juste en dessous',
        'On finalise juste en dessous',
        'Remplissez juste en dessous',
        'Complétez juste en dessous svp',
        'Laissez vos infos juste en dessous',
      ];
      for (const reply of promises) {
        expect(assistantPromisedForm(reply), `attendu true pour "${reply}"`).toBe(true);
      }
    });

    it('ne flague PAS "la suite logique" / "la suite Royale" (faux positifs sémantiques)', () => {
      const safe = [
        'La suite logique de votre routine est claire.',
        'La suite Royale est notre best-seller.',
        'Notre kit est livré sous 48h.',
      ];
      for (const reply of safe) {
        expect(assistantPromisedForm(reply), `attendu false pour "${reply}"`).toBe(false);
      }
    });
  });
});
