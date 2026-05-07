# Flow d'authentification

## Stack

| Couche | Technologie |
|---|---|
| Hash de mot de passe | argon2id (`@node-rs/argon2`) |
| Session | iron-session (cookie chiffré stateless) |
| Cookie | `femiglow.admin.session` |
| Stockage user | table `admin_users` (Postgres) |
| Brute-force protection | table `admin_login_attempts` (Postgres) |

## Configuration iron-session

```ts
// apps/web/src/lib/auth/session.ts
import type { SessionOptions } from 'iron-session';

export interface AdminSession {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  loggedInAt?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.ADMIN_SESSION_PASSWORD!, // ≥ 32 char
  cookieName: 'femiglow.admin.session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8h
    path: '/',
  },
};
```

## Paramètres argon2id

```ts
import { hash, verify, Algorithm } from '@node-rs/argon2';

export const ARGON2_PARAMS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,   // 19 MiB (OWASP 2024)
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;
```

## Endpoint POST `/api/admin/login`

```ts
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const body = await req.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return formatError('validation_failed', parsed.error);

  const { email, password } = parsed.data;

  // Étape 1 : rate-limit (par IP + par email)
  if (await isRateLimited(ip, email)) {
    return formatError('rate_limited');
  }

  // Étape 2 : lookup user
  const user = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.email, email.toLowerCase()),
  });
  if (!user || user.deletedAt) {
    await recordFailedAttempt(ip, email);
    return formatError('unauthorized');
  }

  // Étape 3 : verify password (timing-safe via argon2)
  const ok = await verify(user.passwordHash, password);
  if (!ok) {
    await recordFailedAttempt(ip, email);
    return formatError('unauthorized');
  }

  // Étape 4 : créer session
  const session = await getIronSession<AdminSession>(req, res, sessionOptions);
  session.user = { id: user.id, email: user.email, name: user.name };
  session.loggedInAt = new Date().toISOString();
  await session.save();

  // Étape 5 : audit
  await logAuditEvent({
    actor: user.id,
    action: 'admin.login',
    ip,
    userAgent: req.headers.get('user-agent') ?? null,
  });

  return Response.json({ ok: true, redirect: '/admin/dashboard' });
}
```

## Endpoint POST `/api/admin/logout`

```ts
export async function POST(req: NextRequest) {
  const session = await getIronSession<AdminSession>(req, res, sessionOptions);
  const userId = session.user?.id;
  session.destroy();
  if (userId) {
    await logAuditEvent({ actor: userId, action: 'admin.logout' });
  }
  return Response.json({ ok: true });
}
```

## Helper `requireAdmin()`

```ts
// apps/web/src/lib/auth/require-admin.ts
export async function requireAdmin() {
  const session = await getServerSession();
  if (!session.user) {
    throw new HttpError('unauthorized', 401);
  }
  return session.user;
}
```

À utiliser au début de **chaque** route handler admin.

## Brute-force protection

| Aspect | Valeur |
|---|---|
| Fenêtre | 15 minutes |
| Seuil par IP | 5 échecs |
| Seuil par email | 5 échecs |
| Action | retour 429 + `Retry-After` header |
| Stockage | table `admin_login_attempts` |
| Nettoyage | tâche cron quotidienne purge > 24h |

```ts
async function isRateLimited(ip: string, email: string): Promise<boolean> {
  const since = sql`NOW() - INTERVAL '15 minutes'`;

  const [{ count: ipCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminLoginAttempts)
    .where(and(eq(adminLoginAttempts.ip, ip), gt(adminLoginAttempts.createdAt, since)));

  const [{ count: emailCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminLoginAttempts)
    .where(and(eq(adminLoginAttempts.email, email), gt(adminLoginAttempts.createdAt, since)));

  return ipCount >= 5 || emailCount >= 5;
}
```

## Création initiale du compte admin

V1 : aucun endpoint d'inscription. Le compte fondatrice est seedé par
script `scripts/create-admin.ts` exécuté manuellement avec :

```bash
ADMIN_EMAIL=fondatrice@femiglow.ma \
ADMIN_PASSWORD=$(openssl rand -base64 24) \
pnpm tsx scripts/create-admin.ts
```

Le mot de passe est imprimé une seule fois sur stdout, jamais stocké.

## Rotation du mot de passe

V1 : pas d'UI. Procédure documentée dans
[`../07-securite/incident-response.md`](../07-securite/incident-response.md#rotation-du-mot-de-passe-admin).

## Diagramme de séquence

Voir [`../01-architecture/flux-authentification.puml`](../01-architecture/flux-authentification.puml).

## Tests

| Type | Fichier |
|---|---|
| Unit | `password.test.ts`, `rate-limit.test.ts`, `require-admin.test.ts` |
| MSW | `scenario-login-success.md`, `scenario-login-failure.md`, `scenario-login-rate-limit.md`, `scenario-session-expired.md` |
| E2E | `e2e/login.spec.ts`, `e2e/logout.spec.ts`, `e2e/session-timeout.spec.ts` |
