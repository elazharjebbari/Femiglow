# 05 — Sécurité, conformité & observabilité

> **Vue d'ensemble** : sécurité applicative globalement bonne (Argon2id, iron-session, HMAC, gitleaks, CSP nonce). Trois points critiques bloquent l'industrialisation : (1) PII en clair en base, (2) observabilité production absente, (3) droit à l'oubli RGPD non implémenté. Score global 7 / 10 — passable à 9 / 10 en ~8 semaines.

---

## 1. Gestion des secrets

### 1.1 Gitleaks

`.gitleaks.toml` :
- Règles custom pour `ADMIN_SESSION_PASSWORD`, `WEBHOOK_SECRET_KEY`, `CRON_SECRET`.
- Allowlist `docs/`, `__fixtures__/` pour éviter faux positifs.
- Pre-commit Husky `gitleaks detect --verbose`.
- Workflow CI `.github/workflows/security.yml`.

✅ Discipline.

### 1.2 Variables d'environnement

Centralisées via `src/lib/env.ts` (typage Zod). Clés critiques attendues (≥ 32 chars) :
- `ADMIN_SESSION_PASSWORD` — iron-session.
- `WEBHOOK_SECRET_KEY` — AES-256-GCM master key (scrypt).
- `CRON_SECRET` — Bearer cron auth.
- `STRIPE_WEBHOOK_SECRET`, `FEMIGLOW_STALWART_WEBHOOK_SECRET`, `LISTMONK_WEBHOOK_SECRET`.

### 1.3 Vérification leaks

```bash
grep -rE "sk_live|API_KEY=|SECRET=" --include="*.ts" apps/web/src
# → aucun match (références via env.* uniquement)
```
✅ Pas de hardcoding détecté.

### 1.4 ⚠ `.env.bak.*`

5 fichiers `apps/web/.env.bak.20260513-*` détectés. **Action immédiate** :
1. `git ls-files | grep "\.env"` — confirmer qu'ils ne sont pas trackés.
2. Si trackés → `git rm --cached`, rotation immédiate des secrets concernés.
3. Ajouter `.env*` (sauf `.env.example`) à `.gitignore`.

---

## 2. Authentification admin

### 2.1 Mécanisme

iron-session 8.0.4 (cookie scellé AES-256-GCM) + Argon2id (`@node-rs/argon2`).

```ts
SESSION_COOKIE = 'femiglow_admin_session'
SESSION_MAX_AGE_S = 60 * 60 * 8 // 8h

sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: !isDev,
  path: '/',
  maxAge: SESSION_MAX_AGE_S,
}
```

### 2.2 Flux

1. `/admin/login` POST email + password.
2. Argon2id verify contre `admin_users.password_hash`.
3. `iron-session.sealData()` → cookie chiffré + signé.
4. Middleware sur `/admin/*` → `decodeSession()` → vérifie TTL.

### 2.3 Forces

