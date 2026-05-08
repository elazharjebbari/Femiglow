/**
 * CHA-225 — Tests unitaires `readSseStream`.
 *
 * Garantit que le parseur SSE côté client :
 *  - traite TOUS les évents même ceux émis APRÈS `event: end`,
 *  - reconstitue les blocs split entre deux chunks réseau,
 *  - ignore les blocs sans champ `event:` (ne casse PAS la boucle),
 *  - propage les évents avec `data: …` JSON parsé,
 *  - ne perd pas l'ordre.
 *
 * Couvre la cause racine du bug "le formulaire ne s'affiche pas après
 * 'Je veux commander'" : le widget dépend d'un évent `lead-form-offer`
 * qui arrive APRÈS `event: end`. Si le parser fermait la boucle au
 * premier `end`, on perdrait l'offre. Ces tests blindent le contrat.
 */
import { describe, expect, it } from 'vitest';

import { readSseStream } from './sse-reader';

/**
 * Construit une Response Web standard avec un body en stream qui sert
 * la chaîne `payload` chunk par chunk (séparateur `||SPLIT||` pour les
 * tests qui veulent forcer une fragmentation entre deux blocs SSE).
 *
 * On ne mocke pas le réseau global — on remplace `globalThis.fetch`
 * pour la durée du test et on rétablit ensuite. Cela isole le test du
 * runtime fetch de jsdom et garde le contrat avec readSseStream.
 */
function withFetch<T>(
  payload: string,
  fragmentMarker: string | null,
  run: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    void input;
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        if (!fragmentMarker) {
          controller.enqueue(enc.encode(payload));
        } else {
          for (const part of payload.split(fragmentMarker)) {
            controller.enqueue(enc.encode(part));
            // micro-pause pour que readSseStream ait le temps de
            // re-rentrer dans la boucle de lecture.
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  };
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

async function collect(
  iter: AsyncIterable<{ event: string; data: unknown }>,
): Promise<Array<{ event: string; data: unknown }>> {
  const out: Array<{ event: string; data: unknown }> = [];
  for await (const ev of iter) out.push(ev);
  return out;
}

describe('readSseStream', () => {
  it('yields events in order including events emitted AFTER event: end', async () => {
    const payload = [
      'event: start',
      'data: {"messageId":"m1","language":"fr"}',
      '',
      'event: chunk',
      'data: {"messageId":"m1","delta":"Bon"}',
      '',
      'event: chunk',
      'data: {"messageId":"m1","delta":"jour"}',
      '',
      'event: end',
      'data: {"messageId":"m1","latencyMs":42}',
      '',
      // CHA-225 — Évent CRITIQUE émis APRÈS end.
      'event: lead-form-offer',
      'data: {"messageId":"m1","reason":"purchase-intent","copyKey":"purchase-intent"}',
      '',
      '',
    ].join('\n');

    const events = await withFetch(payload, null, async () => {
      return collect(
        readSseStream({ url: '/api/chat/message', body: { sessionId: 's', text: 't' } }),
      );
    });

    expect(events.map((e) => e.event)).toEqual([
      'start',
      'chunk',
      'chunk',
      'end',
      'lead-form-offer',
    ]);
    expect(events[4]!.data).toMatchObject({
      messageId: 'm1',
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
    });
  });

  it('reconstructs an event whose block is split across two network chunks', async () => {
    // L'évent lead-form-offer est ARTIFICIELLEMENT coupé en deux chunks
    // au milieu de la ligne data. Le parser doit attendre le second
    // chunk avant de produire l'évent.
    const payload =
      'event: start\ndata: {"messageId":"m1","language":"fr"}\n\n' +
      'event: end\ndata: {"messageId":"m1","latencyMs":1}\n\n' +
      // Coupure ICI ↓
      'event: lead-form-offer\ndata: {"messa||SPLIT||geId":"m1","reason":"inline-contact","copyKey":"inline-contact"}\n\n';

    const events = await withFetch(payload, '||SPLIT||', async () =>
      collect(
        readSseStream({ url: '/api/chat/message', body: { sessionId: 's', text: 't' } }),
      ),
    );

    expect(events.map((e) => e.event)).toEqual(['start', 'end', 'lead-form-offer']);
    expect(events[2]!.data).toMatchObject({ reason: 'inline-contact' });
  });

  it('skips a block that has data but no event field (defensive)', async () => {
    const payload = [
      'data: {"orphan":true}', // pas de event:
      '',
      'event: end',
      'data: {"messageId":"m1","latencyMs":0}',
      '',
      '',
    ].join('\n');

    const events = await withFetch(payload, null, async () =>
      collect(
        readSseStream({ url: '/api/chat/message', body: { sessionId: 's', text: 't' } }),
      ),
    );

    expect(events.map((e) => e.event)).toEqual(['end']);
  });

  it('throws if the HTTP response is not OK', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (): Promise<Response> =>
      new Response('boom', { status: 500 });
    try {
      await expect(
        collect(
          readSseStream({ url: '/api/chat/message', body: { sessionId: 's', text: 't' } }),
        ),
      ).rejects.toThrow(/SSE failed/);
    } finally {
      globalThis.fetch = original;
    }
  });
});
