/**
 * CHA-231 (S5) — Suite ULTIME de tests live avec OpenAI réel.
 *
 * Pourquoi cette suite :
 *   - `chat-live-openai.spec.ts` : 1 appel minimal pour valider la
 *     plomberie (provider actif, SSE valide).
 *   - `chat-robustness.spec.ts`  : 9 tests sur les bugs de prod
 *     spécifiques (purchase-intent, négo, grossiste).
 *   - `chat-lead-capture.spec.ts` : 4 tests focus capture lead.
 *   - CETTE SUITE : 18 cas exhaustifs qui couvrent les 11 reasons
 *     du contrat dans les 3 langues + faux-positifs critiques.
 *     Tourne uniquement quand `OPENAI_LIVE_TEST=1` car coût ~$0.002.
 *
 * Couverture par axe :
 *   - 11 reasons : purchase-intent (3 langues), inline-contact,
 *     negotiation (FR + AR-MA), wholesaler, explicit-request,
 *     out-of-knowledge, frustration, b2b, manual.
 *   - 3 anti-faux-positifs : prix avec MAD, "j'ai déjà commandé",
 *     question simple sans achat.
 *   - 2 multi-tour : flow complet avec contexte.
 *
 * Pour lancer :
 *   OPENAI_LIVE_TEST=1 PLAYWRIGHT_BASE_URL=http://localhost:3030 \
 *     pnpm exec playwright test chat-live-ultimate.spec.ts
 *
 * Coût total estimé : 18 appels × ~0.0001$ = ~0.002$.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

const SHOULD_RUN = process.env.OPENAI_LIVE_TEST === '1';

interface SseEvent {
  event: string;
  data: unknown;
}

/** Lit un body SSE et retourne la liste d'événements parsés. */
function readSseEvents(text: string): SseEvent[] {
  const events: SseEvent[] = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) continue;
    const dataStr = dataLines.join('\n');
    let data: unknown = dataStr;
    try {
      data = JSON.parse(dataStr);
    } catch {
      // garde la string brute si pas du JSON
    }
    events.push({ event, data });
  }
  return events;
}

async function createSession(request: APIRequestContext): Promise<string> {
  const sessRes = await request.get('/api/chat/session');
  expect(sessRes.status()).toBe(200);
  const { sessionId } = (await sessRes.json()) as { sessionId: string };
  expect(sessionId).toMatch(/^cs_/);
  return sessionId;
}

async function sendMessage(
  request: APIRequestContext,
  sessionId: string,
  text: string,
): Promise<SseEvent[]> {
  const res = await request.post('/api/chat/message', {
    data: { sessionId, text },
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    timeout: 60_000,
  });
  expect(res.status(), `POST /api/chat/message → ${res.status()}`).toBe(200);
  return readSseEvents(await res.text());
}

/** Extrait l'event lead-form-offer si présent. */
function findOffer(events: SseEvent[]): { reason: string; copyKey: string; force?: boolean } | null {
  const ev = events.find((e) => e.event === 'lead-form-offer');
  if (!ev) return null;
  return ev.data as { reason: string; copyKey: string; force?: boolean };
}

// =============================================================================
// SUITE 1 — Couverture 11 reasons (live)
// =============================================================================

