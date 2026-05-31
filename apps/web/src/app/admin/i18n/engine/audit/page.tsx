/**
 * Page admin — Audit de configuration du moteur (`/admin/i18n/engine/audit`,
 * lot L11, audit-model §3.3/§5).
 *
 * Server Component : `requireAdmin` → liste les events `i18n-engine.update`
 * (resourceType `app_config`, resourceId `i18n_suggestion_engine`) et affiche
 * pour chacun le **diff lisible** before→after (qui a allumé le moteur, avec
 * quels profils — INV-19). Lecture seule.
 *
 * NB : l'audit de **décisions runtime** (table evaluated/suppressed + cartes de
 * santé, §3.1/§3.2) dépend du sink analytique et sera livré séparément.
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/02-config/audit-model.md
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { listAuditEventsForResource } from '@/lib/audit/list-events';
import { requireAdmin } from '@/lib/auth/require-admin';
import { ENGINE_CONFIG_SECTION } from '@/lib/i18n/engine-config';
import { diffEngineConfig } from '@/lib/i18n/engine-config-diff';

export const dynamic = 'force-dynamic';

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

export default async function AdminI18nEngineAuditPage(): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/i18n/engine/audit');
  const events = await listAuditEventsForResource(
    'app_config',
    ENGINE_CONFIG_SECTION,
    100,
  );

  return (
    <AdminShell adminEmail={session.email} active="i18n">
      <div className="space-y-4">
        <header>
          <h1 className="text-base font-semibold text-stone-900">
            Audit du moteur de suggestion
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Journal des changements de configuration — qui a modifié quoi, et
            le diff avant → après (INV-19).
          </p>
        </header>

        {events.length === 0 ? (
          <p
            data-testid="audit-empty"
            className="rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-500"
          >
            Aucun changement de configuration enregistré.
          </p>
        ) : (
          <ul data-testid="audit-list" className="space-y-3">
            {events.map((ev) => {
              const meta = ev.meta as Record<string, unknown>;
              const version = asNumber(meta.version);
              const note = asString(meta.note);
              const changes = diffEngineConfig(meta.before, meta.after);
              return (
                <li
                  key={ev.id}
                  data-testid="audit-entry"
                  className="rounded-lg border border-stone-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-stone-800">
                      {version !== null ? `v${version}` : '—'}
                      <span className="ml-2 font-normal text-stone-500">
                        {ev.actorId ?? 'système'}
                      </span>
                    </span>
                    <time className="text-stone-500">
                      {ev.createdAt instanceof Date
                        ? ev.createdAt.toISOString()
                        : String(ev.createdAt)}
                    </time>
                  </div>

                  {note ? (
                    <p className="mt-1 text-xs italic text-stone-600">
                      « {note} »
                    </p>
                  ) : null}

                  {changes.length === 0 ? (
                    <p className="mt-2 text-xs text-stone-400">
                      Aucun changement significatif.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {changes.map((c) => (
                        <li
                          key={c.field}
                          className="flex flex-wrap items-baseline gap-2 text-xs"
                        >
                          <span className="font-mono text-stone-700">
                            {c.field}
                          </span>
                          <span className="text-stone-400">
                            {c.before} → <strong className="text-stone-900">{c.after}</strong>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
