/**
 * Smoke test attribution — synthétique end-to-end.
 *
 * Lance N sessions synthétiques via fetch() avec différents profils canal,
 * puis vérifie via /api/admin/debug/last-events que `traffic_source` est
 * correctement persisté pour chaque session.
 *
 * Usage :
 *   pnpm tsx scripts/smoke-attribution.ts                 # contre localhost:3000
 *   pnpm tsx scripts/smoke-attribution.ts --url https://femiglow-maroc.com
 *   pnpm tsx scripts/smoke-attribution.ts --admin-token=XXX
 *
 * Idéal :
 *   - En post-deploy comme gate (exit 1 si discrepancy)
 *   - En check 1×/h via cron pour détecter régression silencieuse
 *   - En CI sur staging avant mege master
 *
 * Référence : `docs/attribution-fix-2026-05/05-runbook-rollout.md`.
 */
import './_load-env.mjs';

interface Scenario {
  name: string;
  qs: string;
  expectedBucket: string;
  description: string;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'meta_paid',
    qs: 'utm_source=meta&utm_medium=cpc&utm_campaign=smoke&fbclid=SMOKE_FB',
    expectedBucket: 'paid_social',
    description: 'Meta Ads — UTM cpc + fbclid',
  },
  {
    name: 'google_paid',
    qs: 'gclid=SMOKE_GCLID',
    expectedBucket: 'paid_search',
    description: 'Google Ads — gclid uniquement',
  },
  {
    name: 'tiktok_paid',
    qs: 'utm_source=tiktok&utm_medium=cpc&ttclid=SMOKE_TT',
    expectedBucket: 'paid_social',
    description: 'TikTok Ads — UTM + ttclid',
  },
  {
    name: 'email',
    qs: 'utm_source=klaviyo&utm_medium=email&utm_campaign=weekly',
    expectedBucket: 'email',
    description: 'Newsletter Klaviyo — UTM email',
  },
  {
    name: 'direct',
    qs: '',
    expectedBucket: 'direct',
    description: 'Aucun signal — fallback direct',
  },
];

interface SmokeResult {
  scenario: string;
  expected: string;
  observed: string | null;
  passed: boolean;
  latencyMs: number;
}

interface CliOptions {
  baseUrl: string;
  adminCookie?: string;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    baseUrl: 'http://localhost:3000',
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') opts.baseUrl = argv[++i]!;
    else if (a === '--admin-cookie') opts.adminCookie = argv[++i]!;
    else if (a === '--verbose' || a === '-v') opts.verbose = true;
  }
  return opts;
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Simule une visite avec les query params + un POST direct /api/track.
 * Plus rapide qu'un vrai Playwright pour un smoke check.
 */
async function runScenario(
  scenario: Scenario,
  baseUrl: string,
  adminCookie: string | undefined,
  verbose: boolean,
): Promise<SmokeResult> {
  const start = Date.now();
  const sessionId = randomId('smoke_sess');
  const anonId = randomId('smoke_anon');

  // 1. Simuler le hit landing (middleware capture les click IDs + UTM)
  const landingUrl = `${baseUrl}/kit${scenario.qs ? '?' + scenario.qs : ''}`;
  let landingCookies = '';
  try {
    const landing = await fetch(landingUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'user-agent': 'FemiGlow-SmokeAttribution/1.0',
      },
    });
    // Extract Set-Cookie headers — middleware doit set _fg_* cookies
    const rawSetCookie = landing.headers.get('set-cookie') ?? '';
    landingCookies = rawSetCookie.split(',').map((c) => c.split(';')[0]).join('; ');
    if (verbose) console.log(`  [${scenario.name}] landing cookies: ${landingCookies}`);
  } catch (err) {
    return {
      scenario: scenario.name,
      expected: scenario.expectedBucket,
      observed: null,
      passed: false,
      latencyMs: Date.now() - start,
    };
  }

  // 2. POST /api/track avec une page_view qui inclut le hint attribution
  const trackPayload = {
    events: [
      {
        event_id: randomId('evt'),
        event: 'page_view',
        timestamp: new Date().toISOString(),
        page: {
          url: landingUrl,
          path: '/kit',
          referrer: '',
          locale: 'fr-MA',
        },
        user: {
          anonymous_id: anonId,
          session_id: sessionId,
        },
        consent: {
          ad_storage: 'granted',
          analytics_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
          functional_storage: 'granted',
        },
        schema_version: 1,
        params: {},
      },
    ],
  };
  try {
    await fetch(`${baseUrl}/api/track`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: landingCookies,
      },
      body: JSON.stringify(trackPayload),
    });
  } catch (err) {
    return {
      scenario: scenario.name,
      expected: scenario.expectedBucket,
      observed: null,
      passed: false,
      latencyMs: Date.now() - start,
    };
  }

  // 3. Wait pour la persistance
  await new Promise((r) => setTimeout(r, 500));

  // 4. GET /api/admin/debug/last-events
  let observed: string | null = null;
  try {
    const debugRes = await fetch(
      `${baseUrl}/api/admin/debug/last-events?sessionId=${sessionId}&limit=1`,
      {
        headers: adminCookie ? { cookie: adminCookie } : undefined,
      },
    );
    if (debugRes.ok) {
      const events = (await debugRes.json()) as Array<{ trafficSource: string }>;
      observed = events[0]?.trafficSource ?? null;
    } else if (verbose) {
      console.log(`  [${scenario.name}] debug API returned ${debugRes.status}`);
    }
  } catch {
    /* swallow */
  }

  return {
    scenario: scenario.name,
    expected: scenario.expectedBucket,
    observed,
    passed: observed === scenario.expectedBucket,
    latencyMs: Date.now() - start,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(`\n🔥 Smoke attribution — ${args.baseUrl}\n`);
  console.log(`Scenarios à tester : ${SCENARIOS.length}`);
  console.log('─'.repeat(60));

  const results: SmokeResult[] = [];
  for (const sc of SCENARIOS) {
    process.stdout.write(`  ${sc.name.padEnd(15)} → `);
    const r = await runScenario(sc, args.baseUrl, args.adminCookie, args.verbose);
    results.push(r);
    if (r.passed) {
      console.log(`✅ ${r.observed} (${r.latencyMs}ms)`);
    } else {
      console.log(`❌ expected=${r.expected}, observed=${r.observed ?? 'NULL'} (${r.latencyMs}ms)`);
    }
  }

  console.log('─'.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n📊 Résultat final : ${passed}/${results.length} ✅, ${failed} ❌\n`);

  if (failed > 0) {
    console.log('💡 Causes possibles :');
    console.log('  - NEXT_PUBLIC_ATTRIBUTION_V2 != true → flag non activé');
    console.log('  - Admin auth manquante → debug endpoint retourne 403');
    console.log('  - Middleware capture cookies cassée → signals absents');
    console.log('  - DB pas accessible → logEvent throw\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Smoke failed:', err);
  process.exit(1);
});
