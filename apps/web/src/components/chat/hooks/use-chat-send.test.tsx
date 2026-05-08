/**
 * CHA-225 — Tests `useChatSend` hook : routing des évents SSE vers le store.
 *
 * Reproduit fidèlement le scénario reporté en prod :
 *  - on POST `/api/chat/message`,
 *  - le serveur stream `start → chunk → end → lead-form-offer`,
 *  - le hook DOIT propager `lead-form-offer` au store via
 *    `useChatStore.getState().receiveLeadOffer()`.
 *
 * Si le parser SSE fermait la boucle au premier `event: end` (bug latent
 * que `sse-reader.test.ts` blinde), `leadOffer` resterait à `idle` et
 * le widget ne s'afficherait jamais — c'est exactement ce qu'on observait
 * en prod avant le fix CHA-225.
 *
 * Le test ne dépend ni d'un vrai backend ni d'un vrai LLM : on remplace
 * `globalThis.fetch` par un stream local qui réplique le contrat SSE.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useChatStore } from '../chat-store';
import { useChatSend } from './use-chat-send';

/**
 * Désactive la cadence humanisée pendant le test : on simule
 * `prefers-reduced-motion: reduce` pour court-circuiter
 * `humanizeStream` (sinon le test attend ≥ 600 ms avant le 1er token,
 * ce qui ralentit la suite et complexifie les assertions).
 */
