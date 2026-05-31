'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../primitives';

interface Props {
  /** Initial value from the URL (the parent owns the source of truth). */
  initialValue: string;
  /** Debounced (250ms) callback fired when the user stops typing. */
  onChange: (next: string) => void;
  placeholder?: string;
}

/**
 * Debounced search input (250ms). Cherche dans caption + alt média + variantLabel
 * via le filtre `searchMatches` côté parent.
 *
 * Le composant maintient son propre state local pour rester réactif au clavier
 * (sans re-render parent à chaque frappe). Quand la valeur initiale change
 * (ex. ?q= dans l'URL en arrivant), on resync.
 */
export function LibrarySearch({ initialValue, onChange, placeholder = 'Rechercher (caption, alt, variante)' }: Props) {
  const [value, setValue] = useState(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmitted = useRef(initialValue);

  // Resync when parent value (URL) changes externally — typically when the
  // user reset filters from elsewhere or navigates with the back button.
  useEffect(() => {
    if (initialValue !== lastEmitted.current) {
      setValue(initialValue);
      lastEmitted.current = initialValue;
    }
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next !== lastEmitted.current) {
        lastEmitted.current = next;
        onChange(next);
      }
    }, 250);
  }

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <Input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        leftAddon={<Search size={14} />}
        aria-label="Rechercher dans la bibliothèque"
      />
    </div>
  );
}
