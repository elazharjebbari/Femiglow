/**
 * GET /api/admin/reset/backups
 * → 200 { backups: BackupSummary[] }
 */
import { readdir, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKUP_ROOT = process.env.RESET_BACKUP_ROOT || '/var/backups/femiglow';

export async function GET(): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  let entries: string[] = [];
  try {
    entries = await readdir(BACKUP_ROOT);
  } catch {
    return NextResponse.json({ backups: [], root: BACKUP_ROOT });
  }

  const out: Array<Record<string, unknown>> = [];
  for (const name of entries) {
    if (!name.startsWith('bkp_')) continue;
    const dir = path.join(BACKUP_ROOT, name);
    try {
      const s = await stat(dir);
      if (!s.isDirectory()) continue;
      let manifest: Record<string, unknown> = {};
      try {
        manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
      } catch { /* ignore */ }
      out.push({
        backupId: name,
        path: dir,
        takenAt: (manifest.takenAt as string) ?? new Date(s.mtimeMs).toISOString(),
        mode: manifest.mode ?? null,
        dbSize: (manifest as { db?: { size?: number } }).db?.size ?? null,
        mediaSize: (manifest as { media?: { size?: number } | null }).media?.size ?? null,
        gitCommit: manifest.gitCommit ?? null,
      });
    } catch {
      // ignore
    }
  }
  out.sort((a, b) => String(b.takenAt).localeCompare(String(a.takenAt)));
  return NextResponse.json({ backups: out, root: BACKUP_ROOT });
}
