# Chiffrement

## Vue d'ensemble

| Donnée | En transit | At-rest | Algorithme |
|---|---|---|---|
| Trafic HTTP | TLS 1.3 (Vercel) | n/a | RSA + ChaCha20-Poly1305 / AES-GCM |
| Connexion DB | TLS (Neon) | chiffrement disque (Neon/AWS) | AES-256 |
| Cookie session | (cookie HttpOnly) | (chiffré côté serveur, signé) | iron-session = AES-256-GCM |
| Mot de passe admin | n/a | hash argon2id (paramètres OWASP) | argon2id 19 MiB / 2 / 1 |
| Secret HMAC webhook | n/a | colonne `bytea` chiffrée (`pgp_sym_encrypt`) | symétrique AES-256 |
| Backups Neon | TLS (transfert) | chiffrement S3 SSE-KMS | AES-256 |
| Logs Vercel | TLS | chiffrement Vercel | géré par Vercel |

## TLS

Vercel termine TLS 1.3 (1.2 minimum). Aucune action côté code. HSTS
activé via header :

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Domaine `femiglow.ma` éligible à inscription HSTS preload list après
mise en place vérifiée.

## iron-session

```ts
import type { SessionOptions } from 'iron-session';

export const sessionOptions: SessionOptions = {
  password: process.env.ADMIN_SESSION_PASSWORD!, // ≥ 32 char
  cookieName: 'femiglow.admin.session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  },
};
```

Le secret iron-session est stocké en variable d'environnement Vercel
(scope production). Rotation : annuelle, ou après incident. La rotation
invalide toutes les sessions actives (ré-login requis).

## argon2id

```ts
import { hash, Algorithm } from '@node-rs/argon2';

const params = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,   // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

const passwordHash = await hash(plaintext, params);
```

Paramètres conformes aux recommandations OWASP 2024 pour argon2id.
Ajustement à reconsidérer si le hash dépasse 200 ms p95 (ou inversement,
descend sous 100 ms).

## Secret HMAC at-rest

### Configuration Postgres

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Wrapper TS

```ts
// apps/web/src/lib/crypto/encrypt.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

export async function encryptSecret(plaintext: string): Promise<Buffer> {
  const key = process.env.WEBHOOK_SECRET_KEY!;
  const [{ ciphertext }] = await db.execute<{ ciphertext: Buffer }>(
    sql`SELECT pgp_sym_encrypt(${plaintext}, ${key}, 'cipher-algo=aes256') AS ciphertext`,
  );
  return ciphertext;
}

export async function decryptSecret(ciphertext: Buffer): Promise<string> {
  const key = process.env.WEBHOOK_SECRET_KEY!;
  const [{ plaintext }] = await db.execute<{ plaintext: string }>(
    sql`SELECT pgp_sym_decrypt(${ciphertext}::bytea, ${key}) AS plaintext`,
  );
  return plaintext;
}
```

`WEBHOOK_SECRET_KEY` est une chaîne aléatoire ≥ 32 caractères, stockée
en variable d'environnement Vercel.

## Signature HMAC sortante

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function signHmac(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

export function verifyHmac(secret: string, body: string, signature: string): boolean {
  const expected = signHmac(secret, body);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
```

Header émis :
```
X-FemiGlow-Signature: sha256=ab12cd34…
```

Le consommateur recompose la signature avec son secret et compare en
temps constant.

## Rotation des clés

| Clé | Rotation | Procédure |
|---|---|---|
| `ADMIN_SESSION_PASSWORD` | annuelle ou post-incident | Mise à jour env Vercel → invalidation auto |
| `WEBHOOK_SECRET_KEY` | annuelle ou post-incident | re-chiffrement de tous les `encrypted_secret` (script) |
| Secret HMAC d'un endpoint | sur demande UI ou post-incident | bouton "Régénérer", consommateur informé |
| `CRON_SECRET` | annuelle | Mise à jour env Vercel + redéploiement |

Procédure détaillée : [`../09-environnement/secrets-rotation.md`](../09-environnement/secrets-rotation.md).

## Stockage local de credentials

**Aucun**. Le mot de passe admin n'est :
- jamais loggé,
- jamais stocké dans le navigateur (pas de "remember me" v1),
- jamais transmis hors HTTPS.

## Échec d'audit

Si un attaquant obtient le snapshot de la base :

| Donnée | Conséquence | Mitigation |
|---|---|---|
| `admin_users.password_hash` | brute-force argon2id ~ 1 hash/s par CPU sérieux ; mot de passe ≥ 12 caractères = des années | rotation immédiate du mot de passe |
| `webhook_endpoints.encrypted_secret` | inutilisable sans `WEBHOOK_SECRET_KEY` (variable env) | rotation `WEBHOOK_SECRET_KEY` + régénération de tous les secrets endpoints |
| `webhook_deliveries.payload` | contient potentiellement DCP en clair | rotation immédiate ; politique : pas de payload sensible (CB, mots de passe) |
| `leads.email`/`phone` | DCP exposées | notification CNDP + personnes concernées sous 72h (loi 09-08) |

## Tests

| Type | Fichier |
|---|---|
| Unit | `signing.test.ts`, `encrypt.test.ts`, `password.test.ts` |
| E2E | `e2e/security-headers.spec.ts` (vérifie HSTS, CSP, X-Frame-Options) |
