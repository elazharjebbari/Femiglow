const PRIVATE_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal']);

function ipv4InRange(parts: number[], start: number[], maskBits: number): boolean {
  const [p0 = 0, p1 = 0, p2 = 0, p3 = 0] = parts;
  const [s0 = 0, s1 = 0, s2 = 0, s3 = 0] = start;
  const a = (p0 << 24) | (p1 << 16) | (p2 << 8) | p3;
  const b = (s0 << 24) | (s1 << 16) | (s2 << 8) | s3;
  const mask = maskBits === 0 ? 0 : 0xffffffff << (32 - maskBits);
  return (a & mask) === (b & mask);
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4) return null;
  for (const p of parts) {
    if (!Number.isInteger(p) || p < 0 || p > 255) return null;
  }
  return parts;
}

const PRIVATE_IPV4_RANGES: Array<[number[], number]> = [
  [[10, 0, 0, 0], 8],
  [[172, 16, 0, 0], 12],
  [[192, 168, 0, 0], 16],
  [[127, 0, 0, 0], 8],
  [[169, 254, 0, 0], 16],
  [[100, 64, 0, 0], 10],
  [[0, 0, 0, 0], 8],
];

export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (PRIVATE_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))
    return true;
  const ip = parseIpv4(host);
  if (ip) {
    for (const [start, mask] of PRIVATE_IPV4_RANGES) {
      if (ipv4InRange(ip, start, mask)) return true;
    }
  }
  return false;
}
