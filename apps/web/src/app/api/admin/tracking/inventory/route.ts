import path from 'node:path';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  scanInventory,
  type InventoryManifest,
} from '@/lib/tracking/inventory/scanner';
import {
  computeInventoryDiff,
  summarizeDiff,
  diffIsEmpty,
} from '@/lib/tracking/inventory/diff';
import { listTrackingComponents } from '@/lib/db/queries/tracking/components';
import { listTrackingPages } from '@/lib/db/queries/tracking/pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function projectRoots(): { projectRoot: string; componentsRoot: string; pagesRoot: string } {
  const projectRoot = path.resolve(process.cwd());
  return {
    projectRoot,
    componentsRoot: path.join(projectRoot, 'src/components'),
    pagesRoot: path.join(projectRoot, 'src/app'),
  };
}

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    let manifest: InventoryManifest;
    try {
      const roots = projectRoots();
      manifest = await scanInventory(roots);
    } catch {
      manifest = { generatedAt: new Date().toISOString(), components: [], pages: [] };
    }

    const [existingComponents, existingPages] = await Promise.all([
      listTrackingComponents({ includeDeleted: true }),
      listTrackingPages(),
    ]);
    const diff = computeInventoryDiff({
      manifest,
      existingComponents,
      existingPages,
    });
    return NextResponse.json({
      manifest,
      diff: {
        componentsToCreate: diff.componentsToCreate.length,
        componentsToUpdate: diff.componentsToUpdate.length,
        componentsToDelete: diff.componentsToDelete.length,
        pagesToCreate: diff.pagesToCreate.length,
        pagesToUpdate: diff.pagesToUpdate.length,
        pagesToDelete: diff.pagesToDelete.length,
        isEmpty: diffIsEmpty(diff),
        summary: summarizeDiff(diff),
        details: diff,
      },
      existing: {
        componentsCount: existingComponents.length,
        pagesCount: existingPages.length,
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
