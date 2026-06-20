/**
 * Banner — bandeau tonal du socle emails (charte 09 §A.2/§A.3).
 *
 * Source unique de tout bandeau de la section (dégradations honnêtes,
 * contexte, alertes). Couleurs issues d'ui/tokens.ts (TONE.subtle + TONE_BORDER,
 * verrou G10). `role` selon sévérité : `alert` pour danger, `status` sinon
 * (annonce non intrusive). Slots icône / corps / action. data-tone exposé.
 */
import type { ReactNode } from 'react';
import { RADIUS, TONE, TONE_BORDER, type Tone } from './tokens';

export type BannerProps = {
  tone?: Tone;
  icon?: ReactNode;
  /** Action à droite (lien/bouton de reprise). */
  action?: ReactNode;
  /** Force le role ; par défaut `alert` si tone=danger, sinon `status`. */
  role?: 'alert' | 'status';
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'role'>;

export function Banner({
  tone = 'info',
  icon,
  action,
  role,
  className = '',
  children,
  ...rest
}: BannerProps) {
  const resolvedRole = role ?? (tone === 'danger' ? 'alert' : 'status');
  return (
    <div
      {...rest}
      role={resolvedRole}
      data-tone={tone}
      className={`flex items-center justify-between gap-3 border ${RADIUS.card} ${TONE_BORDER[tone]} ${TONE[tone].subtle} px-3 py-2 text-xs ${className}`}
    >
      <span className="flex items-center gap-2">
        {icon ? (
          <span aria-hidden="true" className="shrink-0">
            {icon}
          </span>
        ) : null}
        <span>{children}</span>
      </span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}
