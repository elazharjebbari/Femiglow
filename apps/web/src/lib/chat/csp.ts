/**
 * CHA-007 — Extensions CSP `connect-src` pour le widget chat.
 *
 * Le widget visiteur ouvre des SSE/HTTP vers `/api/chat/*` (same
 * origin → couvert par `'self'`). Les providers IA, eux, ne sont
 * jamais appelés depuis le navigateur : tout passe par le serveur.
 *
 * On expose néanmoins une fabrique qui permettra, si une future
 * version branche un provider streaming directement côté client
 * (ex. Ollama local sur preview, ou WebSocket),
 * d'autoriser les domaines correspondants.
 *
 * cf. docs/chat-assistant/13-securite-rgpd-moderation.md §3.2
 */
import { env } from '@/lib/env';

interface ChatCspExtensions {
  connectSrc: string[];
}

export function buildChatCspExtensions(): ChatCspExtensions {
  const connect = new Set<string>();
  if (!env.CHAT_ENABLED || env.CHAT_ENABLED !== 'true') {
    return { connectSrc: [] };
  }
  // Si Ollama tourne en local côté client (rare, dev), ouvrir l'origine.
  if (env.CHAT_OLLAMA_BASE_URL) {
    try {
      const url = new URL(env.CHAT_OLLAMA_BASE_URL);
      connect.add(url.origin);
    } catch {
      // ignore
    }
  }
  // Azure OpenAI custom endpoint (si appel direct depuis le widget,
  // V2 — pour l'instant tout passe par le serveur).
  if (env.CHAT_AZURE_API_BASE) {
    try {
      const url = new URL(env.CHAT_AZURE_API_BASE);
      connect.add(url.origin);
    } catch {
      // ignore
    }
  }
  return { connectSrc: Array.from(connect) };
}
