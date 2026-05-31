/**
 * CHA-068 — Lecteur SSE côté client.
 *
 * `fetch` + `ReadableStream` permettent de POST avec body JSON tout
 * en lisant les évènements `event: …\ndata: …\n\n`. Plus puissant que
 * `EventSource` qui ne supporte que GET sans body.
 *
 * CHA-231 — Validation Zod côté client (gap 4) :
 *   Chaque event SSE est validé par `chatStreamEvent.safeParse`. Si
 *   le payload ne respecte pas le contrat (server bug, attaque MITM,
 *   décalage de version), on log et on skip l'event au lieu de
 *   crasher l'iteration. Cela protège l'UI contre des deltas mal
 *   formés ou des champs renommés sans coordination.
 */
import { chatStreamEvent, type ChatStreamEvent } from '@/lib/chat/contracts';

export interface SseReaderOptions {
  url: string;
  body: unknown;
  signal?: AbortSignal;
  /** CHA-231 — callback opt-in pour observer les events invalides (debug/telemetry). */
  onInvalidEvent?: (info: { rawEvent: string; rawData: string; issues: string }) => void;
}

export async function* readSseStream(
  opts: SseReaderOptions,
): AsyncIterable<ChatStreamEvent> {
  const res = await fetch(opts.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(opts.body),
    signal: opts.signal,
    credentials: 'include',
  });
  if (!res.ok || !res.body) {
    throw new Error(`SSE failed: HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator: number;
      // Un évènement complet est délimité par "\n\n".
      while ((separator = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const ev = parseSseBlock(block, opts.onInvalidEvent);
        if (ev) yield ev;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse + valide un bloc SSE. Retourne `null` si :
 *   - L'event field est manquant.
 *   - Le JSON data est invalide.
 *   - Le payload ne respecte pas le schéma `chatStreamEvent`.
 *
 * Le callback `onInvalidEvent` permet d'observer les violations sans
 * qu'elles cassent le stream — utile pour le monitoring en prod.
 */
export function parseSseBlock(
  block: string,
  onInvalidEvent?: SseReaderOptions['onInvalidEvent'],
): ChatStreamEvent | null {
  let event = '';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!event) return null;
  let data: unknown = null;
  const rawData = dataLines.join('\n');
  if (rawData) {
    try {
      data = JSON.parse(rawData);
    } catch {
      onInvalidEvent?.({ rawEvent: event, rawData, issues: 'JSON parse failed' });
      return null;
    }
  }
  // CHA-231 — validation Zod (gap 4). On ne fait pas confiance à la
  // structure du serveur : un mismatch = skip + log.
  const parsed = chatStreamEvent.safeParse({ event, data });
  if (!parsed.success) {
    onInvalidEvent?.({
      rawEvent: event,
      rawData,
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
    });
    return null;
  }
  return parsed.data;
}
