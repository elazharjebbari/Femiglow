/**
 * Snapshot Git auto des containers GTM générés.
 *
 * Écrit `infra/gtm/container.<env>.json` à chaque activation/manuel.
 * Idempotent : si le contenu n'a pas changé (sha256 identique), no-op.
 *
 * Comportement :
 *  - En dev local (filesystem writable) : écrit les fichiers
 *  - En prod Vercel (read-only fs) : skip silencieux + log info
 *  - Path traversal protégé : seul `infra/gtm/<safe-name>.json` accepté
 *
 * Cf. docs/gtm/17-onboarding-robustness.md §3.4.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gtmExporter, type GtmEnvironment } from './exporter';
import { gtmConfigStore } from './config-store';

const SAFE_NAME_RE = /^[a-z0-9._-]+$/i;
const ENVS: GtmEnvironment[] = ['production', 'stage', 'preview', 'dev'];
const SNAPSHOT_DIR_REL = 'infra/gtm';

export interface SnapshotResult {
  written: Array<{ env: GtmEnvironment; path: string; sha256: string; bytes: number; skipped?: boolean }>;
  skippedReason?: 'read_only_fs' | 'no_op';
  errors: Array<{ env: GtmEnvironment; message: string }>;
}

function repoRoot(): string {
  // Worktrees Vercel posent process.cwd() à `apps/web`.
  // Dev local : peut être à la racine du repo. On cherche le premier `infra/gtm`
  // remontant vers la racine.
  return process.cwd();
}

/**
 * Strippe la ligne `"exportTime": "..."` du pretty-print pour permettre
 * la comparaison idempotente. exportTime change à chaque génération mais
 * n'est pas significatif pour la cohérence du container.
 */
function stripExportTime(json: string): string {
  return json.replace(/^\s*"exportTime":\s*"[^"]*",?\s*$/m, '');
}

function safeFilenameFor(env: GtmEnvironment): string {
  if (!SAFE_NAME_RE.test(env)) {
    throw new Error(`unsafe_env_name: ${env}`);
  }
  return `container.${env}.json`;
}

/**
 * Écrit un snapshot pour une env spécifique. Pure side-effect contenu.
 * Retourne null si filesystem read-only (prod), { skipped: true } si idempotent.
 */
async function writeSnapshotEnv(env: GtmEnvironment): Promise<
  { path: string; sha256: string; bytes: number; skipped: boolean } | null
> {
  const filename = safeFilenameFor(env);
  // Lit la config active pour appliquer les overrides Pixel IDs.
  const active = await gtmConfigStore.getActive().catch(() => null);
  const exp = gtmExporter.build({
    env,
    ...(active ? { config: active.perEnv[env] } : {}),
  });

  // Localise le dossier infra/gtm en remontant l'arbre depuis CWD.
  const dir = await locateOrCreateSnapshotDir();
  if (!dir) return null;

  const target = path.join(dir, filename);

  // Idempotent : on compare le pretty en ignorant la ligne exportTime
  // (qui change à chaque génération). Si le reste du contenu est identique,
  // on skippe l'écriture.
  try {
    const existing = await fs.readFile(target, 'utf8');
    if (stripExportTime(existing) === stripExportTime(exp.pretty)) {
      return {
        path: target,
        sha256: exp.meta.sha256,
        bytes: exp.meta.sizeBytes,
        skipped: true,
      };
    }
  } catch {
    /* fichier n'existe pas → on écrit */
  }

  // Atomicity : write to temp + rename.
  const tmp = path.join(dir, `${filename}.tmp-${process.pid}`);
  await fs.writeFile(tmp, exp.pretty, 'utf8');
  await fs.rename(tmp, target);

  return {
    path: target,
    sha256: exp.meta.sha256,
    bytes: exp.meta.sizeBytes,
    skipped: false,
  };
}

async function locateOrCreateSnapshotDir(): Promise<string | null> {
  const cwd = repoRoot();
  // 1. cwd/infra/gtm (cas root du monorepo)
  const direct = path.join(cwd, SNAPSHOT_DIR_REL);
  // 2. cwd/../../infra/gtm (cas apps/web/)
  const fromAppsWeb = path.resolve(cwd, '..', '..', SNAPSHOT_DIR_REL);

  for (const candidate of [direct, fromAppsWeb]) {
    try {
      await fs.access(path.dirname(candidate));
      try {
        await fs.mkdir(candidate, { recursive: true });
        return candidate;
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        // EROFS/EACCES = filesystem read-only (Vercel) → on retourne null
        if (code === 'EROFS' || code === 'EACCES') return null;
      }
    } catch {
      /* parent inexistant, on essaie le suivant */
    }
  }
  return null;
}

export const gtmSnapshot = {
  /** Écrit les snapshots pour les 4 environnements. */
  async writeAll(): Promise<SnapshotResult> {
    const written: SnapshotResult['written'] = [];
    const errors: SnapshotResult['errors'] = [];
    let anyWriteAttempted = false;

    for (const env of ENVS) {
      try {
        const r = await writeSnapshotEnv(env);
        if (r === null) {
          // FS read-only → on s'arrête (rien ne marchera)
          return {
            written,
            skippedReason: 'read_only_fs',
            errors,
          };
        }
        anyWriteAttempted = true;
        written.push({ env, ...r });
      } catch (err) {
        errors.push({
          env,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      written,
      skippedReason: anyWriteAttempted ? undefined : 'read_only_fs',
      errors,
    };
  },

  /** Pour un seul env (utilisé par les tests). */
  async writeOne(
    env: GtmEnvironment,
  ): Promise<{ env: GtmEnvironment; path: string; sha256: string; bytes: number; skipped: boolean } | null> {
    const r = await writeSnapshotEnv(env);
    if (!r) return null;
    return { env, ...r };
  },
};
