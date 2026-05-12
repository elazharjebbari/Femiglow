/**
 * CHA-230 — Générateur d'ID compatible navigateur (pas de `node:crypto`).
 *
 * Utilise `crypto.getRandomValues` (Web Crypto), fallback `Math.random` pour
 * les contextes JSDOM/test très anciens. Format aligné avec `lib/ids.ts`
 * côté serveur (alphabet 36 caractères, longueur 24).
 *
 * Pourquoi un module séparé ? `lib/ids.ts` importe `node:crypto` et n'est
 * donc pas safe à bundler côté client (Next 14 webpack chokerait sur
 * `randomBytes`). Ce module reste universel (SSR + CSR).
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 20;

function getRandomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    globalThis.crypto.getRandomValues(buf);
    return buf;
  }
  // Fallback ultime — non cryptographiquement sûr mais suffisant pour des
  // IDs opaques sans usage sécurité.
  for (let i = 0; i < length; i += 1) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}

export function createId(prefix?: string): string {
  const bytes = getRandomBytes(ID_LENGTH);
  let id = '';
  for (let i = 0; i < bytes.length; i += 1) {
    id += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  }
  return prefix ? `${prefix}_${id}` : id;
}