function patchReducedMotion(matches: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

/**
 * Construit une Response SSE en streaming. Permet de fragmenter le
 * payload en morceaux (un par chunk) pour tester la robustesse au
 * découpage réseau.
 */
function makeSseResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const c of chunks) {
        controller.enqueue(enc.encode(c));
        // Cède le tour pour permettre au consommateur de boucler.
        await new Promise((r) => setTimeout(r, 0));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

let restoreFetch: () => void = () => {};
let restoreReducedMotion: () => void = () => {};

beforeEach(() => {
  // Reset store avant chaque test.
  useChatStore.setState({
    sessionId: 'sess-test',
    language: 'fr',
    isOpen: true,
    isStreaming: false,
    messages: [],
    pendingAssistantId: null,
    error: null,
    greeting: '',
    suggestions: [],
    leadOffer: {
      status: 'idle',
      triggeringMessageId: null,
      reason: null,
      copyKey: null,
      errorMessage: null,
      successMessage: null,
    },
    leadOfferDismissedSessionId: null,
    leadCapturedSessionId: null,
    hasInteracted: false,
  });
  restoreReducedMotion = patchReducedMotion(true);
});

afterEach(() => {
  restoreFetch();
  restoreReducedMotion();
  restoreFetch = () => {};
  restoreReducedMotion = () => {};
});

function stubFetch(makeResponse: () => Response | Promise<Response>): void {
  const original = globalThis.fetch;
  globalThis.fetch = async () => makeResponse();
  restoreFetch = () => {
    globalThis.fetch = original;
  };
}

describe('useChatSend — lead-form-offer routing', () => {
  it("pousse un offer 'purchase-intent' dans le store quand le SSE l'émet APRÈS event:end", async () => {
    const payload = [
      'event: start\ndata: {"messageId":"m1","language":"fr"}\n\n',
      'event: chunk\ndata: {"messageId":"m1","delta":"OK"}\n\n',
      'event: end\ndata: {"messageId":"m1","latencyMs":42}\n\n',
      // Évent CRITIQUE émis APRÈS end. C'est exactement la séquence du
      // bug prod : si le parser stoppait à `end`, on perdrait l'offer.
      'event: lead-form-offer\ndata: {"messageId":"m1","reason":"purchase-intent","copyKey":"purchase-intent"}\n\n',
    ];
    stubFetch(() => makeSseResponse(payload));

    const { result } = renderHook(() => useChatSend());
    await act(async () => {
      await result.current.send('Je veux commander le kit');
    });

    await waitFor(() => {
      expect(useChatStore.getState().leadOffer.status).toBe('offered');
    });

    const lo = useChatStore.getState().leadOffer;
    expect(lo).toMatchObject({
      status: 'offered',
      triggeringMessageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
  });

  it("pousse un offer 'inline-contact' (téléphone détecté en clair)", async () => {
    const payload = [
      'event: start\ndata: {"messageId":"m2","language":"fr"}\n\n',
      'event: chunk\ndata: {"messageId":"m2","delta":"Bien noté"}\n\n',
      'event: end\ndata: {"messageId":"m2","latencyMs":18}\n\n',
      'event: lead-form-offer\ndata: {"messageId":"m2","reason":"inline-contact","copyKey":"inline-contact"}\n\n',
    ];
    stubFetch(() => makeSseResponse(payload));

    const { result } = renderHook(() => useChatSend());
    await act(async () => {
      await result.current.send('hamid +212751592310');
    });

    await waitFor(() => {
      expect(useChatStore.getState().leadOffer.status).toBe('offered');
    });
    expect(useChatStore.getState().leadOffer.reason).toBe('inline-contact');
  });

  it("ne crée PAS d'offer si la session a déjà capturé un lead", async () => {
    // Simule : lead déjà capturé pour cette session.
    useChatStore.setState({ leadCapturedSessionId: 'sess-test' });

    const payload = [
      'event: start\ndata: {"messageId":"m3","language":"fr"}\n\n',
      'event: end\ndata: {"messageId":"m3","latencyMs":10}\n\n',
      'event: lead-form-offer\ndata: {"messageId":"m3","reason":"purchase-intent","copyKey":"purchase-intent"}\n\n',
    ];
    stubFetch(() => makeSseResponse(payload));

    const { result } = renderHook(() => useChatSend());
    await act(async () => {
      await result.current.send('test');
    });

    // L'offer doit être ignoré côté store.
    expect(useChatStore.getState().leadOffer.status).toBe('idle');
  });

  it("ne crée PAS d'offer si l'utilisateur a déjà rejeté ET que la raison est faible (after-hours)", async () => {
    // CHA-229 — Une raison « soft » qui arrive après dismiss reste
    // bloquée : on ne harcèle pas la visiteuse avec des heuristiques
    // (after-hours, frustration, out-of-knowledge, etc.).
    useChatStore.setState({ leadOfferDismissedSessionId: 'sess-test' });

    const payload = [
      'event: start\ndata: {"messageId":"m4","language":"fr"}\n\n',
      'event: end\ndata: {"messageId":"m4","latencyMs":5}\n\n',
      'event: lead-form-offer\ndata: {"messageId":"m4","reason":"after-hours","copyKey":"after-hours"}\n\n',
    ];
    stubFetch(() => makeSseResponse(payload));

    const { result } = renderHook(() => useChatSend());
    await act(async () => {
      await result.current.send('test');
    });

    expect(useChatStore.getState().leadOffer.status).toBe('idle');
  });

  it("CHA-229 : crée l'offer après dismiss si la raison est FORTE (explicit-request)", async () => {
    // Bug reporté en prod : la visiteuse ferme la première bulle ("Plus
    // tard"), puis demande explicitement à parler à un humain. On doit
    // ré-afficher la bulle — pas la rater au moment où l'intent est mûr.
    useChatStore.setState({ leadOfferDismissedSessionId: 'sess-test' });

    const payload = [
      'event: start\ndata: {"messageId":"m4b","language":"fr"}\n\n',
      'event: end\ndata: {"messageId":"m4b","latencyMs":5}\n\n',
      'event: lead-form-offer\ndata: {"messageId":"m4b","reason":"explicit-request","copyKey":"explicit-request"}\n\n',
    ];
    stubFetch(() => makeSseResponse(payload));

    const { result } = renderHook(() => useChatSend());
    await act(async () => {
      await result.current.send('test');
    });

    await waitFor(() => {
      expect(useChatStore.getState().leadOffer.status).toBe('offered');
    });
    expect(useChatStore.getState().leadOffer.reason).toBe('explicit-request');
  });

  it("CHA-229 : crée l'offer après dismiss si la raison est inline-contact (numéro tapé)", async () => {
    // Si la visiteuse tape son numéro après avoir fermé une bulle, on
    // doit lui re-proposer le formulaire pour confirmer le consent RGPD.
    // Le lead anonyme côté DB est créé en parallèle par l'orchestrator.
    useChatStore.setState({ leadOfferDismissedSessionId: 'sess-test' });

    const payload = [
      'event: start\ndata: {"messageId":"m4c","language":"fr"}\n\n',
      'event: end\ndata: {"messageId":"m4c","latencyMs":5}\n\n',
      'event: lead-form-offer\ndata: {"messageId":"m4c","reason":"inline-contact","copyKey":"inline-contact"}\n\n',
    ];
    stubFetch(() => makeSseResponse(payload));

    const { result } = renderHook(() => useChatSend());
    await act(async () => {
      await result.current.send('test');
    });

    await waitFor(() => {
      expect(useChatStore.getState().leadOffer.status).toBe('offered');
    });
    expect(useChatStore.getState().leadOffer.reason).toBe('inline-contact');
  });

  it("résiste à un découpage réseau au milieu du bloc lead-form-offer", async () => {
    // L'évent lead-form-offer est artificiellement coupé en deux
    // chunks réseau au milieu de la ligne data:. Le parser doit
    // reconstituer l'évent et le routage doit fonctionner.
    const chunks = [
      'event: start\ndata: {"messageId":"m5","language":"fr"}\n\n',
      'event: end\ndata: {"messageId":"m5","latencyMs":3}\n\n',
      'event: lead-form-offer\ndata: {"messa',
      'geId":"m5","reason":"purchase-intent","copyKey":"purchase-intent"}\n\n',
    ];
    stubFetch(() => makeSseResponse(chunks));

    const { result } = renderHook(() => useChatSend());
    await act(async () => {
      await result.current.send('Je veux commander');
    });

    await waitFor(() => {
      expect(useChatStore.getState().leadOffer.status).toBe('offered');
    });
    expect(useChatStore.getState().leadOffer.triggeringMessageId).toBe('m5');
  });

  it("reste 'idle' si le SSE n'émet PAS de lead-form-offer", async () => {
    const payload = [
      'event: start\ndata: {"messageId":"m6","language":"fr"}\n\n',
      'event: chunk\ndata: {"messageId":"m6","delta":"hello"}\n\n',
      'event: end\ndata: {"messageId":"m6","latencyMs":1}\n\n',
    ];
    stubFetch(() => makeSseResponse(payload));

    const { result } = renderHook(() => useChatSend());
    await act(async () => {
      await result.current.send('hello');
    });

    expect(useChatStore.getState().leadOffer.status).toBe('idle');
    expect(useChatStore.getState().messages.some((m) => m.role === 'assistant')).toBe(true);
  });
});
