/**
 * UUID v7 minimal — 48 bits timestamp ms + version 7 + variant + random.
 * Aucune d\u00e9pendance externe. Tri\u00e9 chronologiquement, idempotent dedup.
 */
function getRandomBytes(length: number): Uint8Array {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const buf = new Uint8Array(length);
    globalThis.crypto.getRandomValues(buf);
    return buf;
  }
  const buf = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function uuidv7(now = Date.now()): string {
  const ms = BigInt(now);
  const tsHex = ms.toString(16).padStart(12, '0');
  const random = getRandomBytes(10);
  random[0] = ((random[0] ?? 0) & 0x0f) | 0x70;
  random[2] = ((random[2] ?? 0) & 0x3f) | 0x80;
  const r = toHex(random);
  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-${r.slice(0, 4)}-${r.slice(4, 8)}-${r.slice(8, 20)}`;
}
