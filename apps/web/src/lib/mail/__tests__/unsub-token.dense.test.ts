/**
 * Module 09 — Parcours client : batterie DENSE pour le token one-click
 * List-Unsubscribe (RFC 8058). Complète `unsub-token.test.ts` (round-trip
 * de base) avec : payload exact, horloge déterministe (fake timers) sur la
 * fenêtre d'expiration, falsification (signature/payload/secret distinct),
 * et malformés (base64 cassé / vide / géant).
 *
 * Matrice : CLI-UNIT-007 (round-trip + payload exact), CLI-UNIT-008
 * (falsifié → null), CLI-UNIT-009 (expiré → null).
 *
 * Choix d'isolation : on POSITIONNE le secret AVANT le premier import du
 * module (qui lit `env.MAIL_UNSUB_TOKEN_SECRET` via `getSecret()` à chaque
 * appel). Le secret n'est donc PAS figé au load — on peut le permuter entre
 * blocs via remock de `@/lib/env` + ré-import. Pour le cas « secret
 * différent » on forge en parallèle un token HMAC avec un autre secret et on
 * exige que le `verify` officiel le rejette (pas de remock nécessaire).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';

const ORIGINAL_ENV = { ...process.env };
const SECRET = 'unsub-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // >= 32 chars

const VALIDITY_SECONDS = 90 * 24 * 60 * 60; // doit refléter la constante du module

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Forge un token (sig.payload) avec un secret arbitraire — pour les cas falsifiés. */
function forgeToken(email: string, exp: number, secret: string): string {
  const payload = `${email.toLowerCase().trim()}|${exp}`;
  const sig = createHmac('sha256', secret).update(payload).digest();
  return `${b64url(sig)}.${b64url(Buffer.from(payload))}`;
}

beforeAll(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET = SECRET;
  vi.resetModules();
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

async function load() {
  return import('../unsub-token');
}

describe('unsub-token — payload exact & round-trip (CLI-UNIT-007)', () => {
  it('génère un token à 2 segments base64url et retrouve l email normalisé', async () => {
    const { generateUnsubToken, verifyUnsubToken } = await load();
    const token = generateUnsubToken('Kaoutar@Exemple.Test');
    // Structure : exactement sig.payload, deux segments base64url (pas de = / + /).
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    for (const p of parts) expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
    // Oracle métier : l'email est normalisé (lowercase, trim) à la génération
    // ET récupéré tel quel à la vérification.
    expect(verifyUnsubToken(token)).toBe('kaoutar@exemple.test');
  });

  it('le payload encodé porte exactement "email|exp" avec exp = now+90j', async () => {
    const { generateUnsubToken } = await load();
    const nowMs = Date.UTC(2026, 5, 4, 10, 0, 0); // ancrage fixe
    const token = generateUnsubToken('user@example.com', nowMs);
    const payloadB64 = token.split('.')[1]!;
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((payloadB64.length + 3) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const expectedExp = Math.floor(nowMs / 1000) + VALIDITY_SECONDS;
    expect(decoded).toBe(`user@example.com|${expectedExp}`);
  });

  it('la signature est un HMAC-SHA256 du payload sous le secret courant', async () => {
    const { generateUnsubToken } = await load();
    const nowMs = Date.UTC(2026, 5, 4, 10, 0, 0);
    const token = generateUnsubToken('user@example.com', nowMs);
    const [sigB64, payloadB64] = token.split('.') as [string, string];
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((payloadB64.length + 3) % 4);
    const payload = Buffer.from(padded, 'base64').toString('utf8');
    const expectedSig = b64url(createHmac('sha256', SECRET).update(payload).digest());
    expect(sigB64).toBe(expectedSig);
  });

  it('unsubscribeUrl assemble baseUrl + token URL-encodé', async () => {
    const { unsubscribeUrl, verifyUnsubToken } = await load();
    const url = unsubscribeUrl('user@example.com', 'https://femiglow-maroc.com');
    expect(url.startsWith('https://femiglow-maroc.com/api/mail/unsubscribe?t=')).toBe(true);
    const t = new URL(url).searchParams.get('t');
    expect(t).toBeTruthy();
    // Le token transporté reste vérifiable.
    expect(verifyUnsubToken(t!)).toBe('user@example.com');
  });
});

describe('unsub-token — horloge / expiration exacte (CLI-UNIT-009)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('valide à T+0 (Date.now() courant figé)', async () => {
    const { generateUnsubToken, verifyUnsubToken } = await load();
    const t0 = Date.UTC(2026, 5, 4, 10, 0, 0);
    vi.setSystemTime(t0);
    const token = generateUnsubToken('clock@example.com'); // utilise Date.now()
    expect(verifyUnsubToken(token)).toBe('clock@example.com'); // même Date.now()
  });

  it('valide à la SECONDE PILE de l expiration (exp inclus, > exp rejeté)', async () => {
    const { generateUnsubToken, verifyUnsubToken } = await load();
    const t0 = Date.UTC(2026, 5, 4, 10, 0, 0);
    const token = generateUnsubToken('edge@example.com', t0);
    const expSec = Math.floor(t0 / 1000) + VALIDITY_SECONDS;
    // À exactement exp (floor(now/1000) === exp) : encore valide (code: > exp rejette).
    expect(verifyUnsubToken(token, expSec * 1000)).toBe('edge@example.com');
    // 1 seconde après exp : rejeté.
    expect(verifyUnsubToken(token, (expSec + 1) * 1000)).toBeNull();
  });

  it('rejette un token vieux de 91 jours (au-delà de la fenêtre 90j)', async () => {
    const { generateUnsubToken, verifyUnsubToken } = await load();
    const t0 = Date.UTC(2026, 5, 4, 10, 0, 0);
    const token = generateUnsubToken('old@example.com', t0);
    const ninetyOneDays = t0 + 91 * 24 * 60 * 60 * 1000;
    expect(verifyUnsubToken(token, ninetyOneDays)).toBeNull();
  });
});

