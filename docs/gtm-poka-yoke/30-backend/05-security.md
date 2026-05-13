# Sécurité — Backend Poka-Yoke

## Modèle de menace

| Menace | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Spam de pings (DoS) | Moyenne | Faible (DB write only) | Rate limit 60/min/IP + index DB |
| Pings forgés depuis tiers | Faible | Faible (faux positifs UI seulement) | CORS strict, pas de modèle de confiance |
| Injection SQL via payload | Très faible | Élevé si exploit | Drizzle parametrized + Zod strict |
| Exfiltration de PII via pings | Faible | Critique (RGPD) | Zod whitelist, pas de champs PII acceptés |
| Endpoint admin accédé sans auth | Faible | Critique (data leak) | `requireAdmin` sur chaque route |

## CORS

```ts
// apps/web/src/app/api/track/sentinel/route.ts (extrait)
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_BASE_URL,   // ex: https://femiglow.ma
  process.env.NEXT_PUBLIC_DEV_BASE_URL, // dev
].filter(Boolean);

function checkOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;  // POST direct sans browser → refuse
  return ALLOWED_ORIGINS.includes(origin);
}
```

## Rate limit

Utilise le système existant `lib/rate-limit/check.ts` :

```ts
const rate = await checkRateLimit({
  key: `gtm-sentinel:${ip}`,
  limit: 60,
  windowMs: 60 * 1000,
});
if (!rate.ok) return new Response(null, { status: 429 });
```

## Anonymisation

```ts
// Tout payload est anonymisé avant insert
const uaHash = hashIp(request.headers.get('user-agent') ?? '');
const ipHash = hashIp(getClientIp(request));
// Aucune URL stockée en clair (juste hash)
const pageUrlHash = payload.pageUrl ? hashIp(payload.pageUrl) : null;
```

`hashIp` est SHA-1 avec salt env (`HASH_SALT`).

## Validation strict Zod

```ts
// Rejette tout payload qui contient un champ supplémentaire
const SentinelPingInputSchema = z.object({
  bundleId: z.string().regex(/^[a-f0-9]{12}$/),
  // ... (cf. data-model.md)
}).strict();  // ← refuse les champs non listés
```

## Headers de sécurité

Toutes les routes admin :
- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: same-origin`

Route publique `/api/track/sentinel` :
- `Cache-Control: no-store`
- Réponse `204 No Content` (pas de body = pas de surface d'exploit)

## Audit

Chaque modif via API admin est loggée :
- `validate-pair` → log structuré `{actorId, configBundleId, mappingBundleId, ok}`
- Pas besoin d'audit pour `sync-status` (lecture seule)
