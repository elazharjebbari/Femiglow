import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function createId(prefix?: string): string {
  const bytes = randomBytes(16);
  let id = '';
  for (let i = 0; i < bytes.length; i += 1) {
    id += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  }
  return prefix ? `${prefix}_${id.slice(0, 20)}` : id.slice(0, 24);
}
