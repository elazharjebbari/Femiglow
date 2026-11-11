/**
 * Hashing identity côté navigateur — SHA-256 via Web Crypto API.
 *
 * Symétrique de `hashing.ts` (Node `crypto`). Utilisé par le client de
 * tracking pour hydrater le dataLayer avec `user_data` (Enhanced
 * Conversions Google Ads + Advanced Matching Meta pixel).
 *
 * NB : SubtleCrypto est asynchrone. Les callers doivent `await` avant
 * de passer le résultat à `emit()`.
 *
 * Format de sortie : structure compatible Google Ads Enhanced
 * Conversions (cf. https://support.google.com/google-ads/answer/13262500):
 *   {
 *     sha256_email_address,
 *     sha256_phone_number,
 *     address: { sha256_first_name, sha256_last_name, city, country }
 *   }
 * Meta pixel et CAPI savent lire ce format via "Advanced Matching" si
 * GTM est configuré pour le propager.
 */

import { normalizePhoneDigits } from './phone-normalize';

export interface IdentityInput {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
}

export interface HashedUserData {
  sha256_email_address?: string;
  sha256_phone_number?: string;
  /** SHA-256 du format E.164 AVEC `+`, seul format accepté par Google Ads. */
  sha256_phone_e164?: string;
  address?: {
    sha256_first_name?: string;
    sha256_last_name?: string;
    city?: string;
    country?: string;
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalise un numéro de téléphone au format E.164 (sans le `+`).
 * Règles partagées avec le serveur : cf. `phone-normalize.ts` (préfixe
 * `212` ajouté au format national, avec ou sans le 0).
 */
export function normalizePhone(phone: string): string {
  return normalizePhoneDigits(phone);
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SubtleCrypto unavailable — browser context required.');
  }
  const data = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Hash les champs identity disponibles. Les champs vides sont omis.
 * `city` et `country` ne sont pas hashés (Google Ads attend du clear text
 * pour ces deux champs — cf. spec Enhanced Conversions).
 */
export async function hashIdentityBrowser(input: IdentityInput): Promise<HashedUserData> {
  const out: HashedUserData = {};
  const tasks: Promise<void>[] = [];

  if (input.email) {
    tasks.push(
      sha256Hex(normalizeEmail(input.email)).then((h) => {
        out.sha256_email_address = h;
      }),
    );
  }
  if (input.phone) {
    tasks.push(
      sha256Hex(normalizePhone(input.phone)).then((h) => {
        out.sha256_phone_number = h;
      }),
    );
    tasks.push(
      sha256Hex(`+${normalizePhone(input.phone)}`).then((h) => {
        out.sha256_phone_e164 = h;
      }),
    );
  }

  const address: NonNullable<HashedUserData['address']> = {};
  let hasAddress = false;
  if (input.firstName) {
    hasAddress = true;
    tasks.push(
      sha256Hex(normalizeName(input.firstName)).then((h) => {
        address.sha256_first_name = h;
      }),
    );
  }
  if (input.lastName) {
    hasAddress = true;
    tasks.push(
      sha256Hex(normalizeName(input.lastName)).then((h) => {
        address.sha256_last_name = h;
      }),
    );
  }
  if (input.city) {
    hasAddress = true;
    address.city = normalizeName(input.city);
  }
  if (input.country) {
    hasAddress = true;
    address.country = normalizeName(input.country);
  }

  await Promise.all(tasks);
  if (hasAddress) out.address = address;
  return out;
}
