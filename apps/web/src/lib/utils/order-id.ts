const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < length; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export function generateOrderSuffix(length = 5): string {
  const bytes = randomBytes(length);
  let suffix = '';
  for (let i = 0; i < length; i += 1) {
    const byte = bytes[i] ?? 0;
    suffix += ALPHABET.charAt(byte % ALPHABET.length);
  }
  return suffix;
}

export function generateOrderId(year: number = new Date().getFullYear()): string {
  return `FG-${year}-${generateOrderSuffix(5)}`;
}
