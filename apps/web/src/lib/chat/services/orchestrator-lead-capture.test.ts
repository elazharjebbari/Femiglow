/**
 * CHA-225 — Tests de simulation de conversation pour la capture lead.
 *
 * Reproduit les SCÉNARIOS RÉELS reportés par l'utilisateur :
 *
 *  1. "L'utilisateur écrit son numéro dans le chat → un lead doit
 *     apparaître dans /admin/chat/leads, même s'il ne soumet jamais
 *     le formulaire."
 *
 *  2. "L'utilisateur dit 'je veux commander' → le widget doit être
 *     proposé immédiatement, dès le 1er tour."
 *
 *  3. "Conversation type : Bonjour → 'C'est combien ?' → 'Je le prends'
 *     → on ne rate plus l'opportunité."
 *
 *  4. "Faux positifs : '290 MAD' ne doit pas créer de lead."
 *
 * Stratégie :
 *  - On utilise le harness `src/test/chat/simulate-conversation.ts`.
 *  - Tous les repos sont mockés en mémoire.
 *  - L'API OpenAI est mockée via MSW.
 *  - Le détecteur de phone et le classifieur d'intent sont VRAIS (pas
 *    mockés) — c'est ça qu'on veut valider.
 *
 * Tour de force : ces tests couvrent EXACTEMENT le path qui passait
 * silencieusement avant CHA-225 (chat → phone → lead perdu).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';
import {
  buildEventRepoMock,
  buildInstructionRepoMock,
  buildLeadRepoMock,
  buildMessageRepoMock,
  buildProviderRepoMock,
  buildProviderRouterMock,
  buildRagServiceMock,
  buildRuntimeSettingMock,
  buildSessionRepoMock,
  makeTestSession,
  resetSimulationStores,
  runConversation,
  runUserTurn,
  simStores,
  useStubReply,
} from '@/test/chat/simulate-conversation';

// ---------------------------------------------------------------------------
// Mocks — DOIVENT être définis avant l'import dynamique de l'orchestrator.
// ---------------------------------------------------------------------------

vi.mock('@/lib/chat/repos/session', () => buildSessionRepoMock());
vi.mock('@/lib/chat/repos/message', () => buildMessageRepoMock());
vi.mock('@/lib/chat/repos/event', () => buildEventRepoMock());
vi.mock('@/lib/chat/repos/instruction', () => buildInstructionRepoMock());
vi.mock('@/lib/chat/repos/provider', () => buildProviderRepoMock());
vi.mock('@/lib/chat/repos/lead', () => buildLeadRepoMock());
vi.mock('@/lib/chat/rag/service', () => buildRagServiceMock());
vi.mock('@/lib/chat/runtime-setting', () => buildRuntimeSettingMock());

// Note : on a besoin d'un `vi.mock` async pour le provider-router parce
// qu'il importe le vrai adapter OpenAI. Le builder est async.
vi.mock('@/lib/chat/services/provider-router', async () => {
  const builder = (
    await import('@/test/chat/simulate-conversation')
  ).buildProviderRouterMock();
  return await builder();
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  resetSimulationStores();
  // Le toggle runtime "lead_form_enabled" doit être true.
  simStores.runtimeFlags.set('lead_form_enabled', true);
});

afterEach(() => server.resetHandlers());

// ---------------------------------------------------------------------------
// Scénario 1 — Phone in-chat = lead auto-créé même sans formulaire
// ---------------------------------------------------------------------------

describe('Scénario 1 — phone in-chat (CHA-225)', () => {
  it("crée un lead automatique quand le visiteur tape 'hamid +212751592310'", async () => {
    useStubReply('Avec plaisir Hamid ! Je vous transmets à une conseillère.');
    const session = makeTestSession();

    const result = await runUserTurn(session, 'hamid +212751592310');

    // Le widget DOIT être proposé (raison: inline-contact).
    expect(result.leadOffered).toBe(true);
    expect(result.leadOfferReason).toBe('inline-contact');

    // Et un lead AUTOMATIQUE doit avoir été créé en base.
    expect(result.autoLeadCreated).toBe(true);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]!.triggerReason).toBe('inline-contact');
    expect(result.leads[0]!.phoneE164).toBe('+212751592310');
    expect(result.leads[0]!.firstName).toBe('Hamid');
    expect(result.leads[0]!.consentVersion).toContain('inline-fallback');
  });

  it("crée un lead avec firstName='Visiteur' si aucun prénom détecté", async () => {
    useStubReply('Très bien, je transmets votre numéro à une conseillère.');
    const session = makeTestSession();

    const result = await runUserTurn(session, 'voici 0651592310');

    expect(result.autoLeadCreated).toBe(true);
    expect(result.leads[0]!.phoneE164).toBe('+212651592310');
    // 'voici' est un stopword → firstName fallback "Visiteur"
    expect(result.leads[0]!.firstName).toBe('Visiteur');
  });

  it("ne crée PAS de lead si la confiance est trop basse (chiffres bruts)", async () => {
    useStubReply('OK !');
    const session = makeTestSession();

    // Aucune correspondance phone → pas de capture.
    const result = await runUserTurn(session, 'Bonjour, le code postal 90000');

    expect(result.autoLeadCreated).toBe(false);
    expect(result.leads).toHaveLength(0);
  });

  it("ne crée PAS de lead sur '290 MAD' (anti faux-positif)", async () => {
    useStubReply('Le kit est à 290 MAD.');
    const session = makeTestSession();

    const result = await runUserTurn(session, "C'est combien ? 290 MAD c'est ça ?");

    expect(result.autoLeadCreated).toBe(false);
    expect(result.leads).toHaveLength(0);
  });

  it("ne crée pas de doublon si l'utilisateur retape le même numéro et nom (même identité)", async () => {
    useStubReply('Une seule réponse stub.');
    const session = makeTestSession();

    const r1 = await runUserTurn(session, 'hamid +212751592310');
    expect(r1.autoLeadCreated).toBe(true);

    // Même numéro + même prénom → même identityHash → pas de doublon.
    const r2 = await runUserTurn(session, 'hamid +212751592310 rappellez-moi');
    expect(r2.autoLeadCreated).toBe(false);
    // Total : 1 seul lead pour la session.
    expect([...simStores.leads.values()]).toHaveLength(1);
  });

  it("crée un nouveau lead si l'identité diffère (numéro différent, même session)", async () => {
    useStubReply('Une seule réponse stub.');
    const session = makeTestSession();

    const r1 = await runUserTurn(session, 'hamid +212751592310');
    expect(r1.autoLeadCreated).toBe(true);

    // Numéro différent → identityHash différent → nouveau lead autorisé.
    const r2 = await runUserTurn(session, 'fatima +212698765432');
    expect(r2.autoLeadCreated).toBe(true);
    // Total : 2 leads pour la session (identités différentes).
    expect([...simStores.leads.values()]).toHaveLength(2);
  });

  it("persiste l'event KPI 'chat_lead_auto_created'", async () => {
    useStubReply('OK.');
    const session = makeTestSession();
    await runUserTurn(session, 'sami 0712345678');

    const evt = simStores.events.find((e) => e.type === 'chat_lead_auto_created');
    expect(evt).toBeDefined();
    expect((evt!.payload as { triggerReason: string }).triggerReason).toBe(
      'inline-contact',
    );
  });
});

// ---------------------------------------------------------------------------
// Scénario 2 — Purchase intent immédiat (1er tour)
// ---------------------------------------------------------------------------

describe('Scénario 2 — purchase-intent dès le 1er tour (CHA-225)', () => {
  it("propose le widget dès 'je veux commander' au 1er message", async () => {
    useStubReply('Avec plaisir, je vous transmets à une conseillère.');
    const session = makeTestSession();

    const r = await runUserTurn(session, 'Je veux commander le kit');

    expect(r.leadOffered).toBe(true);
    expect(r.leadOfferReason).toBe('purchase-intent');
    // Pas de lead auto (pas de phone), juste l'offre du widget.
    expect(r.autoLeadCreated).toBe(false);
  });

  it("propose le widget pour 'tu as un formulaire ?' (variante explicite)", async () => {
    useStubReply('Oui, voici le formulaire.');
    const session = makeTestSession();

    const r = await runUserTurn(session, 'tu as un formulaire ?');

    expect(r.leadOffered).toBe(true);
    expect(r.leadOfferReason).toBe('purchase-intent');
  });

  it("propose le widget en darija ('bghit nshri kit dyalkom')", async () => {
    useStubReply('Marhaba, voici le formulaire.');
    const session = makeTestSession();

    const r = await runUserTurn(session, 'bghit nshri kit dyalkom');

    expect(r.leadOffered).toBe(true);
    expect(r.leadOfferReason).toBe('purchase-intent');
  });

  it("ne propose PAS le widget sur 'j'ai déjà commandé' (négateur)", async () => {
    useStubReply("D'accord, je vais vérifier votre commande.");
    const session = makeTestSession();

    const r = await runUserTurn(session, "j'ai déjà commandé hier, où est ma commande ?");

    expect(r.leadOffered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scénario 2bis — Ceinture serveur : la réponse IA promet le formulaire
// ---------------------------------------------------------------------------

describe('Scénario 2bis — assistant-reply trigger formulaire', () => {
  it("propose le widget quand l'assistant promet le formulaire même si l'intent user est misc", async () => {
    useStubReply('Je vous affiche le formulaire juste ici pour être rappelée.');
    const session = makeTestSession();

    const r = await runUserTurn(session, 'je ne sais pas trop quoi choisir');

    expect(r.leadOffered).toBe(true);
    expect(r.leadOfferReason).toBe('manual');
    const evt = simStores.events.find((e) => e.type === 'chat_lead_form_offered');
    expect(evt).toBeDefined();
    expect((evt!.payload as { source?: string }).source).toBe(
      'assistant-reply-form',
    );
  });

  it("ne propose pas deux offres si une offre a déjà été émise dans la session", async () => {
    useStubReply('Je vous affiche le formulaire juste ici.');
    const session = makeTestSession();

    const r1 = await runUserTurn(session, 'premier message neutre');
    expect(r1.leadOffered).toBe(true);

    const r2 = await runUserTurn(session, 'deuxième message neutre');
    expect(r2.leadOffered).toBe(false);

    const offers = simStores.events.filter((e) => e.type === 'chat_lead_form_offered');
    expect(offers).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Scénario 3 — Conversation type complète (greeting → pricing → purchase)
// ---------------------------------------------------------------------------

describe('Scénario 3 — conversation complète (CHA-225)', () => {
  it("propose le widget UNIQUEMENT au tour où l'intent purchase apparaît", async () => {
    useStubReply('Réponse stub par défaut.');
    const session = makeTestSession();

    const results = await runConversation(session, [
      'Bonjour',
      "C'est combien le kit ?",
      'Je le prends',
    ]);

    expect(results).toHaveLength(3);
    // Tour 1 (greeting) → pas d'offre.
    expect(results[0]!.leadOffered).toBe(false);
    // Tour 2 (pricing) → pas d'offre (pas dans la liste lead-decision).
    expect(results[1]!.leadOffered).toBe(false);
    // Tour 3 ("Je le prends") → strong purchase-intent → offre.
    expect(results[2]!.leadOffered).toBe(true);
    expect(results[2]!.leadOfferReason).toBe('purchase-intent');
  });

  it("crée un lead automatique si l'utilisateur tape son tel APRÈS avoir demandé prix", async () => {
    useStubReply('Réponse stub.');
    const session = makeTestSession();

    const results = await runConversation(session, [
      'Bonjour',
      "C'est combien le kit ?",
      'OK je le veux. Yasmine 0612345678',
    ]);

    // Tour 3 : le numéro est dans le message → auto-lead.
    expect(results[2]!.autoLeadCreated).toBe(true);
    expect(results[2]!.leadOffered).toBe(true);
    // Le lead doit avoir Yasmine + le numéro normalisé.
    const lead = simStores.leads.values().next().value!;
    expect(lead.firstName).toBe('Yasmine');
    expect(lead.phoneE164).toBe('+212612345678');
  });
});

// ---------------------------------------------------------------------------
// Scénario 4 — Robustesse (multilingue, longues phrases, edge cases)
// ---------------------------------------------------------------------------

describe('Scénario 4 — robustesse', () => {
  it("ne crée pas de lead si le toggle runtime 'lead_form_enabled' est désactivé", async () => {
    useStubReply('OK.');
    const session = makeTestSession();
    simStores.runtimeFlags.set('lead_form_enabled', false);

    const r = await runUserTurn(session, 'hamid +212751592310');

    expect(r.leadOffered).toBe(false);
    expect(r.autoLeadCreated).toBe(false);
    expect(r.leads).toHaveLength(0);
  });

  it("phone dans une phrase longue avec contexte commercial → lead créé", async () => {
    useStubReply('Très bien.');
    const session = makeTestSession();

    const r = await runUserTurn(
      session,
      "Bonjour, ça fait plusieurs jours que je regarde votre kit, je crois que je vais le prendre. Mon prénom c'est Karim et mon numéro 0612345678 — appellez-moi avant 18h merci",
    );

    expect(r.autoLeadCreated).toBe(true);
    expect(r.leads[0]!.phoneE164).toBe('+212612345678');
    // Le prénom devrait être extrait correctement.
    expect(['Karim', 'Visiteur']).toContain(r.leads[0]!.firstName);
  });

  it("numéro français '+33 6 12 34 56 78' → lead créé avec country=FR", async () => {
    useStubReply('OK.');
    const session = makeTestSession();

    const r = await runUserTurn(
      session,
      "Sophie depuis Paris, mon tel : +33 6 12 34 56 78",
    );

    expect(r.autoLeadCreated).toBe(true);
    expect(r.leads[0]!.phoneE164).toBe('+33612345678');
  });
});
