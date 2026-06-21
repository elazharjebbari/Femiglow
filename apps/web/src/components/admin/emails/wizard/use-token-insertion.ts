'use client';

/**
 * useTokenInsertion — insertion d'un merge-tag à la position du curseur dans un
 * <input>/<textarea> CONTRÔLÉ (F05 P3.2-c3, G11).
 *
 * Lit la sélection live du DOM via une ref, calcule la nouvelle valeur (pur
 * `insertToken`), la pousse dans l'état React, puis restaure focus + curseur
 * après le re-render (un champ contrôlé replace sinon le curseur en fin).
 */
import { useCallback, useRef } from 'react';
import { insertToken } from '@/lib/mail/campaigns/merge-tags';

export function useTokenInsertion<T extends HTMLInputElement | HTMLTextAreaElement>(
  setValue: (next: string) => void,
) {
  const ref = useRef<T | null>(null);

  const insert = useCallback(
    (token: string) => {
      const el = ref.current;
      const current = el?.value ?? '';
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const { value, cursor } = insertToken(current, start, end, token);
      setValue(value);
      if (el && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(cursor, cursor);
        });
      }
    },
    [setValue],
  );

  return { ref, insert };
}
