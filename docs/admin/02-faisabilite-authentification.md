# Étude de faisabilité — Authentification administrateur

> **Objet.** Permettre à un (ou très peu) d'administrateur(s) FemiGlow de se
> connecter à `/admin` pour consulter et opérer les leads. Évaluer trois
> approches techniques, les comparer, et émettre une recommandation finale.
> Ce n'est **pas** un plan d'action.

---

## 1. Contexte & contraintes

| Contrainte | Détail |
|---|---|
| Volume d'utilisateurs admin | 1 à 3 personnes (fondatrice + équipe proche) |
| Public | strictement privé, pas d'inscription publique |
| Cible déploiement | Vercel (serverless, pas de processus persistant) |
| Stack | Next.js 14 App Router, TypeScript strict, pas d'auth library installée |
| Cohabitation | les routes `/admin/*` et `/api/admin/*` doivent être protégées sans casser le marketing public |
| UX visée | login simple, déconnexion explicite, session longue (≥ 7 jours), retour focus à `/admin` après login |
| Sécurité minimale | hash de mot de passe (`argon2` ou `bcrypt`), cookies `httpOnly` + `secure` + `sameSite=lax`, CSRF protégé pour les mutations, rate limiting login |
| Conformité | RGPD-compatible (pas d'auth tiers stockant inutilement de PII) |

## 2. Approche A — *NextAuth.js (Auth.js v5)* avec Credentials Provider

### 2.1 Description

`NextAuth.js` (renommé Auth.js v5) est la library d'authentification de
référence pour Next.js. On utilise le **Credentials provider** — pas de OAuth
externe, juste un formulaire login/password. La session est gérée par un
**JWT signé** stocké dans un cookie `httpOnly`.

### 2.2 Schéma d'architecture

```
┌─────────────────┐        ┌──────────────────────────┐
│  /admin/login   │ POST → │ /api/auth/[...nextauth]  │
└─────────────────┘        │   credentials.authorize  │
                            │   ├─ vérifie hash pwd   │
                            │   └─ délivre JWT cookie │
                            └──────────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────────────┐
                            │ middleware.ts (matcher)  │
                            │   /admin/* → withAuth    │
                            │   /api/admin/* → withAuth│
                            └──────────────────────────┘
```

### 2.3 Implémentation type

```ts
// src/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { verify } from 'argon2';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 14 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize({ email, password }) {
        if (email !== process.env.ADMIN_EMAIL) return null;
        const ok = await verify(process.env.ADMIN_PASSWORD_HASH!, password);
        return ok ? { id: 'admin', email, role: 'admin' } : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) { if (user) token.role = user.role; return token; },
    session({ session, token }) { session.user.role = token.role; return session; },
  },
  pages: { signIn: '/admin/login' },
});
```

```ts
// src/middleware.ts
export { auth as middleware } from '@/auth';
export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
```

### 2.4 Forces

- **Standard de facto** dans l'écosystème Next.js — communauté large,
  documentation abondante, mises à jour suivies.
- **Évolutif** : si demain on veut ajouter Google SSO, GitHub, magic links,
  un simple ajout de provider suffit.
- **Sécurité par défaut** : protection CSRF intégrée, cookies `httpOnly`
  signés, rotation de tokens, anti-fixation de session.
- **Compatible Edge runtime** (middleware) → temps de réponse <50 ms pour
  vérifier la session.
- **Hooks `auth()` partout** : dans Server Components, route handlers,
  middleware. API unifiée.
- **Gratuit, open source**.

### 2.5 Faiblesses

- **Sur-ingénieuré pour 1 utilisateur** : NextAuth est conçu pour des cas
  multi-providers, multi-utilisateurs. Pour un compte unique en env vars,
  c'est lourd.
- **Surface d'attaque** : ajoute ~50 KB au bundle, des routes
  `/api/auth/*` exposées (CSRF, signin, signout, session). À auditer.
- **Configuration v5 encore en bêta** (Auth.js) — quelques cassures API
  entre v4 et v5 si on prend la dernière.
- **Migration vers une vraie DB d'utilisateurs** plus tard demande de
  reconfigurer (adapter Prisma/Drizzle).

### 2.6 Coût

- **Licence** : 0 €
- **Setup** : ~2-3 heures (install, config, page login, tests).
- **Maintenance** : faible, mais suivre les majors v4 → v5 → v6.

## 3. Approche B — *Clerk* (auth managée externe)

### 3.1 Description

Clerk est un service SaaS d'authentification clé en main : UI de login
hébergée (ou composants React drop-in), gestion utilisateurs, MFA, audit
logs, le tout via dashboard externe. On crée un compte admin dans le
dashboard Clerk, on copie deux clés en env, et on protège les routes avec
`<ClerkProvider>` + `clerkMiddleware()`.

### 3.2 Schéma d'architecture

```
┌─────────────────┐         ┌────────────────────┐
│  /admin/login   │ ←────── │   Clerk-hosted UI  │ (clerk.com)
│  (composant     │ session │   ou <SignIn />    │
│   React)        │ token   │   drop-in          │
└─────────────────┘         └────────────────────┘
        │
        ▼
┌──────────────────────────┐
│ middleware.ts            │
│   clerkMiddleware()      │
│   matcher /admin/*       │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│ Server Component:        │
│   const { userId } =     │
│     auth()               │
│   if (!userId) redirect  │
└──────────────────────────┘
```

### 3.3 Implémentation type

```ts
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
const isAdmin = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);
export default clerkMiddleware((auth, req) => {
  if (isAdmin(req)) auth().protect();
});
```

```tsx
// src/app/(admin)/admin/page.tsx
import { auth } from '@clerk/nextjs/server';
export default async function AdminHome() {
  const { sessionClaims } = auth();
  if (sessionClaims?.metadata?.role !== 'admin') notFound();
  return <Dashboard />;
}
```

### 3.4 Forces

- **Mise en route extrêmement rapide** : ~30 minutes du compte créé à la
  page protégée fonctionnelle.
- **MFA, magic link, sessions multi-device, audit logs** : disponibles dès
  le premier jour, sans code.
- **Dashboard Clerk** : gestion des utilisateurs sans toucher au code.
  Idéal si la fondatrice veut ajouter quelqu'un sans appeler le dev.
- **Sécurité opérationnelle externalisée** (rotation de clés, détection
  d'attaques, conformité SOC2).
- **Composants React polis** (`<SignIn />`, `<UserButton />`) — pas
  besoin de dessiner la page login.

### 3.5 Faiblesses

- **Dépendance vendor** : la marque s'appuie sur un service tiers payant.
  Fermeture, hausse de prix, ou panne Clerk = admin inaccessible.
- **PII chez un tiers américain** : les emails admin transitent et sont
  stockés chez Clerk (Delaware). RGPD impose un DPA, à formaliser.
- **Coût récurrent** : gratuit jusqu'à 10 000 MAU mais l'admin n'a que
  1-3 utilisateurs ; le plan gratuit suffit. Toutefois certains features
  (MFA forcé, branding custom, SLA) basculent à 25 $/mois et plus.
- **Look & feel** : les composants drop-in ont leur propre identité
  visuelle. Adapter au look FemiGlow demande du CSS custom — possible,
  mais on perd l'unité de la stack.
- **Latence supplémentaire** : appel à Clerk au login (~100-300 ms).
- **Surface réseau augmentée** : domaine `*.clerk.accounts.dev`,
  cookies tiers, scripts externes (CSP à élargir).

### 3.6 Coût

- **Licence** : 0 € jusqu'à 10 K MAU (largement suffisant) — passage
  potentiel à 25 $/mois si on veut MFA obligatoire ou branding sans
  watermark.
- **Setup** : ~30-60 minutes.
- **Maintenance** : très faible côté code ; dépendance externe à monitorer.

## 4. Approche C — *Auth maison léger* (`iron-session` + un compte unique)

### 4.1 Description

Pas de library d'auth « lourde ». On utilise `iron-session` (ou les
primitives `jose` pour signer un JWT) pour stocker une session dans un
cookie chiffré. Un seul compte admin déclaré en variables d'environnement
(`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` argon2). Pas d'utilisateurs en DB.

### 4.2 Schéma d'architecture

```
┌─────────────────┐        ┌──────────────────────────────┐
│  /admin/login   │ POST → │ /api/admin/login/route.ts    │
└─────────────────┘        │   ├─ verify argon2(password) │
                            │   ├─ rate-limit IP+email    │
                            │   ├─ session.set(...)       │
                            │   └─ Set-Cookie: signed     │
                            └──────────────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────────────────┐
                            │ middleware.ts                │
                            │   getSession(req)            │
                            │   if !session → redirect     │
                            └──────────────────────────────┘
```

### 4.3 Implémentation type

```ts
// src/lib/admin/session.ts
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export type AdminSession = { id: 'admin'; email: string; loginAt: number };

export const sessionOptions = {
  cookieName: 'femiglow.admin',
  password: process.env.ADMIN_SESSION_SECRET!, // ≥ 32 chars
  cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax' },
  ttl: 60 * 60 * 24 * 14,
};

export const getAdminSession = () =>
  getIronSession<AdminSession>(cookies(), sessionOptions);
```

```ts
// src/app/api/admin/login/route.ts
import { verify } from 'argon2';
export async function POST(req: Request) {
  const { email, password } = await req.json();
  await rateLimit(req); // simple, par IP
  if (email !== process.env.ADMIN_EMAIL) return reject();
  if (!await verify(process.env.ADMIN_PASSWORD_HASH!, password)) return reject();
  const session = await getAdminSession();
  session.id = 'admin'; session.email = email; session.loginAt = Date.now();
  await session.save();
  return Response.json({ ok: true });
}
```

### 4.4 Forces

- **Surface minimale** : ~150 lignes, pas de dépendances lourdes (iron-session
  pèse ~10 KB).
- **Aucun service tiers** : 100 % auto-hébergé, RGPD trivial.
- **Lisibilité totale** : la fondatrice peut ouvrir le code et tout
  comprendre en 10 minutes.
- **Coût zéro** (licence + service externe).
- **Audit facile** : on contrôle exactement ce qui se passe.
- **Pas de bundle JS additionnel** côté client (la page login est un
  formulaire vanilla).

### 4.5 Faiblesses

- **Pas évolutif** vers du multi-utilisateurs sans réécrire (il faudrait
  une table `users` et migrer la vérif).
- **Pas de MFA out-of-the-box** : à coder si besoin (TOTP avec `otpauth`).
- **Pas de magic link, pas d'OAuth** : tout est manuel.
- **On porte la responsabilité de la sécurité** : oubli d'un `httpOnly`,
  mauvaise rotation de secret, et c'est sur soi. Pas de revue
  communautaire d'experts comme NextAuth.
- **Pas d'audit logs** : à coder explicitement.
- **Rotation du mot de passe** = redéploiement (changement de variable
  env), sauf à mettre `ADMIN_PASSWORD_HASH` dans une DB plus tard.

### 4.6 Coût

- **Licence** : 0 €
- **Setup** : ~3-4 heures (login page + session + middleware + rate limit
  + tests).
- **Maintenance** : très faible si bien fait, à condition de surveiller
  les CVE de `iron-session` et `argon2`.

## 5. Tableau comparatif

| Critère | A — NextAuth | B — Clerk | C — iron-session |
|---|:---:|:---:|:---:|
| Temps d'installation | 2-3 h | 0,5-1 h | 3-4 h |
| Surface de code applicative | moyenne | très faible | moyenne |
| Surface de dépendances | moyenne | élevée (vendor) | très faible |
| Évolutivité multi-users | facile (provider DB) | trivial (UI dashboard) | nécessite refacto |
| MFA / magic link | possible (config) | inclus | à coder |
| Coût récurrent | 0 € | 0 € jusqu'à 10 K MAU, sinon 25 $/mois+ | 0 € |
| Dépendance vendor | non | **forte** | non |
| Sécurité par défaut | élevée | très élevée (SOC2) | dépend de la mise en œuvre |
| RGPD / souveraineté | bonne | DPA tiers US à signer | excellente (auto-hébergé) |
| Adaptabilité look & feel | totale | partielle (CSS sur composants) | totale |
| Audit logs | basique | inclus | à coder |
| Bundle client | +50 KB | +60 KB + scripts externes | ~0 KB |
| Latence login | locale | +100-300 ms (call externe) | locale |
| Cohérence avec stack | excellente | étrangère | excellente |
| Lisibilité pour le fondateur | moyenne | faible (boîte noire) | très bonne |

## 6. Lecture transversale

- **Si la marque devait grossir vite** vers 10+ comptes admin, des rôles
  multiples, du SSO d'entreprise → **B (Clerk)** ou **A (NextAuth)** seraient
  les bons choix. Mais ce n'est pas le cas FemiGlow.
- **Si la priorité est la simplicité, le contrôle, le coût zéro et la
  cohérence avec la voix « lente » de la marque** → **C (iron-session)** est
  le plus aligné.
- **Si l'on veut un compromis « standard mais simple »** → **A (NextAuth)**
  avec Credentials provider seul (pas d'OAuth) reste raisonnable.

## 7. Recommandation pour l'auth admin

> **Recommandée : C — Auth maison léger (`iron-session` + argon2 + un
> compte unique en env vars).**

**Justification synthétique :**

1. **L'usage est minimaliste** — 1 à 3 personnes, pas d'inscription
   publique. Toute library d'auth est, à ce volume, du sur-équipement.
2. **Souveraineté & RGPD** : aucune PII d'admin chez un tiers, aucun DPA
   externe à signer, conformité maximale.
3. **Cohérence avec la philosophie FemiGlow** : « beauté lente » se traduit
   en code par moins de dépendances, plus de lisibilité.
4. **Coût zéro** récurrent.
5. **Surface d'attaque minimale** : pas de routes auxiliaires
   (`/api/auth/signin`, `/api/auth/signout`, `/api/auth/csrf`, …) — juste
   `/api/admin/login` et `/api/admin/logout`.
6. **Lisibilité** : la fondatrice peut comprendre 100 % du code admin sans
   apprendre une library.

**Ce que cette recommandation implique d'accepter :**

- Pas de MFA dans la première version. Si nécessaire plus tard, ajouter
  TOTP via `otpauth` (~30 lignes).
- Si demain on veut ajouter un 4ᵉ admin avec son propre compte, refacto
  vers une mini-table `admins` (SQLite/Postgres) avec ~50 lignes de
  migration.
- Vigilance opérationnelle : rotation du `ADMIN_SESSION_SECRET` annuelle,
  rate limiting sur `/api/admin/login` impératif (sinon brute-force
  trivial).

> Le détail d'implémentation (rate limit, CSRF, page de login, tests) est
> hors scope de cette étude. Voir la **recommandation finale** consolidée
> dans `recommandation-finale.md`.
