import { SyncCard } from './SyncCard';
import { PingTimeline } from './PingTimeline';
import type { DriftReason, DriftStatusEnum } from '@/lib/tracking/gtm/sentinel-schemas';

export type SyncStatusPayload = {
  activeAdmin: {
    mappingVersion: string;
    configVersion: string;
    bundleId: string;
    containerId: string;
  };
  lastPing: {
    id: string;
    receivedAt: string;
    bundleId: string;
    mappingVersion: string;
    configVersion: string;
    containerId: string;
    manifestMismatch: boolean;
  } | null;
  drift: { status: DriftStatusEnum; since: string; reasons: DriftReason[] };
  silence: { ok: boolean; lastPingAgoMs: number | null; thresholdHours: number };
  history: Array<{
    day: string;
    pingsCount: number;
    driftDetected: boolean;
  }>;
  recentTransitions: Array<{
    id: string;
    at: string;
    from: DriftStatusEnum | null;
    to: DriftStatusEnum;
    reasons: DriftReason[];
  }>;
  generatedAt: string;
};

type Props = { data: SyncStatusPayload };

export function SyncStatusView({ data }: Props) {
  const statusInfo = STATUS_LABELS[data.drift.status];
  return (
    <div className="space-y-4">
      <div
        data-testid="global-status-badge"
        data-status={data.drift.status}
        className={`rounded-lg border ${statusInfo.bg} p-5 ${statusInfo.text}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{statusInfo.icon} {statusInfo.headline}</h2>
            <p className="mt-1 text-sm">
              {data.lastPing ? (
                <>Dernier ping : {timeAgo(data.lastPing.receivedAt)}</>
              ) : (
                <>Aucun ping reçu pour l'instant.</>
              )}
            </p>
            {data.drift.reasons.length > 0 ? (
              <ul className="mt-3 list-disc pl-5 text-sm">
                {data.drift.reasons.map((r, i) => (
                  <li key={i}>{describeReason(r)}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="text-xs">
            <p>Container : <span className="font-mono">{data.activeAdmin.containerId}</span></p>
            <p>Bundle admin : <span className="font-mono">{data.activeAdmin.bundleId}</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SyncCard
          title="Mapping vendors"
          adminValue={data.activeAdmin.mappingVersion}
          runtimeValue={data.lastPing?.mappingVersion ?? '—'}
          match={data.activeAdmin.mappingVersion === data.lastPing?.mappingVersion}
          subtitle={data.lastPing ? subtitleFor(data.activeAdmin.mappingVersion, data.lastPing.mappingVersion) : null}
          testId="sync-card-mapping"
        />
        <SyncCard
          title="Config GTM"
          adminValue={data.activeAdmin.configVersion}
          runtimeValue={data.lastPing?.configVersion ?? '—'}
          match={data.activeAdmin.configVersion === data.lastPing?.configVersion}
          subtitle={data.lastPing ? subtitleFor(data.activeAdmin.configVersion, data.lastPing.configVersion) : null}
          testId="sync-card-config"
        />
        <SyncCard
          title="Bundle ID"
          adminValue={data.activeAdmin.bundleId}
          runtimeValue={data.lastPing?.bundleId ?? '—'}
          match={data.activeAdmin.bundleId === data.lastPing?.bundleId}
          subtitle={data.lastPing ? subtitleFor(data.activeAdmin.bundleId, data.lastPing.bundleId) : null}
          testId="sync-card-bundle"
        />
      </div>

      <PingTimeline days={data.history} />

      {data.recentTransitions.length > 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">Dernières transitions</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {data.recentTransitions.map((t) => (
              <li key={t.id} className="font-mono text-stone-700">
                <span className="text-stone-500">{t.at.slice(0, 16).replace('T', ' ')}</span>
                {'  '}
                <span>{t.from ?? '—'} → {t.to}</span>
                {t.reasons[0] ? (
                  <span className="ml-2 text-stone-500">{describeReason(t.reasons[0])}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const STATUS_LABELS: Record<DriftStatusEnum, { bg: string; text: string; icon: string; headline: string }> = {
  ok: {
    bg: 'border-emerald-200 bg-emerald-50',
    text: 'text-emerald-900',
    icon: '🟢',
    headline: 'Tout est cohérent',
  },
  warning: {
    bg: 'border-amber-200 bg-amber-50',
    text: 'text-amber-900',
    icon: '🟠',
    headline: 'Attention : drift mineur',
  },
  critical: {
    bg: 'border-red-200 bg-red-50',
    text: 'text-red-900',
    icon: '🔴',
    headline: 'DRIFT CRITIQUE',
  },
};

function describeReason(r: DriftReason): string {
  switch (r.code) {
    case 'bundle_mismatch':
      return `Bundle ID : attendu ${r.expected}, reçu ${r.got}.`;
    case 'mapping_version_drift':
      return `Mapping : attendu ${r.expected}, reçu ${r.got}.`;
    case 'config_version_drift':
      return `Config : attendue ${r.expected}, reçue ${r.got}.`;
    case 'container_id_mismatch':
      return `Container ID : attendu ${r.expected}, reçu ${r.got}.`;
    case 'silence_excess':
      return `Silence : aucun ping reçu depuis ≥ ${r.thresholdHours}h.`;
    case 'manifest_flag_mismatch':
      return `Manifest check (Couche C) : ${r.details}.`;
  }
}

function subtitleFor(admin: string, runtime: string): string {
  if (admin === runtime) return '✅ Cohérent';
  return `✗ Diffère (attendu ${admin}, reçu ${runtime})`;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'il y a quelques secondes';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}
