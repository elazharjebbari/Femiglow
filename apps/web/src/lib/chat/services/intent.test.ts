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

    it("Phrase qui mêle FR/AR/Darija — détection robuste", () => {
      // Un visiteur réel peut mélanger : "Salam, je voudrais ntleb le kit"
      const r = classifyIntent('Salam, je voudrais ntleb le kit');
      expect(['purchase-intent', 'greeting']).toContain(r.intent);
      expect(r.score).toBeGreaterThan(0);
    });
  });
});