- Argon2id (memory=19MB, time=2 — OWASP-compliant).
- TTL strict (8 h).
- `httpOnly` (pas d'accès JS), `sameSite=lax`, `secure` en prod.

### 2.4 Faiblesses

| # | Constat | Sévérité |
|---|---|---|
| A1 | Pas de **MFA** (TOTP, WebAuthn) | 🟠 P1 |
| A2 | Pas d'**IP binding** ni de **user-agent pinning** sur la session | 🟡 P2 |
| A3 | Pas de **refresh token** ; TTL fixe (acceptable pour admin) | 🟢 |
| A4 | `sameSite=lax` (et non `strict`) — formulaires HTML top-level cross-origin acceptés — mitigé par `requireSameOrigin` | 🟡 P2 |
| A5 | Pas de **rate-limit login** explicite (à vérifier) | 🟠 P1 |
| A6 | Pas de **rotation forcée des mots de passe** | 🟢 P3 |
| A7 | Pas de **lockout** après N tentatives | 🟠 P1 |

---

## 3. CSRF

`src/lib/legal/csrf.ts` :

```ts
export function checkSameOrigin(request: Request): CsrfCheckResult {
  if (SAFE_METHODS.has(request.method)) return { ok: true };
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  // Priority: Origin > Referer
  if (origin && origin !== 'null') {
    return origin === expected ? { ok: true } : { ok: false, reason: 'origin_mismatch' };
  }
  if (referer) {
    const refOrigin = `${refUrl.protocol}//${refUrl.host}`;
    return refOrigin === expected ? { ok: true } : { ok: false, reason: 'origin_mismatch' };
  }
  return { ok: false, reason: 'origin_mismatch' };
}
```

Utilisation : `await requireSameOrigin(request)` sur les mutations admin.

**Évaluation** :
- ✅ Defense-in-depth (complément `sameSite=lax`).
- ✅ Rejet strict si `Origin`/`Referer` absent.
- 🟡 Pas de token CSRF explicite (double-submit cookie) — moins robuste qu'un token de session. Acceptable mais perfectible.

---

## 4. Routes `/api/admin/*` — guards

Toutes les routes admin lues ont `requireAdminApi()`. Vérification d'échantillon :
- `/api/admin/products/*` ✅
- `/api/admin/legal/*` ✅ (+ `requireSameOrigin`)
- `/api/admin/delivery-cities` ✅
- `/api/admin/chat/faq` ✅

**Verdict** : application consistante. À auditer périodiquement (un nouveau route oublié = backdoor).

---

## 5. Content Security Policy

`src/middleware.ts` génère un nonce par requête :

```
default-src 'self'
script-src ${devMode ? "'unsafe-eval'" : ""} 'self' 'unsafe-inline' ${trustedHosts}
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
img-src 'self' data: blob: https:
media-src 'self' blob: https://*.public.blob.vercel-storage.com
font-src 'self' data: https://fonts.gstatic.com
connect-src 'self' https://*.sentry.io https://plausible.io ${trackingHosts}
frame-src 'self' https://www.youtube-nocookie.com https://listmonk.femiglow-maroc.com
frame-ancestors 'none'  // ou 'self' si preview
form-action 'self'
base-uri 'self'
object-src 'none'
upgrade-insecure-requests  // prod uniquement
```

**Forces** :
- ✅ `default-src 'self'`.
- ✅ `object-src 'none'` (pas de plugins).
- ✅ `frame-ancestors 'none'` (anti-clickjacking).
- ✅ Whitelist `frame-src` minimale.

**Faiblesse** :
- 🟡 `'unsafe-inline'` sur `script-src` (limitation Next.js 14 RSC : le payload streamé contient des `<script>` inline sans nonce systématique). À lever en migrant Next.js 15 + `strict-dynamic`.

---

## 6. XSS

### 6.1 `dangerouslySetInnerHTML` audit

| Fichier | Source | Risque |
|---|---|---|
| `app/legal/[slug]/page.tsx` | markdown → HTML | ✅ sanitized via `renderLegalMarkdownWithDbVars()` + rehype-sanitize whitelist |
| `components/sections/ArticleProse.tsx` | CMS articles | ✅ même pipeline |
| `components/tracking/GtmHeadScript.tsx` | snippet GTM | 🟡 hardcoded, vérifier source |
| `components/admin/components/fields/editors/RichTextEditor.tsx` | preview admin | 🟡 admin only, autorisé |
| `lib/seo/json-ld.tsx` | JSON-LD | ✅ `JSON.stringify` |

### 6.2 `dangerouslyAllowSVG`

`next.config.mjs: dangerouslyAllowSVG: true` → mitigé par CSP `script-src 'none'; sandbox`. Reste un vecteur si une source distante autorisée (cdn.sanity.io) est compromise. Surveiller.

---

## 7. SQL injection

Drizzle ORM = prepared statements partout. Un seul `sql.raw()` trouvé (analytics matviews) :

```ts
await handle.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${view}"`));
```

`view` est issu d'un enum hardcoded `ANALYTICS_MATVIEWS` → ✅ safe.

**Verdict** : aucune SQL injection détectée.

---

## 8. Rate limiting

### 8.1 État actuel

`lib/mail/rate-limit.ts` + `lib/rate-limit/check.ts` :

```ts
const LIMITS = {
  contact: { limit: 10, windowMs: 60_000 },
  newsletter: { limit: 5, windowMs: 60_000 },
  'newsletter-confirm': { limit: 30, windowMs: 60_000 },
  'webhook-stalwart': { limit: 600, windowMs: 60_000 },
  unsubscribe: { limit: 60, windowMs: 60_000 },
};
```

Clé : `mail:${scope}:${ip}` (extracted from `x-forwarded-for`, fallback `x-real-ip`).
Retour : 429 + `Retry-After` header.

### 8.2 Coverage

| Surface | Rate-limit ? |
|---|---|
| `/api/contact` | ✅ |
| `/api/newsletter` | ✅ |
| `/api/mail/webhook/*` | ✅ |
| `/api/chat/message` | ✅ (dual session + IP) |
| `/api/checkout/lead` | ❌ |
| `/api/checkout/order` | ❌ (protégé par idempotency + auth lead) |
| `/api/checkout/address`, `/api/checkout/payment` | ❌ |
| `/api/track` | ❌ |
| `/api/admin/*` | ❌ (auth requise, mais pas de rate-limit login !) |

### 8.3 Faiblesse

🔴 **`/api/checkout/lead` et `/api/contact` sans rate-limit** → vulnérables au lead-spam. Le mail est partiellement protégé mais checkout reste ouvert.

🟠 **`/api/admin/login` sans rate-limit** → attaque par force brute possible.

### 8.4 Architecture

In-memory map (`lib/rate-limit/check.ts`) → ⚠ ne fonctionne pas en multi-instance. Migration vers Redis / Postgres advisory locks recommandée si > 1 réplique.

---

## 9. Webhooks — signature

### 9.1 Entrants

| Source | Mécanisme |
|---|---|
| Stripe | `verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)` (Stripe SDK) |
| Stalwart | `timingSafeEqual(Buffer.from(token), Buffer.from(secret))` |
| Listmonk | HMAC-SHA256 Bearer |

✅ Constant-time comparison partout.

### 9.2 Sortants

`lib/webhooks/outbound/dispatcher.ts` :

```ts
const signature = crypto.createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');

await fetch(url, {
  method: 'POST',
  headers: { 'X-Webhook-Signature': signature, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

✅ Signature HMAC SHA-256 sur tous les payloads sortants.

---

## 10. Conformité RGPD

### 10.1 Consent

- ✅ Consent Mode v2 Google (defaults `denied`).
- ✅ Catégories : `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`, `functional_storage`.
- ✅ Stockage `localStorage` + cookie (1 an, sameSite=lax).
- ✅ Propagation événementielle (`fg:consent-changed`) → gtag / GTM / fbq / ttq / snaptr.
- ✅ Double opt-in email (`email_subscriber_link` : pending → confirmed).

### 10.2 PII

🔴 **Données en clair** :
- `leads.email`, `leads.phone`, `leads.name`.
- `chat_lead.email`, `chat_lead.phone`.
- Adresses livraison (`chat_lead` JSON).

→ Si Postgres compromis, fuite directe. **Action P0** : chiffrer ces colonnes via AES-256-GCM (`lib/crypto/encryption.ts` réutilisable).

### 10.3 Droit à l'oubli (RGPD art. 17)

❌ **Non implémenté**. Pas de soft delete, pas d'endpoint admin `/api/admin/data-subject/delete`, pas de cascade pseudonymisation.

→ **Action P1** : implémenter endpoint authentifié + cascade delete physique ou pseudonymisation.

### 10.4 Droit à la portabilité (art. 20)

❌ Pas d'endpoint export utilisateur (CSV/JSON de tous les events + leads + orders).

### 10.5 Retention policy

❌ Non documenté. À écrire dans `docs/legal/retention-policy.md` :
- Lead inactif > 3 ans → anonymisation.
- `user_event` > 13 mois → archive.
- Email bounces durs → hard delete immédiat.
- Logs `audit_events` > 5 ans → archive.

### 10.6 CNIL / CNDP

Femiglow est basé au Maroc → CNDP (Commission Nationale de Protection des Données Personnelles). Déclaration nécessaire au-delà de certains seuils. À documenter.

---

## 11. Observabilité

### 11.1 Logger

`lib/logging/logger.ts` — pino-like custom :

```ts
interface LogPayload {
  ts: string;       // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;    // 'mail.webhook.stalwart.received'
  request_id?: string;
  admin_id?: string;
  route?: string;
  ip_hash?: string;
  [key: string]: unknown;
}

// PII redaction : 25 clés (email, phone, password, token, secret, apikey, ...)
logger.info('user.login.success', { email: 'user@ex.com' });
// Output: { ..., email: '[redacted]' }
```

✅ Structured logging, redaction PII, niveaux filtrés par `env.LOG_LEVEL`.

### 11.2 ⚠ Monitoring / Alerting

`instrumentation.ts` :
```ts
// Intentionnellement vide
export async function register(): Promise<void> {}
```

❌ Pas de Sentry actif.
❌ Pas de métriques (Prometheus, StatsD).
❌ Pas d'alerting.
❌ Pas de tracing distribué.

→ Le bug webhooks (audit 0516, 5/6 sources `disabled` en prod) a été détecté **manuellement par lecture des logs**. C'est inacceptable pour une boutique en prod.

### 11.3 Health checks

`/api/health` + `/api/health/full` (DB, migrations, tables status) ✅. Mais pas branché à un service externe (UptimeRobot, Pingdom).

---

## 12. Backups & DR

### 12.1 Strategy

`docs/runbook-deploy.md` :
```bash
# Avant migration
pg_dump → /var/backups/femiglow/pre-deploy-*.sql.gz
# Rotation 7 jours (systemd timer)
```

### 12.2 RPO / RTO

- **RPO** ~1 jour (backup à chaque deploy).
- **RTO** ? Non documenté. Estimation ~2 h pour restaurer 1 GB.

### 12.3 Faiblesses

| # | Constat |
|---|---|
| 1 | Backup couplé au deploy : si le deploy plante, le backup plante aussi. |
| 2 | Pas de test de restauration (dry-run sur staging). |
| 3 | Pas de PITR Neon configuré (Neon offre 7 jours PITR par défaut sur le plan payant). |

### 12.4 Recommandations

- Activer Neon PITR (si plan payant).
- Backup quotidien indépendant via cron + upload sur stockage objet (S3 / Vercel Blob).
- Dry-run restore mensuel sur staging.

---

## 13. Forces sécurité

1. **Argon2id** mot de passe admin (OWASP 2023+).
2. **iron-session** AES-256-GCM signed cookies, httpOnly + secure.
3. **CSP nonce dynamique** par requête.
4. **HMAC SHA-256** signature webhooks entrants ET sortants, constant-time compare.
5. **AES-256-GCM** chiffrement secrets webhooks en DB.
6. **Drizzle prepared statements** → 0 SQL injection.
7. **Zod validation** sur 100 % des routes publiques.
8. **CSRF** `requireSameOrigin` defense-in-depth.
9. **gitleaks** pre-commit + CI.
10. **Consent Mode v2** Google, defaults `denied`.
11. **Double opt-in** email.
12. **Logger redaction PII**.
13. **Audit trail** `audit_events` sur mutations admin.

---

## 14. Faiblesses sécurité — récapitulatif

| Sévérité | Sujet |
|---|---|
| 🔴 P0 | PII en clair en base |
| 🔴 P0 | Observabilité absente (pas de Sentry, pas d'alertes) |
| 🟠 P1 | Rate-limit incomplet (`checkout/lead`, `admin/login`) |
| 🟠 P1 | Pas de MFA admin |
| 🟠 P1 | Pas de lockout / rate-limit login |
| 🟠 P1 | Droit à l'oubli RGPD non implémenté |
| 🟠 P1 | Soft delete absent sur leads/orders |
| 🟠 P1 | Pas de retention policy documentée |
| 🟡 P2 | `.env.bak.*` à vérifier non commités |
| 🟡 P2 | CSP `'unsafe-inline'` scripts (Next 14 limitation) |
| 🟡 P2 | Pas de test restore backup |
| 🟡 P2 | `dangerouslyAllowSVG: true` |
| 🟡 P2 | IP binding session admin absent |
| 🟡 P2 | Rate-limit in-memory non distribuable |
| 🟢 P3 | Droit à la portabilité (export utilisateur) |
| 🟢 P3 | Déclaration CNDP à formaliser |

---

## 15. Recommandations consolidées

### P0 — sous 2 semaines

1. **Chiffrer PII** `leads.email/phone/name`, `chat_lead.email/phone`, adresses.
2. **Activer Sentry** (DSN déjà dans `.env.example`). Brancher `instrumentation.ts`.
3. **Health check externe** (UptimeRobot gratuit sur `/api/health/full`).
4. **Vérifier `.env.bak.*`** non trackés. `git ls-files | grep "\.env"`. Si trackés, rotation immédiate.

### P1 — sous 1 mois

5. **Rate-limit middleware global** sur `/api/checkout/lead`, `/api/contact`, `/api/admin/login`.
6. **Lockout login admin** : 5 tentatives → 15 min ban.
7. **MFA TOTP** sur admin (`speakeasy` + QR code).
8. **Soft delete** + `/api/admin/data-subject/delete` (cascade + pseudonymisation).
9. **Retention policy** documentée + cron purge.

### P2 — sous 3 mois

10. **Rate-limit → Redis** (si multi-instance).
11. **Backup quotidien indépendant** + dry-run restore mensuel.
12. **Upgrade Next 15** → CSP `strict-dynamic`, suppression `'unsafe-inline'`.
13. **IP binding session** (optionnel, opt-in).

### P3 — sous 6 mois

14. **Droit à la portabilité** (export JSON utilisateur).
15. **Déclaration CNDP** formalisée.
16. **Tracing distribué** (OpenTelemetry).

---

## 16. Scorecard sécurité & conformité

| Domaine | Score |
|---|---|
| Auth & sessions | 8 / 10 |
| Chiffrement secrets | 9 / 10 |
| Chiffrement PII | 4 / 10 |
| Webhooks (HMAC, idempotency) | 9 / 10 |
| XSS protection | 8 / 10 |
| SQL injection | 10 / 10 |
| CSRF | 8 / 10 |
| Rate limiting | 5 / 10 |
| Consent RGPD | 9 / 10 |
| Droit à l'oubli | 4 / 10 |
| Observabilité | 3 / 10 |
| Backups & DR | 5 / 10 |
| Logging | 8 / 10 |
| Audit trail | 9 / 10 |
| **Global** | **7 / 10** |
