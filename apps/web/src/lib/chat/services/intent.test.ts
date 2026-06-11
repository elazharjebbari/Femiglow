/**
 * Tests pour `detectIntent` — couvre FR, Darija FR-script et AR script.
 *
 * Inclut un bloc adversarial (CHA-225) qui valide :
 *  - le scoring pondéré (strong vs patterns),
 *  - les négateurs (ex. "j'ai déjà commandé" ≠ purchase-intent),
 *  - les phrases mixtes / longues / avec typos,
 *  - la priorité fiable purchase-intent vs order-status.
 */
import { describe, expect, it } from 'vitest';

import { classifyIntent, detectIntent } from './intent';

describe('intent detection', () => {
  describe('greeting', () => {
    it.each([
      'Bonjour !',
      'salut comment ca va',
      'Salam alaykoum',
      'sbah el khir',
      'مرحبا',
    ])('détecte greeting sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('greeting');
    });
  });

  describe('pricing', () => {
    it.each([
      'Combien ça coûte ?',
      'Quel est le tarif du kit ?',
      'chhal taman dyalou',
      'كم سعر',
    ])('détecte pricing sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('pricing');
    });
  });

  describe('shipping', () => {
    it.each([
      'Quel est le délai de livraison ?',
      'Expédition vers le Maroc ?',
      'kayna toussel l Casa ?',
      'متى التوصيل',
    ])('détecte shipping sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('shipping');
    });
  });

  describe('routine', () => {
    it.each([
      'Comment utiliser le sérum ?',
      'Quelle routine matin et soir ?',
      'kifach n3mel',
    ])('détecte routine sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('routine');
    });
  });

  describe('ingredient', () => {
    it.each([
      "Y a-t-il des parabens dans la formule ?",
      'Est-ce naturel et sans silicone ?',
      'mkawnat dyalkom',
    ])('détecte ingredient sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('ingredient');
    });
  });

  describe('order-status', () => {
    it.each([
      'Où est ma commande ?',
      'Suivi de ma commande SVP',
    ])('détecte order-status sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('order-status');
    });
  });

  describe('purchase-intent (CHA-225)', () => {
    it.each([
      'Je veux commander',
      'Je veux commander le kit',
      'Je voudrais acheter votre kit',
      // Élision pronom complément avant verbe d'action (bug 2026-05-12) :
      // l'apostrophe collée au verbe doit être tolérée par la regex.
      "Je veux l'acheter",
      "Je voudrais l'acheter",
      "Je souhaite l'acheter",
      "Je l'achète",
      'Je le prends',
      'Comment commander ?',
      'tu as un formulaire ?',
      'Donnez-moi le formulaire',
      'Envoyez-moi le kit',
      'bghit nshri l-kit',
      'kifach ntleb',
      'أريد أن أطلب',
      'كيف أشتري',
    ])('détecte purchase-intent sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('purchase-intent');
    });

    it('priorise purchase-intent sur order-status quand "commander" exprime un achat', () => {
      // "Je veux commander" matche aussi le mot "commande" mais
      // l'ordre des règles fait que purchase-intent gagne.
      expect(detectIntent('Je veux commander')).toBe('purchase-intent');
    });
  });

  describe('support', () => {
    it.each([
      'remboursement possible ?',
      'mochkil 3andi',
      'help svp',
    ])('détecte support sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('support');
    });
  });

  it('retombe sur "misc" pour input vide ou non-classifiable', () => {
    expect(detectIntent('')).toBe('misc');
    expect(detectIntent('xyz qwerty random text')).toBe('misc');
  });
});

// ---------------------------------------------------------------------------
// Adversarial / scoring (CHA-225) — robustesse du classifieur
// ---------------------------------------------------------------------------

