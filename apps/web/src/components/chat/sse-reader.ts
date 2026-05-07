/**
 * CHA-068 — Lecteur SSE côté client.
 *
 * `fetch` + `ReadableStream` permettent de POST avec body JSON tout
 * en lisant les évènements `event: …\ndata: …\n\n`. Plus puissant que
 * `EventSource` qui ne supporte que GET sans body.
 */
import type { ChatStreamEvent } from '@/lib/chat/contracts';

export interface SseReaderOptions {
  url: string;
  body: unknown;
  signal?: AbortSignal;
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
        const ev = parseSseBlock(block);
        if (ev) yield ev;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseBlock(block: string): ChatStreamEvent | null {
  let event = '';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!event) return null;
  let data: unknown = null;
  if (dataLines.length > 0) {
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      data = null;
    }
  }
  return { event, data } as ChatStreamEvent;
}
