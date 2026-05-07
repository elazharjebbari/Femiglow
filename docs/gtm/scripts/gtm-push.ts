#!/usr/bin/env tsx
/**
 * Pousse le container.json vers GTM via l'API v2.
 *
 * Usage :
 *   pnpm tsx docs/gtm/scripts/gtm-push.ts \
 *     --container infra/gtm/container.production.json \
 *     --workspace feature/abc \
 *     --env preview \
 *     [--dry-run] [--notes "auto-sync from CI"]
 *
 * Auth :
 *   - GTM_SERVICE_ACCOUNT_KEY=/path/to/service-account.json
 *   - GTM_ACCOUNT_ID=...
 *   - GTM_CONTAINER_ID=...
 *
 * NOTE : ce fichier est un SQUELETTE documenté. À implémenter
 *        ticket par ticket (GTM-041 → GTM-050).
 */

import fs from 'node:fs/promises';
import { google, tagmanager_v2 } from 'googleapis';
import { JWT } from 'google-auth-library';

type Diff = {
  toCreate: { kind: 'tag' | 'trigger' | 'variable'; data: any }[];
  toUpdate: { kind: 'tag' | 'trigger' | 'variable'; data: any; remoteId: string }[];
  toDelete: { kind: 'tag' | 'trigger' | 'variable'; remoteId: string; name: string }[];
};

