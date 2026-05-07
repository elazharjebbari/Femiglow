import { createHash } from 'node:crypto';

export function getClientIp(request: Request | { headers: Headers }): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0];
    if (first) return first.trim();
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return '0.0.0.0';
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}
