'use client';

/**
 * Input prix « unité majeure » avec suffixe devise.
 *
 * Le state interne reste une chaîne pour permettre la saisie progressive
 * (ex. « 29. » avant d'écrire les décimales). La conversion vers/depuis les
 * centimes est faite explicitement par le parent au moyen des helpers
 * `centsToMajor()` / `majorToCents()` exposés par `lib/products/currency`.
 *
 * Pourquoi un composant dédié ?
 *  - centraliser le formatage (point/virgule, nombre de décimales selon la
 *    devise) pour qu'il soit homogène entre la création et l'édition,
 *  - afficher le code devise à droite du champ pour réduire les erreurs
 *    de saisie,
 *  - exposer un message d'aide quand la valeur dépasse une borne (utile
 *    pour la validation `promo < prix`).
 */

import { useEffect, useId, useState } from 'react';
import { centsToMajor, describeCurrency } from '@/lib/products/currency';

export interface VariantPriceInputProps {
  /** Libellé visible (ex. « Prix », « Promo »). */
  label: string;
  /** Devise actuelle de la variante — détermine le formatage. */
  currency: string;
  /**
   * Valeur en centimes. `null` autorise « pas de promo » et rend le champ
   * vide. Un changement externe de cents (ex. devise modifiée) ré-aligne
   * le state interne via useEffect.
   */
  cents: number | null;
  /** Callback : reçoit la valeur convertie en centimes (`null` si vide). */
  onChange: (nextCents: number | null) => void;
  /** Indique que le champ est facultatif (placeholder « — »). */
  optional?: boolean;
  /** Affiché sous l'input (info / erreur soft, ex. « doit être < prix »). */
  hint?: string | null;
  /** Variante d'erreur : encadre l'input en rose. */
  invalid?: boolean;
  /** Désactive l'input pendant un fetch. */
  disabled?: boolean;
}

export function VariantPriceInput({
  label,
  currency,
  cents,
  onChange,
  optional = false,
  hint = null,
  invalid = false,
  disabled = false,
}: VariantPriceInputProps) {
  const id = useId();
  const desc = describeCurrency(currency);
  const [text, setText] = useState<string>(() => centsToMajor(cents, currency));

  // Synchronise le state interne quand la valeur cents OU la devise change
  // côté parent (ex. l'utilisateur change la devise du draft : on reformate
  // la chaîne avec le bon nombre de décimales).
  useEffect(() => {
    setText(centsToMajor(cents, currency));
  }, [cents, currency]);

  function commit(raw: string) {
    setText(raw);
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const normalized = raw.replace(',', '.');
    const value = Number(normalized);
    if (!Number.isFinite(value) || value < 0) {
      // Saisie partielle (« 29. ») : on ne propage rien, on conserve juste
      // le texte interne. Le parent garde la dernière valeur cents valide.
      return;
    }
    const cts = Math.round(value * Math.pow(10, desc.fractionDigits));
    onChange(cts);
  }

  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs">
      <span className="font-medium uppercase tracking-wide text-stone-500">
        {label}
        {optional ? <span className="ml-1 text-stone-400">(opt.)</span> : null}
      </span>
      <span
        className={`flex items-stretch overflow-hidden rounded-md border bg-white text-sm ${
          invalid ? 'border-red-300' : 'border-stone-200'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => {
            // Reformate proprement à la perte de focus si la valeur est valide.
            if (cents !== null) setText(centsToMajor(cents, currency));
          }}
          disabled={disabled}
          placeholder={optional ? '—' : '0'}
          className="min-w-0 flex-1 bg-transparent px-2 py-1 outline-none"
          aria-invalid={invalid}
        />
        <span
          className="flex items-center bg-stone-50 px-2 font-mono text-xs uppercase text-stone-600"
          aria-label={`Devise ${desc.code}`}
        >
          {desc.code}
        </span>
      </span>
      {hint ? (
        <span className={`text-xs ${invalid ? 'text-red-700' : 'text-stone-500'}`}>{hint}</span>
      ) : null}
    </label>
  );
}
