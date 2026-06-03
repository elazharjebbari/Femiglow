/**
 * Handlers MSW pour la sauvegarde de la navigation admin
 * (PATCH /api/admin/settings/nav, consommé par <NavEditor/>).
 *
 * Cycle de vie PAR FICHIER. Couvre succès / conflit de version / validation /
 * réseau, et CAPTURE le header `If-Match` + le payload pour assertion.
 * cf. docs/admin-nav-coupons-qa-2026-06-03/N08.
 */
import { http, HttpResponse } from 'msw';

export interface NavSaveCall {
  ifMatch: string | null;
  payload: unknown;
}

/** Journal des appels PATCH (à inspecter dans les tests). */
export const navSaveCalls: NavSaveCall[] = [];
export function resetNavSaveCalls(): void {
  navSaveCalls.length = 0;
}

export interface NavSettingsHandlerOptions {
  /** Version courante côté serveur (pour meta.version = If-Match + 1 en succès). */
  version?: number;
  /** Échec injecté : 'conflict' (409) | 'validation' (422) | nombre | 'network'. */
  fail?: 'conflict' | 'validation' | number | 'network';
  latencyMs?: number;
}

async function maybeDelay(ms?: number): Promise<void> {
  if (ms && ms > 0) await new Promise((r) => setTimeout(r, ms));
}

export function navSettingsHandlers(opts: NavSettingsHandlerOptions = {}) {
  return [
    http.patch('/api/admin/settings/nav', async ({ request }) => {
      await maybeDelay(opts.latencyMs);
      const ifMatch = request.headers.get('If-Match');
      const body = (await request.json().catch(() => ({}))) as { payload?: unknown };
      navSaveCalls.push({ ifMatch, payload: body?.payload });

      if (opts.fail === 'network') return HttpResponse.error();
      if (typeof opts.fail === 'number') {
        return HttpResponse.json({ error: { code: 'server_error' } }, { status: opts.fail });
      }
      if (opts.fail === 'conflict') {
        return HttpResponse.json(
          { error: { code: 'version_conflict', message: 'stale', details: { currentVersion: (opts.version ?? 1) + 1 } } },
          { status: 409 },
        );
      }
      if (opts.fail === 'validation') {
        return HttpResponse.json(
          {
            error: {
              code: 'validation_failed',
              message: 'Payload invalide',
              details: [{ path: ['items', 0, 'label'], message: 'Label requis (serveur).' }],
            },
          },
          { status: 422 },
        );
      }
      const nextVersion = (Number(ifMatch) || opts.version || 0) + 1;
      return HttpResponse.json({
        section: 'nav',
        payload: body?.payload ?? { items: [] },
        meta: { version: nextVersion, updatedAt: '2026-06-03T00:00:00.000Z', updatedBy: null, isDefault: false },
        snapshotId: 'snap_1',
      });
    }),
  ];
}
