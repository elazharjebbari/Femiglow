/**
 * CHAT-063 — Pré-remplissage du LeadForm depuis un précédent succès.
 *
 * Stratégie
 * ─────────
 *  - On stocke uniquement en `localStorage` côté navigateur, jamais côté
 *    serveur (RGPD friendly : l'utilisateur peut effacer ses données en
 *    vidant le storage).
 *  - On garde `firstName` + `phone` + `country` (pas la note — trop
 *    contextuelle).
 *  - Le TTL est de 90 jours : au-delà, on considère que les infos
 *    peuvent avoir changé et on n'auto-fill plus.
 *
 * On utilise une signature de version (`v1`) pour pouvoir évoluer sans
 * casser le chargement des anciennes valeurs.
 */
import type { ChatLeadCountryHint } from '@/lib/chat/contracts';

const STORAGE_KEY = 'fg.chat.lead-prefill.v1';
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface LeadPrefill {
  firstName: string;
  phone: string;
  country: ChatLeadCountryHint;
  savedAt: number;
}

const COUNTRY_VALUES = new Set<ChatLeadCountryHint>([
  'MA',
  'FR',
  'BE',
  'CH',
  'DZ',
  'TN',
]);

export function loadLeadPrefill(now: number = Date.now()): LeadPrefill | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LeadPrefill>;
    if (
      typeof parsed.firstName !== 'string' ||
      typeof parsed.phone !== 'string' ||
      typeof parsed.country !== 'string' ||
      typeof parsed.savedAt !== 'number'
    ) {
      return null;
    }
    if (now - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!COUNTRY_VALUES.has(parsed.country as ChatLeadCountryHint)) {
      return null;
    }
    return {
      firstName: parsed.firstName,
      phone: parsed.phone,
      country: parsed.country as ChatLeadCountryHint,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function saveLeadPrefill(
  data: Omit<LeadPrefill, 'savedAt'>,
  now: number = Date.now(),
): void {
  if (typeof window === 'undefined') return;
  if (!data.firstName.trim() || !data.phone.trim()) return;
  if (!COUNTRY_VALUES.has(data.country)) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        firstName: data.firstName.trim(),
        phone: data.phone.trim(),
        country: data.country,
        savedAt: now,
      } satisfies LeadPrefill),
    );
  } catch {
    // localStorage quota ou désactivé → silencieux.
  }
}

export function clearLeadPrefill(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