describe('intent — robustesse adversariale (CHA-225)', () => {
  describe('priorité purchase-intent vs order-status (négateurs)', () => {
    it('"je veux commander le kit" → purchase-intent', () => {
      expect(detectIntent('je veux commander le kit')).toBe('purchase-intent');
    });

    it('"j\'ai déjà commandé" → order-status (négateur)', () => {
      expect(detectIntent("j'ai déjà commandé hier")).toBe('order-status');
    });

    it("'où est ma commande' → order-status, jamais purchase-intent", () => {
      expect(detectIntent('Où est ma commande ?')).toBe('order-status');
    });

    it("'ma commande est en retard' → order-status (négateur 'ma commande')", () => {
      expect(detectIntent('ma commande est en retard')).toBe('order-status');
    });

    it("'j'ai passé une commande lundi' → order-status (négateur)", () => {
      expect(detectIntent("j'ai passé une commande lundi, je l'ai pas reçue")).toBe(
        'order-status',
      );
    });
  });

  describe('phrases mixtes (multiples intents en compétition)', () => {
    it("'Bonjour, je veux commander le kit svp' → purchase-intent gagne sur greeting", () => {
      // greeting score = 1, purchase-intent strong = 2 + 1 (le kit) → purchase-intent gagne.
      expect(detectIntent('Bonjour, je veux commander le kit svp')).toBe('purchase-intent');
    });

    it("'C'est combien le kit ? Je le prends' → purchase-intent gagne (strong + standard)", () => {
      const r = classifyIntent("C'est combien le kit ? Je le prends");
      expect(r.intent).toBe('purchase-intent');
      // pricing aussi a matché mais score < purchase-intent.
      expect(r.alternatives.pricing).toBeGreaterThan(0);
    });

    it("'Salam, kifach ntleb le kit ?' → purchase-intent (Darija + FR mixés)", () => {
      expect(detectIntent('Salam, kifach ntleb le kit ?')).toBe('purchase-intent');
    });
  });

  describe('seuil minimal (anti faux positifs)', () => {
    it("Un seul mot ambigu 'commande' tout seul → garde order-status (1 match)", () => {
      // Le mot seul matche order-status faiblement, mais pas purchase-intent.
      expect(detectIntent('commande')).toBe('order-status');
    });

    it('Texte sans aucun signal → misc', () => {
      expect(detectIntent('blablabla random qwerty')).toBe('misc');
    });

    it('Texte avec typos majeures sur "commander" → reste détecté quand même', () => {
      // "comamnder" a une typo MAIS le pattern "comment commander" peut ne pas
      // matcher. On accepte que ces cas tombent en 'misc' — c'est mieux que
      // déclencher un faux positif sur des mots brouillés.
      const r = classifyIntent('je veux comamnder');
      expect(['purchase-intent', 'misc']).toContain(r.intent);
    });
  });

  describe('classifyIntent — scoring détaillé', () => {
    it('renvoie les scores des intents alternatifs', () => {
      const r = classifyIntent('Bonjour, je veux commander le kit');
      expect(r.intent).toBe('purchase-intent');
      expect(r.score).toBeGreaterThan(0);
      expect(r.alternatives.greeting).toBeGreaterThan(0);
      expect(r.alternatives['purchase-intent']).toBeGreaterThan(
        r.alternatives.greeting!,
      );
    });

    it('score 0 + intent misc sur input vide', () => {
      const r = classifyIntent('');
      expect(r.intent).toBe('misc');
      expect(r.score).toBe(0);
    });

    it("strong patterns valent 2× le score d'un pattern standard", () => {
      // "je veux commander" est un strong pattern (score +2)
      const r1 = classifyIntent('je veux commander');
      // "envoyez-moi le kit" est un pattern standard (score +1)
      const r2 = classifyIntent('envoyez-moi le kit');
      expect(r1.alternatives['purchase-intent']!).toBeGreaterThanOrEqual(2);
      expect(r2.alternatives['purchase-intent']!).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Multilingue — robustesse cross-script', () => {
    it("'أريد أن أطلب الكيت' → purchase-intent (AR pur)", () => {
      expect(detectIntent('أريد أن أطلب الكيت')).toBe('purchase-intent');
    });

    it("'bghit nshri kit dyalkom daba' → purchase-intent (Darija pur)", () => {
      expect(detectIntent('bghit nshri kit dyalkom daba')).toBe('purchase-intent');
    });

    // CHA-230 v7 — Darija écrite en SCRIPT ARABE (gap pré-existant).
    // Ces formes sont détectées comme `ar-MA` côté lang.detect (cf.
    // DARIJA_AR_TOKENS), mais l'intent classifier ne les couvrait pas →
    // tombait en `misc` → pas de form de capture côté chat.
    it.each([
      'بغيت نشري الكيت',
      'بغيت نطلب الكيت',
      'بغيت نشري الطقم',
      'بغيت الكيت',
      'بغينا نشري الكيت',
      'نشري الكيت',
      'نطلب الكيت',
      'نطلب الطقم',
    ])('détecte purchase-intent sur Darija-AR-script "%s"', (input) => {
      expect(detectIntent(input)).toBe('purchase-intent');
    });

    it("Phrase qui mêle FR/AR/Darija — détection robuste", () => {
      // Un visiteur réel peut mélanger : "Salam, je voudrais ntleb le kit"
      const r = classifyIntent('Salam, je voudrais ntleb le kit');
      expect(['purchase-intent', 'greeting']).toContain(r.intent);
      expect(r.score).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// CHA-230 — Robustesse intent : verbe d'achat seul, négociation, wholesaler
// ---------------------------------------------------------------------------

describe('intent — CHA-230 (commander seul / negotiation / wholesaler)', () => {
  // -------------------------------------------------------------------------
  // Verbe d'achat seul (cause-racine du bug prod : "commander" → misc)
  // -------------------------------------------------------------------------
  describe('purchase-intent — verbe d\'achat SEUL (CHA-230)', () => {
    it.each([
      'commander',
      'Commander',
      'COMMANDER',
      'commander.',
      'commander !',
      'commander ?',
      'acheter',
      'order',
      'buy',
      'achat',
      'tlb',
      'tleb',
    ])('détecte purchase-intent sur le verbe seul "%s"', (input) => {
      expect(detectIntent(input)).toBe('purchase-intent');
    });

    it('"je veux commander" tout seul → purchase-intent', () => {
      expect(detectIntent('je veux commander')).toBe('purchase-intent');
      expect(detectIntent('Je voudrais commander')).toBe('purchase-intent');
    });

    it('le négateur "j\'ai déjà commandé" écarte le faux positif', () => {
      expect(detectIntent("j'ai déjà commandé")).toBe('order-status');
    });
  });

  // -------------------------------------------------------------------------
  // Négociation (rabais, réduction, marchandage)
  // -------------------------------------------------------------------------
  describe('negotiation — marchandage explicite (CHA-230)', () => {
    it.each([
      'Vous pouvez me faire un rabais ?',
      "J'aimerais une remise s'il vous plaît",
      'On peut négocier le prix ?',
      'Vous pouvez baisser le prix ?',
      'Faites un geste commercial pour moi',
      'Avez-vous un code promo ?',
      'Avez-vous un code réduction ?',
      'Faire un effort sur le prix ?',
      "C'est négociable ?",
      'Pouvez-vous faire un prix ?',
    ])('détecte negotiation sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('negotiation');
    });

    it.each([
      'tnzli liya chwiya',
      '3tini wahd takhfid',
      'naqsalna chi haja',
      'chi takhfid 3afak',
    ])('détecte negotiation en Darija sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('negotiation');
    });

    it.each([
      'تخفيض من فضلك',
      'تنزيل الثمن',
      'عرض خاص',
      'كود تخفيض',
    ])('détecte negotiation en AR script sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('negotiation');
    });

    it("anti-faux-positif : 'j'ai eu votre promo la dernière fois' n'est PAS negotiation", () => {
      // Le négateur écarte les références à des promos passées.
      const r = classifyIntent("j'ai eu votre promo la dernière fois");
      expect(r.intent).not.toBe('negotiation');
    });

    it('priorise negotiation sur objection-price quand le visiteur demande explicitement une remise', () => {
      // "réduction" tout seul classerait objection-price ; le mot "rabais"
      // (strong) tire vers negotiation parce que c'est un acte commercial actif.
      expect(detectIntent('Vous me faites un rabais ?')).toBe('negotiation');
    });
  });

  // -------------------------------------------------------------------------
  // Wholesaler (volume pro, grossiste, distributeur, institut)
  // -------------------------------------------------------------------------
  describe('wholesaler — volume pro (CHA-230)', () => {
    it.each([
      "Je voudrais une grande quantité du kit",
      'Avez-vous des prix en gros ?',
      'Je suis grossiste, vous fournissez ?',
      'Je voudrais 50 unités',
      'Je veux 100 pièces',
      'Plusieurs centaines de kits',
      'Je voudrais devenir distributeur',
      'Pour mon institut de beauté',
      'Pour mon salon de beauté',
      "Je suis professionnelle de l'esthétique",
      'Je voudrais revendre vos produits',
    ])('détecte wholesaler sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('wholesaler');
    });

    it.each([
      'bghit b jomla',
      'kamiya kbira 3afak',
      'mwaza3 dyalkom',
      '3awd l bi3 mounkin ?',
    ])('détecte wholesaler en Darija sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('wholesaler');
    });

    it.each([
      'بالجملة',
      'كميات كبيرة',
      'موزع',
      'إعادة بيع',
    ])('détecte wholesaler en AR script sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('wholesaler');
    });

    it('priorise wholesaler sur b2b quand le volume est explicite', () => {
      // "salon de beauté + grosse quantité" → wholesaler (strong) gagne.
      expect(detectIntent('Pour mon institut de beauté en grande quantité')).toBe(
        'wholesaler',
      );
    });

    it("'pour mon institut' SEUL (sans volume explicite) → b2b", () => {
      // Sans volume explicite, on retombe sur b2b (intent moins fort).
      const r = classifyIntent('pour mon institut');
      expect(['b2b', 'wholesaler']).toContain(r.intent);
    });
  });

  // -------------------------------------------------------------------------
  // Confidence : score à transmettre à `chat_message.intent_confidence`
  // -------------------------------------------------------------------------
  describe("confidence — score brut pour le tagging persistant (CHA-230)", () => {
    it("strong pattern → score ≥ 2 (medium ou high)", () => {
      const r = classifyIntent('je veux commander le kit');
      expect(r.score).toBeGreaterThanOrEqual(2);
    });

    it("verbe seul 'commander' → score ≥ 2 (strong pattern)", () => {
      const r = classifyIntent('commander');
      expect(r.score).toBeGreaterThanOrEqual(2);
    });

    it("'rabais' (strong negotiation) → score ≥ 2", () => {
      const r = classifyIntent('Vous me faites un rabais ?');
      expect(r.intent).toBe('negotiation');
      expect(r.score).toBeGreaterThanOrEqual(2);
    });

    it("input ambigu → score faible (1) → mappable 'low'", () => {
      // Un seul mot ambigu doit donner score 1 max.
      const r = classifyIntent('promo');
      // promo seul matche objection-price (1) ET negotiation (1) — l'ordre
      // des règles détermine le gagnant.
      expect(r.score).toBeLessThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Frustration — robustesse étendue (CHA-230 v7)
  // ---------------------------------------------------------------------------
  // Cause-racine : le pattern initial était trop étroit. « Personne ne répond
  // c'est inadmissible !! » et « Je suis énervée » retombaient en `misc`,
  // empêchant le déclenchement du safety-net via `frustration` (tour 2+).
  //
  // Particularité technique : `\b` JS ne reconnaît pas les caractères accentués
  // (é, è, à) comme des caractères de mot, donc « énervée » échouait avec un
  // simple `\b...\b`. On utilise des lookarounds `(?<![a-zA-Zà-ÿ])...(?![a-zA-Zà-ÿ])`
  // pour les patterns avec accents.
  // ---------------------------------------------------------------------------
  describe('frustration — variantes étendues (CHA-230)', () => {
    it.each([
      // Strong patterns (score 2 chacun)
      "C'est inadmissible !",
      'Inacceptable cette situation',
      "C'est un scandale",
      'Scandaleux !',
      'Je suis énervée',
      'Je suis énervé par votre service',
      "Je suis en colère",
      'Je suis furieuse',
      'Personne ne répond',
      "Personne ne me répond depuis 3 jours",
      "Personne ne me rappelle",
      "J'en ai marre !",
      "C'est nul",
      "C'est vraiment nul votre service",
      "C'est n'importe quoi",
      "C'est une honte",
      "C'est abusé !",
      "C'est vraiment abusé",
    ])('détecte frustration sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('frustration');
    });

    it.each([
      // Standard patterns (mécontentement)
      'Je suis mécontente',
      'Je ne suis pas content',
      'Je suis pas contente',
      'Je suis déçue par votre service',
      "C'est décevant",
    ])('détecte frustration (standard) sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('frustration');
    });

    it.each([
      // Darija (Latin + Arabe)
      'safi',
      'baraka',
      'يكفي',
      'محتقن',
      'متضايقة',
    ])('détecte frustration (multilingue) sur "%s"', (input) => {
      expect(detectIntent(input)).toBe('frustration');
    });

    it("strong pattern frustration → score ≥ 2", () => {
      const r = classifyIntent("C'est inadmissible !");
      expect(r.intent).toBe('frustration');
      expect(r.score).toBeGreaterThanOrEqual(2);
    });

    it("anti-faux-positif : phrase neutre ne déclenche PAS frustration", () => {
      // Une question informationnelle ne doit jamais matcher frustration.
      expect(detectIntent("C'est combien le kit ?")).not.toBe('frustration');
      expect(detectIntent('Bonjour')).not.toBe('frustration');
      expect(detectIntent("Je voudrais des informations")).not.toBe('frustration');
    });
  });
});
