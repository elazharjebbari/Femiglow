'use client';

/**
 * Bouton « Copier » — utilitaire admin partagé pour copier dans le
 * presse-papier le contenu d'un payload (JSON, XML, code…).
 *
 * Pourquoi un composant dédié plutôt qu'un inline `onClick={() => …}` ?
 *  1. **Feedback transient** : on affiche "Copié ✓" pendant 1.5 s puis
 *     on revient au label initial. Sans état local, l'utilisateur ne
 *     sait pas si l'action a abouti (pas de modale, pas de toast à
 *     l'échelle de la page).
 *  2. **Fallback gracieux** : `navigator.clipboard` n'est pas garanti
 *     en HTTP non-localhost (Chrome/Safari refusent silencieusement
 *     `writeText` hors d'un contexte sécurisé). On retombe sur
 *     `document.execCommand('copy')` via une textarea hors-écran —
 *     deprecated mais largement supporté pour les vieux navigateurs
 *     d'admin (Safari iPad ancien).
 *  3. **Accessibilité** : le bouton expose `aria-live="polite"` sur le
 *     message de feedback pour qu'un lecteur d'écran annonce la
 *     copie réussie sans interrompre le flow.
 *
 * Cf. rapport CHA-225 §4.1 — l'admin manipule des feeds JSON/XML
 * volumineux et veut pouvoir les coller rapidement dans Postman /
 * Google Merchant Center.
 */
import { useCallback, useState } from 'react';

interface CopyButtonProps {
  /** Texte à copier dans le presse-papier. */
  text: string;
  /** Libellé du bouton au repos. Défaut : « Copier ». */
  label?: string;
  /** Libellé après succès. Défaut : « Copié ✓ ». */
  successLabel?: string;
  /** Optional `data-testid` pour les e2e/unit tests. */
  testId?: string;
  /** className override (les pages admin ont des contextes visuels distincts). */
  className?: string;
}

const DEFAULT_LABEL = 'Copier';
const DEFAULT_SUCCESS_LABEL = 'Copié ✓';
const FEEDBACK_DURATION_MS = 1500;

/**
 * Fallback `document.execCommand('copy')` pour les contextes non-secure.
 * Retourne `true` si la copie a réussi, `false` sinon.
 */
function fallbackCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // Hors-écran mais focusable (sinon execCommand échoue silencieusement).
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function CopyButton({
  text,
  label = DEFAULT_LABEL,
  successLabel = DEFAULT_SUCCESS_LABEL,
  testId,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const onCopy = useCallback(async () => {
    setError(false);
    let ok = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      // Tombe sur le fallback ci-dessous.
    }
    if (!ok) {
      ok = fallbackCopy(text);
    }
    if (ok) {
      setCopied(true);
      // Réinitialise le label après 1.5 s pour permettre un 2ᵉ clic.
      window.setTimeout(() => setCopied(false), FEEDBACK_DURATION_MS);
    } else {
      setError(true);
      window.setTimeout(() => setError(false), FEEDBACK_DURATION_MS);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={onCopy}
      // aria-live polite : annonce le passage à « Copié » sans
      // interrompre le flux de l'utilisateur (différent de assertive
      // qui aurait coupé une autre annonce en cours).
      aria-live="polite"
      data-testid={testId}
      className={
        className ??
        'inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700 disabled:opacity-50'
      }
    >
      {error ? 'Échec de copie' : copied ? successLabel : label}
    </button>
  );
}
