'use client';

import type {
  ComponentAnimation,
  ComponentAnimationBindingWithAnimation,
} from '@/lib/db/types';
import { IconCheck, IconSparkles } from '@/components/admin/icons';

interface AnimationProfileSelectorProps {
  allAnimations: ComponentAnimation[];
  bindings: ComponentAnimationBindingWithAnimation[];
  busy: boolean;
  onSelect: (animationKey: string) => void;
}

const KIND_LABEL: Record<ComponentAnimation['kind'], string> = {
  none: 'Sans animation',
  'framer-motion': 'Framer Motion',
  css: 'CSS',
  svg: 'SVG',
};

const KIND_TONE: Record<ComponentAnimation['kind'], string> = {
  none: 'bg-stone-100 text-stone-600',
  'framer-motion': 'bg-violet-100 text-violet-800',
  css: 'bg-sky-100 text-sky-800',
  svg: 'bg-emerald-100 text-emerald-800',
};

/**
 * Sélecteur d'animation compact :
 *  - tête : profil actif (nom + kind), description courte du sélectionné,
 *  - liste de pills cliquables, marqués `aria-checked`,
 *  - footer : info `prefers-reduced-motion` quand applicable.
 */
export function AnimationProfileSelector({
  allAnimations,
  bindings,
  busy,
  onSelect,
}: AnimationProfileSelectorProps) {
  const defaultBinding = bindings.find((b) => b.isDefault) ?? bindings[0] ?? null;
  const defaultKey = defaultBinding?.animation.key ?? null;
  const active = allAnimations.find((a) => a.key === defaultKey) ?? null;

  return (
    <section
      aria-labelledby="animations-heading"
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3
          id="animations-heading"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500"
        >
          <IconSparkles className="h-3.5 w-3.5" />
          Animation
        </h3>
        {busy && (
          <span className="text-[11px] text-stone-500" role="status">
            Mise à jour…
          </span>
        )}
      </header>

      {/* Profil actif — résumé visuel */}
      {active && (
        <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-stone-900">
              {active.name}
            </p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${KIND_TONE[active.kind]}`}
            >
              {KIND_LABEL[active.kind]}
            </span>
          </div>
          {active.description && (
            <p className="mt-1 line-clamp-2 text-[11px] text-stone-600">
              {active.description}
            </p>
          )}
          {active.respectsReducedMotion && (
            <p className="mt-1.5 font-mono text-[10px] text-stone-500">
              · respecte prefers-reduced-motion
            </p>
          )}
        </div>
      )}

      {allAnimations.length === 0 ? (
        <p className="mt-3 text-xs text-stone-500">
          Aucun profil d’animation disponible. Lancez un seed pour les initialiser.
        </p>
      ) : (
        <div
          className="mt-3 flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label="Profil d’animation"
        >
          {allAnimations.map((anim) => {
            const isActive = anim.key === defaultKey;
            return (
              <button
                key={anim.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={busy || isActive}
                onClick={() => onSelect(anim.key)}
                title={anim.description ?? anim.name}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                  isActive
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60'
                }`}
              >
                {isActive && <IconCheck className="h-3 w-3" />}
                <span className="truncate">{anim.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
