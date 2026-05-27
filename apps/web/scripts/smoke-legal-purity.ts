/**
 * LEGAL-V2 — Smoke test post-deploy.
 *
 * Vérifie :
 *  1. /legal/mentions-legales accessible + no ICE 15-digits + has legal email
 *  2. /api/admin/legal/cleanup-e2e répond 401 sans auth
 *  3. Marketing pages : no founder name leak
 *
 * Usage :
 *   pnpm tsx scripts/smoke-legal-purity.ts                # localhost:3000
 *   pnpm tsx scripts/smoke-legal-purity.ts --url <url>
 *
 * Cf. docs/pages-legales-fix-2026-05/05-tests/e2e-playwright.md
 */
import './_load-env.mjs';

interface SmokeResult { name: string; passed: boolean; latencyMs: number; details: string }

function parseArgs(argv: string[]): { baseUrl: string } {
  let baseUrl = 'http://localhost:3000';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') baseUrl = argv[++i]!;
  }
  return { baseUrl };
}

async function smokeMentionsLegales(baseUrl: string): Promise<SmokeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl}/legal/mentions-legales`);
    if (!res.ok) {
      return { name: 'mentions_legales', passed: false, latencyMs: Date.now() - t0, details: `status ${res.status}` };
    }
    const html = await res.text();
    const hasICE15 = /\b\d{15}\b/.test(html);
    const hasRCFormat = /RC\s*:\s*\w+-\d{4,}/.test(html);
    const hasLegalEmail = html.includes('legal@femiglow-maroc.com');
    return {
      name: 'mentions_legales',
      passed: !hasICE15 && !hasRCFormat && hasLegalEmail,
      latencyMs: Date.now() - t0,
      details: `ICE=${hasICE15 ? 'LEAK!' : 'OK'}, RC=${hasRCFormat ? 'LEAK!' : 'OK'}, legal_email=${hasLegalEmail ? 'OK' : 'MISSING'}`,
    };
  } catch (err) {
    return { name: 'mentions_legales', passed: false, latencyMs: Date.now() - t0, details: (err as Error).message };
  }
}

async function smokeCleanupAuth(baseUrl: string): Promise<SmokeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/admin/legal/cleanup-e2e`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dryRun: true, olderThanDays: 7 }),
    });
    return {
      name: 'cleanup_endpoint_auth',
      passed: res.status === 401 || res.status === 403,
      latencyMs: Date.now() - t0,
      details: `status ${res.status} (expected 401/403)`,
    };
  } catch (err) {
    return { name: 'cleanup_endpoint_auth', passed: false, latencyMs: Date.now() - t0, details: (err as Error).message };
  }
}

async function smokeAnonymMarketing(baseUrl: string): Promise<SmokeResult> {
  const t0 = Date.now();
  const pages = ['/', '/contact', '/maison', '/kit', '/rituel'];
  let leakFound: string | null = null;
  try {
    for (const p of pages) {
      const res = await fetch(`${baseUrl}${p}`);
      if (!res.ok) continue;
      const html = await res.text();
      if (/souhei[lï]a/i.test(html)) {
        leakFound = p;
        break;
      }
    }
    return {
      name: 'anonymization_marketing',
      passed: leakFound === null,
      latencyMs: Date.now() - t0,
      details: leakFound ? `LEAK on ${leakFound}!` : 'No founder name found on 5 marketing pages',
    };
  } catch (err) {
    return { name: 'anonymization_marketing', passed: false, latencyMs: Date.now() - t0, details: (err as Error).message };
  }
}

async function main(): Promise<void> {
  const { baseUrl } = parseArgs(process.argv.slice(2));
  console.log(`\n🔍 Smoke legal purity — ${baseUrl}\n`);
  console.log('Tests :');

  const results = await Promise.all([
    smokeMentionsLegales(baseUrl),
    smokeCleanupAuth(baseUrl),
    smokeAnonymMarketing(baseUrl),
  ]);

  console.log('─'.repeat(70));
  for (const r of results) {
    const status = r.passed ? '✅' : '❌';
    console.log(`  ${status} ${r.name.padEnd(28)} ${r.latencyMs.toString().padStart(5)}ms (${r.details})`);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log('─'.repeat(70));
  console.log(`\n📊 Résultat : ${passed}/${results.length} ✅, ${failed} ❌\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('❌ Smoke failed:', err); process.exit(1); });
