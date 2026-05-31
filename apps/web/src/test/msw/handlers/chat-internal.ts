/**
 * MSW handlers pour les routes internes `/api/chat/*`.
 *
 * Utilisés par les tests **component** qui rendent `<ChatWidget />` et
 * veulent simuler les réponses API sans monter le backend.
 *
 * Pour les tests d'**intégration backend** (qui montent vraiment la route),
 * ces handlers sont **non utilisés** — laisser les handlers OpenAI/etc.
 * et le pipeline réel travailler.
 */
import { http, HttpResponse } from 'msw';
import { makeChatSseStream } from '../helpers/make-sse-stream';

export const chatInternalHandlers = [
  // Session create — happy path par défaut
  http.post('/api/chat/session', () =>
    HttpResponse.json({
      sessionId: 'cs_test_msw',
      visitorId: 'vis_test_msw',
      language: 'fr-MA',
    }),
  ),

  // Session forget (RGPD) — accept anything, return OK
  http.post('/api/chat/session/forget', () =>
    HttpResponse.json({ ok: true }),
  ),

  // Message — SSE stream nominal court
  http.post('/api/chat/message', () => {
    const stream = makeChatSseStream([
      { event: 'start', data: { messageId: 'cm_test_1', latency: 42 } },
      { event: 'chunk', data: { text: 'Bonjour ' } },
      { event: 'chunk', data: { text: 'visiteur !' } },
      {
        event: 'end',
        data: {
          messageId: 'cm_test_1',
          usage: { tokensIn: 10, tokensOut: 5, cost: 0.001 },
        },
      },
    ]);
    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }),

  // Health
  http.get('/api/chat/health', () =>
    HttpResponse.json({
      ok: true,
      providers: [{ kind: 'openai', breaker: 'CLOSED' }],
      serviceLevel: 0,
    }),
  ),

  // Feedback (thumbs up/down)
  http.post('/api/chat/feedback', () => HttpResponse.json({ ok: true })),

  // Event (KPI tracking)
  http.post('/api/chat/event', () => HttpResponse.json({ ok: true })),

  // Theme (active preset)
  http.get('/api/chat/theme', () =>
    HttpResponse.json({
      id: 'ct_default',
      name: 'Default',
      tokens: { primary: '#A55C5C' },
      layout: { position: 'bottom-right' },
    }),
  ),

  // Canned pair (suggestions)
  http.get('/api/chat/canned-pair', () =>
    HttpResponse.json({
      items: [
        {
          id: 'cp_test_1',
          key: 'price',
          label: 'Combien coûte le kit ?',
          ctaLabel: null,
        },
      ],
    }),
  ),

  // Lead contact (capture)
  http.post('/api/chat/lead/contact', () =>
    HttpResponse.json({ ok: true, leadId: 'ld_test_msw' }),
  ),

  // Lead email (verification)
  http.post('/api/chat/lead/email', () => HttpResponse.json({ ok: true })),
];