describe('unsub-token — falsification (CLI-UNIT-008)', () => {
  it('signature altérée (1 octet) → null', async () => {
    const { generateUnsubToken, verifyUnsubToken } = await load();
    const token = generateUnsubToken('victim@example.com');
    const [sig, payload] = token.split('.') as [string, string];
    // Flip d'un caractère de la signature (en restant base64url valide).
    const flipped = sig[0] === 'A' ? 'B' : 'A';
    const tampered = `${flipped}${sig.slice(1)}.${payload}`;
    expect(verifyUnsubToken(tampered)).toBeNull();
  });

  it('payload modifié (email réécrit) sans re-signer → null', async () => {
    const { generateUnsubToken, verifyUnsubToken } = await load();
    const token = generateUnsubToken('victim@example.com');
    const [sig] = token.split('.') as [string, string];
    const farFuture = Math.floor(Date.now() / 1000) + VALIDITY_SECONDS;
    const fakePayload = b64url(Buffer.from(`attacker@example.com|${farFuture}`));
    expect(verifyUnsubToken(`${sig}.${fakePayload}`)).toBeNull();
  });

  it('exp prolongé dans le payload sans re-signer → null (pas de bypass d expiration)', async () => {
    const { generateUnsubToken, verifyUnsubToken } = await load();
    const token = generateUnsubToken('victim@example.com');
    const [sig] = token.split('.') as [string, string];
    const farFuture = Math.floor(Date.now() / 1000) + 10 * VALIDITY_SECONDS;
    const fakePayload = b64url(Buffer.from(`victim@example.com|${farFuture}`));
    expect(verifyUnsubToken(`${sig}.${fakePayload}`)).toBeNull();
  });

  it('token signé avec un AUTRE secret → null (clé étrangère rejetée)', async () => {
    const { verifyUnsubToken } = await load();
    const exp = Math.floor(Date.now() / 1000) + VALIDITY_SECONDS;
    // Token bien-formé, non expiré, mais signé avec un secret différent.
    const foreign = forgeToken('victim@example.com', exp, 'TOTALLY-DIFFERENT-SECRET-xxxxxxxxxxxxx');
    expect(verifyUnsubToken(foreign)).toBeNull();
    // Sanity : le même payload signé avec LE BON secret est accepté.
    const legit = forgeToken('victim@example.com', exp, SECRET);
    expect(verifyUnsubToken(legit)).toBe('victim@example.com');
  });
});

