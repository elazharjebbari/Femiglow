'use client';

/**
 * DurationInput — input texte + chips de présets pour `within` (format
 * `<number><unit>` avec `s|m|h|d`).
 *
 * Présets cliquables : 1h, 24h, 7d, 14d, 30d, 90d.
 * Le user peut toujours taper une valeur custom.
 */
interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  presets?: string[];
}

const DEFAULT_PRESETS = ['1h', '24h', '7d', '14d', '30d', '90d'];

export function DurationInput({
  value,
  onChange,
  placeholder = '7d',
  presets = DEFAULT_PRESETS,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        pattern="^\d+[smhd]$"
        title="Format : nombre + unité (s/m/h/d). Ex: 7d, 24h, 30d."
        className="w-20 rounded border border-stone-300 px-2 py-1 text-sm"
      />
      <div className="flex flex-wrap gap-0.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition ${
              value === p
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
