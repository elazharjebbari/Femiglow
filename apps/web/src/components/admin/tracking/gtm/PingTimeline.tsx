type Day = {
  day: string;
  pingsCount: number;
  driftDetected: boolean;
};

type Props = {
  days: Day[];
};

export function PingTimeline({ days }: Props) {
  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
        Aucun ping reçu pour le moment. Cela peut prendre quelques minutes après le premier import GTM publié.
      </div>
    );
  }
  const max = Math.max(...days.map((d) => d.pingsCount), 1);
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  return (
    <div data-testid="ping-timeline" className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">Pings reçus / jour</h3>
      <div className="mt-3 flex items-end gap-0.5" style={{ height: 80 }}>
        {sorted.map((d) => {
          const h = Math.max(2, Math.round((d.pingsCount / max) * 100));
          const color = d.driftDetected ? 'bg-amber-400' : 'bg-emerald-500';
          return (
            <div
              key={d.day}
              title={`${d.day} — ${d.pingsCount} pings${d.driftDetected ? ' (drift)' : ''}`}
              className={`flex-1 rounded-sm ${color}`}
              style={{ height: `${h}%`, minWidth: 4 }}
            />
          );
        })}
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Total {sorted.reduce((s, d) => s + d.pingsCount, 0).toLocaleString('fr-FR')} pings sur {sorted.length} jours.
      </p>
    </div>
  );
}
