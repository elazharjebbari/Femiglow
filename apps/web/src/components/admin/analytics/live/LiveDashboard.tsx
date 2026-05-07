/**
 * LiveDashboard — orchestrateur côté client de l'onglet Live.
 * cf. docs/analytics/05-onglets-specs.md §2
 *
 * Wraps `useAnalyticsSSE` + state local (window, paused) et compose les
 * sous-composants Live. Le `<LiveStatusBanner>` reste épinglé en haut.
 */
'use client';

import { useState } from 'react';

import { useAnalyticsSSE } from '@/components/admin/analytics/hooks/useAnalyticsSSE';
import type { LiveWindow } from '@/lib/analytics/queries/live';

import { LiveByDevice } from './LiveByDevice';
import { LiveByPage } from './LiveByPage';
import { LiveBySource } from './LiveBySource';
import { LiveEventStream } from './LiveEventStream';
import { LiveFunnel } from './LiveFunnel';
import { LiveKpiBig } from './LiveKpiBig';
import { LiveStatusBanner } from './LiveStatusBanner';

interface LiveDashboardProps {
  /** Snapshot initial fourni par le RSC (zero-flicker au mount). */
  initialSnapshot?: import('@/lib/analytics/queries/live').LiveSnapshot | null;
  initialWindow?: LiveWindow;
}

export function LiveDashboard({
  initialSnapshot = null,
  initialWindow = '1h',
}: LiveDashboardProps) {
  const [window, setWindow] = useState<LiveWindow>(initialWindow);
  const { data, status, paused, pause, resume } = useAnalyticsSSE({
    window,
  });

  // Si on n'a pas encore reçu de snapshot SSE, on affiche celui du RSC.
  const snapshot = data ?? initialSnapshot;

  return (
    <div className="flex flex-col gap-6" data-testid="live-dashboard">
      <LiveStatusBanner
        status={status}
        lastUpdateIso={snapshot?.generatedAt}
        paused={paused}
        onPause={pause}
        onResume={resume}
      />

      <LiveKpiBig
        data={snapshot?.kpiBig ?? null}
        window={window}
        onWindowChange={setWindow}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <LiveByPage rows={snapshot?.byPage ?? []} />
        <LiveBySource rows={snapshot?.bySource ?? []} />
        <LiveByDevice rows={snapshot?.byDevice ?? []} />
      </div>

      <LiveEventStream
        events={snapshot?.recentEvents ?? []}
        paused={paused}
      />

      <LiveFunnel steps={snapshot?.funnel ?? defaultFunnel()} window={window} />
    </div>
  );
}

function defaultFunnel(): import('@/lib/analytics/queries/live').LiveFunnelStep[] {
  return [
    { stage: 'tof', sessions: 0 },
    { stage: 'mof', sessions: 0 },
    { stage: 'bof', sessions: 0 },
    { stage: 'conversion', sessions: 0 },
  ];
}
