import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { listTrackingProviders } from '@/lib/db/queries/tracking/providers';
import { ConsentBannerSettingsForm } from '@/components/admin/tracking/ConsentBannerSettingsForm';
import {
  getTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';

export const dynamic = 'force-dynamic';

export default async function TrackingSettingsPage() {
  const session = await requireAdmin('/admin/tracking/settings');
  const providers = await listTrackingProviders();
  const enabledCount = providers.filter((p) => p.status === 'enabled').length;
  const [bannerEnabled, defaultGranted] = await Promise.all([
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_BANNER_ENABLED, true),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_DEFAULT_GRANTED, false),
  ]);

  const checks: Array<{ label: string; ok: boolean; detail?: string }> = [
    {
      label: 'WEBHOOK_SECRET_KEY défini',
      ok: !!process.env.WEBHOOK_SECRET_KEY && process.env.WEBHOOK_SECRET_KEY.length >= 32,
    },
    {
      label: 'CRON_SECRET défini',
      ok: !!process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16,
    },
    {
      label: 'NODE_ENV',
      ok: true,
      detail: process.env.NODE_ENV ?? 'unknown',
    },
    {
      label: 'Au moins 1 provider activé',
      ok: enabledCount > 0,
      detail: `${enabledCount} / ${providers.length}`,
    },
  ];

  return (
    <TrackingShell
      adminEmail={session.email}
      active="settings"
      title="Réglages"
      description="Configuration globale, environnement et bandeau consentement."
    >
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Environnement
        </h2>
        <ul className="mt-3 divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-stone-900">{c.label}</span>
              <span className="flex items-center gap-2 text-xs">
                {c.detail ? <span className="font-mono text-stone-500">{c.detail}</span> : null}
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    c.ok
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {c.ok ? 'ok' : 'manquant'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Bandeau consentement
        </h2>
        <p className="mt-3 text-sm text-stone-700">
          Le bandeau cookie est rendu via{' '}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">
            ConsentBanner
          </code>{' '}
          et persiste l’état dans <code className="font-mono text-xs">localStorage</code> +
          cookie <code className="font-mono text-xs">fg_consent</code>. Les snapshots sont
          enregistrés en base via <code className="font-mono text-xs">/api/track/consent</code>.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Politique : Consent Mode v2 (denied par défaut), opt-in explicite, retrait possible à
          tout moment via le footer.
        </p>
        <ConsentBannerSettingsForm
          initialBannerEnabled={bannerEnabled}
          initialDefaultGranted={defaultGranted}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Rétention &amp; CRON
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-700">
          <li>
            Logs purgés après <strong>180 jours</strong> via{' '}
            <code className="font-mono text-xs">/api/cron/tracking-purge</code> (quotidien à 03h).
          </li>
          <li>
            Sessions de consentement conservées durant la durée légale (anonymisées par
            <code className="font-mono text-xs"> anonymousId</code>).
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Debug global
        </h2>
        <p className="mt-3 text-sm text-stone-700">
          Activer l’overlay debug en posant le cookie{' '}
          <code className="font-mono text-xs">fg_tracking_debug=1</code> sur ton domaine.
          L’overlay affiche les events DataLayer en temps réel sur la page.
        </p>
      </section>
    </TrackingShell>
  );
}
