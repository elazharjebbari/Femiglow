'use client';

/**
 * FrequencySettings — édition des contrôles de fréquence M5.5 :
 *  - cooldownSeconds (anti-spam même destinataire)
 *  - quietHoursEnabled + start/end/tz (plage horaire d'envoi)
 *  - dailyCap (plafond quotidien GLOBAL de l'automation — cf. frequency.ts)
 */

export type FrequencyValue = {
  cooldownSeconds: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTz: string;
  dailyCap: number | null;
};

export type FrequencySettingsProps = {
  value: FrequencyValue;
  onChange: (next: FrequencyValue) => void;
};

const COMMON_TZ = [
  'Africa/Casablanca',
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'UTC',
];

export function FrequencySettings({ value, onChange }: FrequencySettingsProps) {
  return (
    <div className="space-y-5">
      {/* Cooldown */}
      <div>
        <label className="block text-sm font-medium text-stone-700">
          Cooldown — délai mini entre 2 envois au même destinataire
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={Math.round(value.cooldownSeconds / 60)}
            onChange={(e) =>
              onChange({ ...value, cooldownSeconds: Math.max(0, Number(e.target.value)) * 60 })
            }
            className="w-32 rounded border border-stone-300 px-3 py-1.5 text-sm"
          />
          <span className="text-sm text-stone-500">minutes (0 = pas de cooldown)</span>
        </div>
      </div>

      {/* Quiet hours */}
      <div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={value.quietHoursEnabled}
            onChange={(e) => onChange({ ...value, quietHoursEnabled: e.target.checked })}
          />
          <span className="text-sm font-medium text-stone-700">
            Limiter les envois à une plage horaire
          </span>
        </label>
        {value.quietHoursEnabled && (
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs text-stone-500">Heure début</label>
              <input
                type="time"
                value={value.quietHoursStart}
                onChange={(e) => onChange({ ...value, quietHoursStart: e.target.value })}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500">Heure fin</label>
              <input
                type="time"
                value={value.quietHoursEnd}
                onChange={(e) => onChange({ ...value, quietHoursEnd: e.target.value })}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500">Fuseau</label>
              <select
                value={value.quietHoursTz}
                onChange={(e) => onChange({ ...value, quietHoursTz: e.target.value })}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              >
                {COMMON_TZ.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Daily cap — AUTO-04 : le moteur (frequency.ts checkDailyCap) plafonne
          PAR AUTOMATION entière, pas par destinataire — le libellé doit le dire. */}
      <div>
        <label className="block text-sm font-medium text-stone-700">
          Plafond d'envois par jour (global, pour cette automation)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={value.dailyCap ?? ''}
            placeholder="aucun plafond"
            onChange={(e) =>
              onChange({
                ...value,
                dailyCap: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
              })
            }
            className="w-32 rounded border border-stone-300 px-3 py-1.5 text-sm"
          />
          <span className="text-sm text-stone-500">
            envois / 24h — tous destinataires confondus
          </span>
        </div>
      </div>
    </div>
  );
}