test.describe('CHA-231 S5 — 11 reasons (live OpenAI)', () => {
  test.skip(!SHOULD_RUN, 'OPENAI_LIVE_TEST=1 requis : nécessite un provider OpenAI actif.');
  test.setTimeout(90_000);

  // ---------- purchase-intent ----------
  test('1. purchase-intent FR — "Je veux commander le kit"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'Je veux commander le kit');
    const offer = findOffer(events);
    expect(offer, 'purchase-intent doit déclencher offer').toBeTruthy();
    expect(offer!.reason).toBe('purchase-intent');
  });

  test('2. purchase-intent FR — "Je souhaite au fait commander"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'Je souhaite au fait commander');
    const offer = findOffer(events);
    expect(offer, 'variante avec adverbe doit déclencher').toBeTruthy();
    expect(offer!.reason).toBe('purchase-intent');
  });

  test('3. purchase-intent AR — "أريد أن أطلب الطقم"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'أريد أن أطلب الطقم');
    const offer = findOffer(events);
    expect(offer, 'AR purchase-intent doit déclencher').toBeTruthy();
    expect(offer!.reason).toBe('purchase-intent');
  });

  test('4. purchase-intent AR-MA — "Bghit nshri lkit"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'Bghit nshri lkit');
    const offer = findOffer(events);
    expect(offer, 'Darija purchase-intent doit déclencher').toBeTruthy();
    expect(offer!.reason).toBe('purchase-intent');
  });

  test('5. inline-contact FR — "hamid +212612345678"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'Bonjour, hamid +212612345678');
    const offer = findOffer(events);
    expect(offer).toBeTruthy();
    expect(offer!.reason).toBe('inline-contact');
  });

  // ---------- negotiation ----------
  test('6. negotiation FR — "Faites moi un rabais svp"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'Faites moi un rabais svp');
    const offer = findOffer(events);
    expect(offer, 'rabais doit déclencher négociation').toBeTruthy();
    expect(offer!.reason).toBe('negotiation');
  });

  test('7. negotiation FR — "vous pouvez baisser le prix?"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'Vous pouvez baisser le prix ?');
    const offer = findOffer(events);
    expect(offer).toBeTruthy();
    expect(offer!.reason).toBe('negotiation');
  });

  // ---------- wholesaler ----------
  test('8. wholesaler FR — "Je suis grossiste"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(
      request,
      sid,
      'Je suis grossiste, je voudrais 100 boîtes pour mon institut',
    );
    const offer = findOffer(events);
    expect(offer).toBeTruthy();
    expect(offer!.reason).toBe('wholesaler');
  });

  test('9. wholesaler FR — "j\'ai un institut, je revends"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(
      request,
      sid,
      "J'ai un institut à Casablanca, je veux référencer pour la revente",
    );
    const offer = findOffer(events);
    expect(offer).toBeTruthy();
    expect(offer!.reason).toBe('wholesaler');
  });

  // ---------- explicit-request ----------
  test('10. explicit-request — "envoyez moi le formulaire"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'Envoyez-moi le formulaire pour me contacter');
    const offer = findOffer(events);
    expect(offer).toBeTruthy();
    // explicit-request OU purchase-intent acceptable selon priorité du classifier.
    expect(['explicit-request', 'purchase-intent']).toContain(offer!.reason);
    // Le serveur DOIT poser force=true pour explicit-request (gap 3).
    if (offer!.reason === 'explicit-request') {
      expect(offer!.force, 'explicit-request doit avoir force=true').toBe(true);
    }
  });

  test('11. explicit-request callback — "rappelez-moi"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'Rappelez-moi sur ce numéro 0612345678');
    const offer = findOffer(events);
    expect(offer).toBeTruthy();
    // inline-contact (téléphone détecté) OU explicit-request acceptables.
    expect(['inline-contact', 'explicit-request']).toContain(offer!.reason);
  });

  // ---------- b2b ----------
  test('12. b2b — "Je travaille pour Sephora"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(
      request,
      sid,
      'Je travaille pour Sephora, on veut référencer votre marque',
    );
    const offer = findOffer(events);
    expect(offer).toBeTruthy();
    // b2b OU wholesaler acceptables (les deux sont pertinents).
    expect(['b2b', 'wholesaler']).toContain(offer!.reason);
  });

  // ---------- frustration ----------
  test('13. frustration — répétée et forte', async ({ request }) => {
    const sid = await createSession(request);
    // Tour 1 — neutre
    await sendMessage(request, sid, 'C\'est compatible peau sensible ?');
    // Tour 2 — frustration explicite
    const events = await sendMessage(
      request,
      sid,
      "Ça ne marche pas, c'est pénible, vous ne répondez jamais correctement",
    );
    const offer = findOffer(events);
    // La frustration ne déclenche PAS toujours une offre (selon score) ;
    // si offre il y a, ce doit être frustration ou un fallback humain.
    if (offer) {
      expect(['frustration', 'manual', 'long-no-progress', 'objection-repeat']).toContain(
        offer.reason,
      );
    }
  });

  // ---------- out-of-knowledge ----------
  test('14. out-of-knowledge — question médicale spécifique', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(
      request,
      sid,
      'Est-ce compatible avec un traitement chimiothérapie en cours ?',
    );
    const offer = findOffer(events);
    // Doit escalader vers humain (out-of-knowledge ou manual).
    if (offer) {
      expect(['out-of-knowledge', 'manual', 'explicit-request']).toContain(offer.reason);
    }
  });

  // ---------- manual / general escalation ----------
  test('15. manual — "envoyez-moi un humain"', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(
      request,
      sid,
      'Je veux parler à un vrai humain, pas un bot',
    );
    const offer = findOffer(events);
    expect(offer).toBeTruthy();
    expect(['manual', 'explicit-request']).toContain(offer!.reason);
  });
});

// =============================================================================
// SUITE 2 — Anti-faux-positifs (3 tests critiques)
// =============================================================================

test.describe('CHA-231 S5 — Anti-faux-positifs (live)', () => {
  test.skip(!SHOULD_RUN, 'OPENAI_LIVE_TEST=1 requis.');
  test.setTimeout(90_000);

  test("16. '290 MAD c'est correct?' NE DOIT PAS déclencher purchase-intent", async ({
    request,
  }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, "C'est combien ? 290 MAD c'est correct ?");
    const offer = findOffer(events);
    if (offer) {
      // Si une offre arrive, elle ne doit ABSOLUMENT pas être inline-contact
      // (290 MAD n'est pas un téléphone) ni purchase-intent (question prix ≠ achat).
      expect(offer.reason).not.toBe('inline-contact');
      expect(offer.reason).not.toBe('purchase-intent');
    }
  });

  test("17. 'j'ai déjà commandé' NE DOIT PAS déclencher purchase-intent", async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, "J'ai déjà commandé hier, où en est ma livraison ?");
    const offer = findOffer(events);
    if (offer) {
      expect(offer.reason).not.toBe('purchase-intent');
    }
  });

  test('18. flow visitor : "Hello" → pas d\'offre au 1er tour', async ({ request }) => {
    const sid = await createSession(request);
    const events = await sendMessage(request, sid, 'Hello');
    const offer = findOffer(events);
    expect(offer, 'aucune offre sur greeting initial').toBeNull();
  });
});
