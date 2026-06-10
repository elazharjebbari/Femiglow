'use client';

/**
 * DashboardAutoRefresh — fraîcheur + rafraîchissement automatique du dashboard
 * emailing (F03, DASH-03/DASH-08 — évolution de DashboardFreshness).
 *
 * Doctrine :
 *  - tick 60 s : SONDE le summary côté client PUIS `router.refresh()` si la
 *    sonde répond — un refresh RSC aveugle ne sait pas dire à l'opérateur que
 *    le serveur est tombé ; la sonde rend l'échec OBSERVABLE (bandeau « figé
 *    à HH:MM ») sans jamais mentir sur l'âge des données ;
 *  - l'âge ne se réinitialise QUE quand `generatedAt` change (nouvelles
 *    données réellement arrivées) — jamais sur un refresh raté (zéro faux
 *    « à jour il y a 0 s ») ;
 *  - onglet caché : tick 60 s suspendu, l'ÂGE continue de courir ; retour au
 *    premier plan → refresh immédiat ;
 *  - démontage : les DEUX intervalles sont nettoyés ;
 *  - bouton manuel : même sonde, aria-busy, anti double-clic.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtClock, type DashboardWindow } from '@/app/admin/emails/kpi-format';
import {
  DEFAULT_TIMEZONE,
  timeZoneLabel,
} from '@/components/admin/emails/ui/format-datetime';

export const REFRESH_INTERVAL_MS = 60_000;
export const AGE_TICK_MS = 1_000;

type Degraded = null | 'unreachable' | 'unauthorized';

export function DashboardAutoRefresh({
  generatedAt,
  window: windowName,
}: {
  /** Horodatage iso du rendu serveur — sa CHANGE réinitialise l'âge. */
  generatedAt: string;
  window: DashboardWindow;
}) {
  const router = useRouter();
  const [ageSec, setAgeSec] = useState(0);
  const [degraded, setDegraded] = useState<Degraded>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  /**
   * Sonde + refresh. La sonde GET summary est le même endpoint que les données
   * des cartes : si elle répond, le refresh RSC répondra aussi.
   */
  const probeAndRefresh = useCallback(async () => {
    if (inFlight.current) return; // N-004 : jamais de double fetch sur un hang
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/emails/transactional/summary?window=${windowName}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        setDegraded(null);
        router.refresh(); // l'âge se réinitialisera à l'arrivée du nouveau generatedAt
      } else if (res.status === 401 || res.status === 403) {
        setDegraded('unauthorized');
      } else {
        setDegraded('unreachable');
      }
    } catch {
      setDegraded('unreachable');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [router, windowName]);

  // Nouvelles données réellement arrivées → l'âge repart de zéro.
  useEffect(() => {
    setAgeSec(0);
  }, [generatedAt]);

  // Tick d'âge 1 s — court TOUJOURS (même onglet caché : l'âge est honnête).
  useEffect(() => {
    const ageInterval = setInterval(() => setAgeSec((s) => s + 1), AGE_TICK_MS);
    return () => clearInterval(ageInterval);
  }, []);

  // Tick refresh 60 s — suspendu onglet caché ; refresh immédiat au retour.
  // Armé via ref + deps VIDES : un effet dépendant de probeAndRefresh serait
  // désarmé/réarmé à chaque re-render (le tick d'âge re-rend chaque seconde)
  // et le compte à rebours 60 s ne s'écoulerait JAMAIS (oracle F03-C-014).
  const probeRef = useRef(probeAndRefresh);
  useEffect(() => {
    probeRef.current = probeAndRefresh;
  }, [probeAndRefresh]);
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (!document.hidden) void probeRef.current();
    }, REFRESH_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) void probeRef.current();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3 text-xs text-stone-500">
        <span role="status" aria-live="polite" data-testid="dashboard-age">
          ↻ auto · à jour il y a{' '}
          <span className="font-medium tabular-nums text-stone-700">{ageSec} s</span>{' '}
          ({timeZoneLabel(DEFAULT_TIMEZONE)})
        </span>
        <button
          type="button"
          onClick={() => void probeAndRefresh()}
          disabled={busy}
          aria-busy={busy}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Rafraîchissement…' : '↻ Rafraîchir'}
        </button>
      </div>
      {degraded ? (
        <p
          role="alert"
          data-testid="refresh-degraded-banner"
          className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
        >
          {degraded === 'unauthorized'
            ? 'Session expirée — reconnecte-toi pour rafraîchir.'
            : `Rafraîchissement impossible — données figées à ${fmtClock(generatedAt)}.`}
        </p>
      ) : null}
    </div>
  );
}
