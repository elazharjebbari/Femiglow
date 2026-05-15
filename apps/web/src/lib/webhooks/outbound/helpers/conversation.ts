import type { ConversationMessage } from '../payload';

type SnapshotMessage = {
  role: 'user' | 'assistant' | 'bot' | 'system' | 'tool';
  content?: string | null;
  text?: string | null;
  at?: string | Date | null;
  ts?: string | Date | null;
  name?: string | null;
};

export interface ConversationLimits {
  maxMessages?: number;
  maxBytes?: number;
  maxTextLength?: number;
  userName?: string | null;
}

const DEFAULT_MAX_MESSAGES = 50;
const DEFAULT_MAX_BYTES = 30_000;
const DEFAULT_MAX_TEXT_LENGTH = 4_000;

function toIso(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function byteLength(messages: ConversationMessage[]): number {
  return Buffer.byteLength(JSON.stringify(messages), 'utf8');
}

export function limitConversationPayload(
  messages: ConversationMessage[],
  limits: ConversationLimits = {},
): ConversationMessage[] | undefined {
  const maxMessages = Math.max(1, Math.min(limits.maxMessages ?? DEFAULT_MAX_MESSAGES, DEFAULT_MAX_MESSAGES));
  const maxBytes = Math.max(1, Math.min(limits.maxBytes ?? DEFAULT_MAX_BYTES, 50_000));
  const maxTextLength = Math.max(1, Math.min(limits.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH, DEFAULT_MAX_TEXT_LENGTH));

  let out = messages.slice(-maxMessages).map((message) => ({
    ...message,
    text: message.text.slice(0, maxTextLength),
  }));

  while (out.length > 0 && byteLength(out) > maxBytes) {
    out = out.slice(1);
  }
  return out.length ? out : undefined;
}

export function snapshotMessagesToConversation(
  snapshot: SnapshotMessage[] | null | undefined,
  limits: ConversationLimits = {},
): ConversationMessage[] | undefined {
  if (!snapshot?.length) return undefined;

  const mapped = snapshot
    .filter((message) => message.role !== 'system' && message.role !== 'tool')
    .map((message): ConversationMessage | null => {
      const text = (message.text ?? message.content ?? '').trim();
      const ts = toIso(message.ts ?? message.at);
      if (!text || !ts) return null;
      const role = message.role === 'user' ? 'user' : 'bot';
      return {
        role,
        name:
          message.name?.trim() ||
          (role === 'user' ? (limits.userName?.trim() || 'Visiteur') : 'Assistant'),
        text,
        ts,
      };
    })
    .filter((message): message is ConversationMessage => message !== null);

  return limitConversationPayload(mapped, limits);
}

export const chatMessagesToConversation = snapshotMessagesToConversation;