async function authClient(keyPath: string) {
  return new JWT({
    keyFile: keyPath,
    scopes: [
      'https://www.googleapis.com/auth/tagmanager.edit.containers',
      'https://www.googleapis.com/auth/tagmanager.publish',
    ],
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const keyPath = process.env.GTM_SERVICE_ACCOUNT_KEY!;
  const accountId = process.env.GTM_ACCOUNT_ID!;
  const containerId = process.env.GTM_CONTAINER_ID!;

  const auth = await authClient(keyPath);
  const tm = google.tagmanager({ version: 'v2', auth });

  const containerPath = `accounts/${accountId}/containers/${containerId}`;

  // 1. Charger le container.json local
  const desired = JSON.parse(await fs.readFile(args.container, 'utf-8'));

  // 2. Trouver / créer le workspace cible
  const workspaceName = args.workspace ?? 'auto-sync';
  const workspace = await ensureWorkspace(tm, containerPath, workspaceName);
  console.log(`Workspace : ${workspace.name} (${workspace.workspaceId})`);

  // 3. Snapshot remote
  const remoteSnapshot = await snapshotWorkspace(tm, workspace.path!);

  // 4. Diff
  const diff = computeDiff(remoteSnapshot, desired.containerVersion);
  printDiff(diff);

  if (args.dryRun) return;

  // 5. Apply (ordre : variables → triggers → tags pour respecter les références)
  await applyVariables(tm, workspace.path!, diff);
  await applyTriggers(tm, workspace.path!, diff);
  await applyTags(tm, workspace.path!, diff);

  // 6. Create version
  const versionRes = await tm.accounts.containers.workspaces.create_version({
    path: workspace.path!,
    requestBody: { name: args.notes ?? `Auto v${Date.now()}` },
  });
  const versionId = versionRes.data.containerVersion?.containerVersionId!;
  console.log(`✓ Version créée : ${versionId}`);

  // 7. Publish to env
  if (args.env) {
    const envPath = `${containerPath}/environments/${args.env}`;
    await tm.accounts.containers.environments.update({
      path: envPath,
      requestBody: { containerVersionId: versionId },
    });
    console.log(`✓ Publié sur ${args.env}`);
  }
}

async function ensureWorkspace(
  tm: tagmanager_v2.Tagmanager,
  containerPath: string,
  name: string,
): Promise<tagmanager_v2.Schema$Workspace> {
  const list = await tm.accounts.containers.workspaces.list({ parent: containerPath });
  const existing = (list.data.workspace ?? []).find((w) => w.name === name);
  if (existing) return existing;
  const created = await tm.accounts.containers.workspaces.create({
    parent: containerPath,
    requestBody: { name, description: 'Auto-managed by gtm-push.ts' },
  });
  return created.data;
}

async function snapshotWorkspace(tm: tagmanager_v2.Tagmanager, workspacePath: string) {
  const [vars, triggers, tags] = await Promise.all([
    tm.accounts.containers.workspaces.variables.list({ parent: workspacePath }),
    tm.accounts.containers.workspaces.triggers.list({ parent: workspacePath }),
    tm.accounts.containers.workspaces.tags.list({ parent: workspacePath }),
  ]);
  return {
    variable: vars.data.variable ?? [],
    trigger: triggers.data.trigger ?? [],
    tag: tags.data.tag ?? [],
  };
}

function computeDiff(remote: any, desired: any): Diff {
  const diff: Diff = { toCreate: [], toUpdate: [], toDelete: [] };

  for (const kind of ['variable', 'trigger', 'tag'] as const) {
    const remoteByName = new Map<string, any>((remote[kind] ?? []).map((x: any) => [x.name, x]));
    const desiredByName = new Map<string, any>((desired[kind] ?? []).map((x: any) => [x.name, x]));

    for (const [name, d] of desiredByName) {
      const r = remoteByName.get(name);
      if (!r) {
        diff.toCreate.push({ kind, data: d });
      } else if (!structurallyEqual(r, d)) {
        diff.toUpdate.push({ kind, data: d, remoteId: r[`${kind}Id`] });
      }
    }
    for (const [name, r] of remoteByName) {
      if (!desiredByName.has(name)) {
        diff.toDelete.push({ kind, remoteId: r[`${kind}Id`], name });
      }
    }
  }

  return diff;
}

function structurallyEqual(a: any, b: any): boolean {
  // TODO: comparaison normalisée (ignorer accountId / containerId / etc.)
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

function canonicalize(o: any): any {
  if (Array.isArray(o)) return o.map(canonicalize);
  if (o && typeof o === 'object') {
    const out: any = {};
    for (const k of Object.keys(o).sort()) {
      if (['accountId', 'containerId', 'workspaceId', 'fingerprint', 'tagManagerUrl'].includes(k)) continue;
      out[k] = canonicalize(o[k]);
    }
    return out;
  }
  return o;
}

async function applyVariables(tm: tagmanager_v2.Tagmanager, parent: string, diff: Diff) {
  for (const c of diff.toCreate.filter((x) => x.kind === 'variable')) {
    await tm.accounts.containers.workspaces.variables.create({ parent, requestBody: c.data });
  }
  for (const u of diff.toUpdate.filter((x) => x.kind === 'variable')) {
    await tm.accounts.containers.workspaces.variables.update({
      path: `${parent}/variables/${u.remoteId}`,
      requestBody: u.data,
    });
  }
  for (const d of diff.toDelete.filter((x) => x.kind === 'variable')) {
    await tm.accounts.containers.workspaces.variables.delete({
      path: `${parent}/variables/${d.remoteId}`,
    });
  }
}

// Idem pour triggers / tags — mêmes appels avec workspaces.triggers / workspaces.tags

async function applyTriggers(tm: tagmanager_v2.Tagmanager, parent: string, diff: Diff) { /* TODO */ }
async function applyTags(tm: tagmanager_v2.Tagmanager, parent: string, diff: Diff) { /* TODO */ }

function printDiff(diff: Diff) {
  console.log(`Diff :`);
  console.log(`  + ${diff.toCreate.length} create`);
  console.log(`  ~ ${diff.toUpdate.length} update`);
  console.log(`  - ${diff.toDelete.length} delete`);
  for (const c of diff.toCreate) console.log(`  + ${c.kind} : ${c.data.name}`);
  for (const u of diff.toUpdate) console.log(`  ~ ${u.kind} : ${u.data.name}`);
  for (const d of diff.toDelete) console.log(`  - ${d.kind} : ${d.name}`);
}

function parseArgs(argv: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      out[k] = v ?? argv[++i];
    }
  }
  return out;
}

main().catch((err) => {
  console.error('✗', err?.message ?? err);
  process.exit(1);
});