describe('unsub-token — malformés (rejet propre, jamais de throw)', () => {
  it('chaîne vide / sans séparateur / trop de segments → null', async () => {
    const { verifyUnsubToken } = await load();
    expect(verifyUnsubToken('')).toBeNull();
    expect(verifyUnsubToken('nodot')).toBeNull();
    expect(verifyUnsubToken('a.b.c')).toBeNull();
    expect(verifyUnsubToken('....')).toBeNull();
  });

  it('payload base64 « cassé » non décodable proprement → null sans exception', async () => {
    const { verifyUnsubToken } = await load();
    // Un payload qui ne contient pas de séparateur "|" après décodage.
    const sig = b64url(createHmac('sha256', SECRET).update('garbage').digest());
    expect(() => verifyUnsubToken(`${sig}.${b64url(Buffer.from('no-separator-here'))}`)).not.toThrow();
    expect(verifyUnsubToken(`${sig}.${b64url(Buffer.from('no-separator-here'))}`)).toBeNull();
  });

  it('exp non numérique dans le payload → null', async () => {
    const { verifyUnsubToken } = await load();
    const payload = b64url(Buffer.from('user@example.com|not-a-number'));
    const sig = b64url(createHmac('sha256', SECRET).update('user@example.com|not-a-number').digest());
    expect(verifyUnsubToken(`${sig}.${payload}`)).toBeNull();
  });

  it('token « géant » (payload de 100k) → null sans throw ni explosion mémoire', async () => {
    const { verifyUnsubToken } = await load();
    const huge = 'x'.repeat(100_000);
    expect(() => verifyUnsubToken(`${huge}.${huge}`)).not.toThrow();
    expect(verifyUnsubToken(`${huge}.${huge}`)).toBeNull();
  });

  it('séparateur "|" en première position (email vide) → null (sep < 1)', async () => {
    const { verifyUnsubToken } = await load();
    const exp = Math.floor(Date.now() / 1000) + VALIDITY_SECONDS;
    const payloadStr = `|${exp}`; // lastIndexOf('|') === 0 → sep < 1 → rejet
    const payload = b64url(Buffer.from(payloadStr));
    const sig = b64url(createHmac('sha256', SECRET).update(payloadStr).digest());
    expect(verifyUnsubToken(`${sig}.${payload}`)).toBeNull();
  });
});

describe('unsub-token — secret absent (configuration manquante)', () => {
  it('generate/verify lèvent une erreur explicite si le secret n est pas configuré', async () => {
    vi.resetModules();
    const prev = process.env.MAIL_UNSUB_TOKEN_SECRET;
    delete process.env.MAIL_UNSUB_TOKEN_SECRET;
    vi.doMock('@/lib/env', async () => {
      const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
      return { ...actual, env: { ...actual.env, MAIL_UNSUB_TOKEN_SECRET: undefined } };
    });
    try {
      const mod = await import('../unsub-token');
      expect(() => mod.generateUnsubToken('x@example.com')).toThrow(/MAIL_UNSUB_TOKEN_SECRET/);
    } finally {
      vi.doUnmock('@/lib/env');
      vi.resetModules();
      if (prev !== undefined) process.env.MAIL_UNSUB_TOKEN_SECRET = prev;
    }
  });
});
