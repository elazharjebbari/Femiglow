# 30.1 — Google Ads server-side dispatch design

## Vue d'ensemble

Implémentation de `googleAdsAdapter.dispatch()` pour envoyer les conversions
serveur via l'API Google Ads (Enhanced Conversions).

## Endpoint cible

```
POST https://googleads.googleapis.com/v17/customers/{customer_id}:uploadClickConversions
Headers:
  Authorization: Bearer <access_token>
  developer-token: <GOOGLE_ADS_DEVELOPER_TOKEN>
  Content-Type: application/json
```

## Body request

```json
{
  "conversions": [
    {
      "gclid": "Cj0KCQjw...",
      "conversionAction": "customers/7082602195/conversionActions/AbCdEf123Abc",
      "conversionDateTime": "2026-05-13 12:00:00+00:00",
      "conversionValue": 199.0,
      "currencyCode": "MAD",
      "orderId": "o_abc123",
      "userIdentifiers": [
        {
          "hashedEmail": "5e88..."
        },
        {
          "hashedPhoneNumber": "a47b..."
        }
      ],
      "userAgent": "Mozilla/5.0...",
      "externalAttributionData": null
    }
  ],
  "partialFailure": true,
  "validateOnly": false
}
```

## Implémentation pseudo-code

```typescript
// lib/tracking/providers/google-ads.ts (refonte)

export const googleAdsAdapter: ProviderAdapter = {
  kind: 'google_ads',

  supports(eventName: string): boolean {
    return CONVERSION_EVENTS_WITH_GADS_CATEGORY.has(eventName);
  },

  async dispatch(provider, ctx): Promise<TrackingProviderResult> {
    if (provider.status !== 'enabled') return skip('provider_disabled');

    const config = provider.config as GoogleAdsConfig;
    if (!config.googleAdsCustomerId) return skip('missing_customer_id');

    const conversionAction = config.googleAdsConversionActions[ctx.eventName];
    if (!conversionAction) return skip('no_conversion_action_for_event');

    // 1. OAuth access token (refresh si expiré)
    const accessToken = await getAccessToken(provider);
    if (!accessToken) return skip('oauth_token_unavailable');

    // 2. Build user_data hashes (Enhanced Conversions)
    const userIdentifiers = buildUserIdentifiers(ctx);

    // 3. Build conversion payload
    const payload = {
      conversions: [{
        gclid: ctx.gclid || undefined,
        conversionAction: `customers/${config.googleAdsCustomerId}/conversionActions/${conversionAction.actionLabel}`,
        conversionDateTime: formatGoogleAdsDateTime(ctx.receivedAt),
        conversionValue: ctx.params.value ?? conversionAction.defaultValue,
        currencyCode: ctx.params.currency ?? conversionAction.defaultCurrency ?? 'MAD',
        orderId: ctx.params.orderId ?? ctx.eventId, // dédup
        userIdentifiers,
        userAgent: ctx.userAgent,
      }],
      partialFailure: true,
      validateOnly: false,
    };

    // 4. POST avec retry
    const result = await fetchWithRetry(
      `https://googleads.googleapis.com/v17/customers/${config.googleAdsCustomerId}:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      { maxAttempts: 3, baseDelayMs: 500 },
    );

    return {
      status: result.ok ? 'success' : 'failed',
      httpStatus: result.status,
      attempts: result.attempts,
      latencyMs: result.latencyMs,
      error: result.ok ? undefined : result.body.slice(0, 200),
    };
  },

  clientSnippet(provider) { /* existant — load gtag */ },
  cspHosts() { /* existant */ },
};
```

## OAuth refresh token

### Architecture

- L'admin Google Ads autorise FemiGlow via OAuth 2.0 (scope `adwords`)
- Refresh token stocké chiffré (AES-GCM) dans `tracking_providers.config.googleAdsOAuth`
- Access token cache en mémoire (10 min TTL) via `lru-cache`
- Refresh automatique si access token expiré

### Pseudo-code refresh

```typescript
async function getAccessToken(provider): Promise<string | null> {
  const cached = tokenCache.get(provider.id);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const oauth = provider.config.googleAdsOAuth;
  if (!oauth?.refreshToken) return null;

  const refreshToken = decryptAESGCM(oauth.refreshToken, oauth.iv, oauth.tag);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const accessToken = data.access_token;
  tokenCache.set(provider.id, {
    token: accessToken,
    expiresAt: Date.now() + (data.expires_in * 1000) - 60_000, // refresh 1min avant expiration
  });
  return accessToken;
}
```

## Enhanced Conversions user data hashing

```typescript
function buildUserIdentifiers(ctx: DispatchContext): Array<UserIdentifier> {
  const identifiers: UserIdentifier[] = [];

  if (ctx.params.email) {
    const normalized = ctx.params.email.toLowerCase().trim();
    identifiers.push({
      hashedEmail: sha256(normalized),
    });
  }

  if (ctx.params.phone) {
    // E.164 format requis : +212600000000
    const normalized = normalizePhoneE164(ctx.params.phone);
    if (normalized) {
      identifiers.push({
        hashedPhoneNumber: sha256(normalized),
      });
    }
  }

  if (ctx.params.firstName && ctx.params.lastName) {
    identifiers.push({
      addressInfo: {
        hashedFirstName: sha256(ctx.params.firstName.toLowerCase().trim()),
        hashedLastName: sha256(ctx.params.lastName.toLowerCase().trim()),
        countryCode: 'MA',
      },
    });
  }

  return identifiers;
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
```

## gclid capture

À capturer au landing :

```typescript
// middleware.ts (extension)
if (request.nextUrl.searchParams.has('gclid')) {
  const gclid = request.nextUrl.searchParams.get('gclid')!;
  res.cookies.set('_gclid', gclid, {
    maxAge: 90 * 24 * 60 * 60, // 90 jours (cookie window Google Ads)
    httpOnly: false, // accessible côté JS pour TrackingClient
    sameSite: 'lax',
  });
}
```

Et côté TrackingClient :
```typescript
const gclid = getCookie('_gclid');
client.setContext({ gclid });
// Inclus dans tous les events suivants jusqu'à expiration
```

## Quotas et rate-limits

Google Ads API limites :
- **Operations per day** : ~15000/jour pour comptes basic
- **QPS** : ~10 RPS recommandé

Stratégie :
- Batcher : 1 conversion par `dispatch()` call est OK (< 100/jour pour FemiGlow)
- Retry avec backoff exponentiel sur 429 / 5xx
- Circuit breaker : si > 10% errors en 5min → marquer provider en `error` status

## Tests

```typescript
describe('googleAdsAdapter.dispatch', () => {
  it('skips when status disabled', async () => {...});
  it('skips when no customer_id', async () => {...});
  it('skips when no conversion_action for event', async () => {...});
  it('posts to googleads.googleapis.com with valid payload', async () => {
    // Mock fetch, verify body shape
  });
  it('handles 401 (token expired) by refreshing token and retrying', async () => {...});
  it('handles 429 with exponential backoff', async () => {...});
  it('hashes email and phone correctly', async () => {
    expect(sha256('user@example.com')).toBe('expected-hash');
  });
});
```
