/**
 * CHA-LEAD-V2 — Smoke test post-deploy chat purity.
 *
 * Vérifie en quelques secondes que :
 *  1. POST /api/checkout/lead crée bien un ghost s_*
 *  2. /api/admin/chat/audit-pollution répond avec les distributions
 *  3. /api/admin/chat/cleanup-ghosts dryRun marche (si cookie admin fourni)
 *
 * Usage :
 *   pnpm tsx scripts/smoke-chat-purity.ts                    # localhost:3000
 *   pnpm tsx scripts/smoke-chat-purity.ts --url <url>
 *   pnpm tsx scripts/smoke-chat-purity.ts --url <url> --admin-cookie '<cookie>'
 *
 * Exit code 0 si tout passe, 1 sinon.
 */
import './_load-env.mjs';

interface SmokeResult {
  name: string;
  passed: boolean;
  latencyMs: number;
  details?: string;
}

interface CliOptions {
  baseUrl: string;
  verbose: boolean;
  adminCookie?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { baseUrl: 'http://localhost:3000', verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') opts.baseUrl = argv[++i]!;
    else if (a === '--admin-cookie') opts.adminCookie = argv[++i]!;
    else if (a === '--verbose' || a === '-v') opts.verbose = true;
  }
  return opts;
}

async function smokeCreateGhost(baseUrl: string): Promise<SmokeResult> {
  const t0 = Date.now();
  const sessionId = `s_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const visitorId = `v_smoke_${Date.now()}`;
  try {
    const res = await fetch(`${baseUrl}/api/checkout/lead`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': `smoke_chat_purity_${sessionId}`,
      },
      body: JSON.stringify({
        firstName: 'Smoke',
        phone: '+212600000000',
        sessionId,
        visitorId,
        language: 'fr',
        page: '/kit',
        consentVersion: 'v1',
        formContext: {
          formId: 'kit_wizard',
          formMode: 'wizard_embed',
          variantKey: 'A',
          source: 'wizard_kit',
        },
      }),
    });
    return {
      name: 'create_ghost',
      passed: res.ok,
      latencyMs: Date.now() - t0,
      details: res.ok ? `201 created (${sessionId.slice(0, 16)}…)` : `status ${res.status}`,
    };
  } catch (err) {
    return {
      name: 'create_ghost',
      passed: false,
      latencyMs: Date.now() - t0,
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

async function smokeAuditPollution(
  baseUrl: string,
  adminCookie?: string,
): Promise<SmokeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/admin/chat/audit-pollution`, {
      headers: adminCookie ? { cookie: adminCookie } : undefined,
    });
    if (res.status === 401) {
      return {
        name: 'audit_pollution',
        passed: true,
        latencyMs: Date.now() - t0,
        details: '401 (auth required, OK without cookie)',
      };
    }
    if (!res.ok) {
      return {
        name: 'audit_pollution',
        passed: false,
        latencyMs: Date.now() - t0,
        details: `status ${res.status}`,
      };
    }
    const body = (await res.json()) as {
      distributions?: { session_kind?: unknown[]; lead_source?: unknown[] };
    };
    const hasKind = Array.isArray(body.distributions?.session_kind);
    return {
      name: 'audit_pollution',
      passed: hasKind,
      latencyMs: Date.now() - t0,
      details: hasKind
        ? `${body.distributions!.session_kind!.length} kinds`
        : 'no kind data',
    };
  } catch (err) {
    return {
      name: 'audit_pollution',
      passed: false,
      latencyMs: Date.now() - t0,
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

async function smokeCleanupDryRun(
  baseUrl: string,
  adminCookie?: string,
): Promise<SmokeResult> {
  const t0 = Date.now();
  if (!adminCookie) {
    return {
      name: 'cleanup_dryRun',
      passed: true,
      latencyMs: 0,
      details: 'skipped (no admin cookie)',
    };
  }
  try {
    const res = await fetch(`${baseUrl}/api/admin/chat/cleanup-ghosts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ dryRun: true, olderThanDays: 30 }),
    });
    if (!res.ok) {
      return {
        name: 'cleanup_dryRun',
        passed: false,
        latencyMs: Date.now() - t0,
        details: `status ${res.status}`,
      };
    }
    const body = (await res.json()) as { candidates: number };
    return {
      name: 'cleanup_dryRun',
      passed: true,
      latencyMs: Date.now() - t0,
      details: `candidates=${body.candidates}, dryRun=true`,
    };
  } catch (err) {
    return {
      name: 'cleanup_dryRun',
      passed: false,
      latencyMs: Date.now() - t0,
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`\n🔍 Smoke chat purity — ${args.baseUrl}\n`);
  console.log('Tests :');

  const results = await Promise.all([
    smokeCreateGhost(args.baseUrl),
    smokeAuditPollution(args.baseUrl, args.adminCookie),
    smokeCleanupDryRun(args.baseUrl, args.adminCookie),
  ]);

  console.log('─'.repeat(60));
  for (const r of results) {
    const status = r.passed ? '✅' : '❌';
    const details = r.details ? ` (${r.details})` : '';
    console.log(
      `  ${status} ${r.name.padEnd(20)} ${r.latencyMs.toString().padStart(5)}ms${details}`,
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log('─'.repeat(60));
  console.log(`\n📊 Résultat : ${passed}/${results.length} ✅, ${failed} ❌\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Smoke failed:', err);
  process.exit(1);
});
