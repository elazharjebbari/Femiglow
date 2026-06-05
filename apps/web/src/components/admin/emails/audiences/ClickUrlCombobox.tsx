'use client';

/**
 * ClickUrlCombobox — autocomplétion du champ `urlPattern` de la règle
 * `email_clicked` (UX-AUD-004). Réutilise le socle a11y EntityCombobox
 * (FONDATION). Alimenté par /api/admin/emails/audiences/click-urls/autocomplete
 * (URLs de clic réellement tracées). `allowFreeText` reste à true : un pattern
 * partiel ("/promo") est valide même s'il ne correspond à aucune URL listée.
 */
import { EntityCombobox, type ComboboxOption } from '../common/EntityCombobox';

export interface ClickUrlComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ClickUrlCombobox({
  value,
  onChange,
  placeholder = '/promo',
  className,
}: ClickUrlComboboxProps) {
  return (
    <EntityCombobox
      value={value}
      onChange={onChange}
      ariaLabel="Motif d'URL de clic"
      placeholder={placeholder}
      allowFreeText
      minChars={1}
      className={className}
      fetchSuggestions={async (q, signal) => {
        const res = await fetch(
          `/api/admin/emails/audiences/click-urls/autocomplete?q=${encodeURIComponent(q)}`,
          { credentials: 'include', signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { urls: Array<{ url: string; count: number }> };
        return data.urls.map<ComboboxOption>((u) => ({
          value: u.url,
          label: u.url,
          hint: `${u.count}×`,
        }));
      }}
    />
  );
}
