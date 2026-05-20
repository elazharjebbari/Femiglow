'use client';

/**
 * CountryAutocomplete — datalist HTML5 sur les pays ISO 3166-1 alpha-2.
 * Liste statique côté client (zéro fetch). Affiche le nom + drapeau dans
 * la dropdown native.
 *
 * Supporte deux modes :
 *   - operator='eq'  → input simple, value = "MA"
 *   - operator='in'  → input multi (CSV), value = ['MA', 'FR']
 */
import { useMemo } from 'react';

const COUNTRIES: Array<{ code: string; name: string; flag: string }> = [
  { code: 'MA', name: 'Maroc', flag: '🇲🇦' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DZ', name: 'Algérie', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisie', flag: '🇹🇳' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
  { code: 'EG', name: 'Égypte', flag: '🇪🇬' },
  { code: 'AE', name: 'Émirats arabes unis', flag: '🇦🇪' },
  { code: 'SA', name: 'Arabie saoudite', flag: '🇸🇦' },
];

interface Props {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  className?: string;
}

const LIST_ID = 'fg-countries-datalist';

export function CountryAutocomplete({
  value,
  onChange,
  placeholder = 'MA',
  className = 'w-32 rounded border border-stone-300 px-2 py-1 text-sm uppercase',
}: Props) {
  // datalist is shared — render once
  const options = useMemo(
    () =>
      COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.flag} {c.name}
        </option>
      )),
    [],
  );
  return (
    <>
      <input
        type="text"
        list={LIST_ID}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        maxLength={2}
      />
      <datalist id={LIST_ID}>{options}</datalist>
    </>
  );
}
