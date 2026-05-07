import { createHash } from 'node:crypto';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function hashIdentity(input: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
}): {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  country?: string;
} {
  const out: Record<string, string> = {};
  if (input.email) out.em = sha256Hex(normalizeEmail(input.email));
  if (input.phone) out.ph = sha256Hex(normalizePhone(input.phone));
  if (input.firstName) out.fn = sha256Hex(normalizeName(input.firstName));
  if (input.lastName) out.ln = sha256Hex(normalizeName(input.lastName));
  if (input.city) out.ct = sha256Hex(normalizeName(input.city));
  if (input.country) out.country = sha256Hex(normalizeName(input.country));
  return out;
}

export { sha256Hex };
