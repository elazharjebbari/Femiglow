'use client';

import { useId, useRef, type KeyboardEvent } from 'react';

export type GtmEnv = 'production' | 'stage' | 'preview' | 'dev';

const ENVS: GtmEnv[] = ['production', 'stage', 'preview', 'dev'];

const ENV_LABELS: Record<GtmEnv, { label: string; pixelsHint: string }> = {
  production: { label: 'Production', pixelsHint: '6 pixels' },
  stage: { label: 'Stage', pixelsHint: 'GA4 seul' },
  preview: { label: 'Preview', pixelsHint: 'GA4 seul' },
  dev: { label: 'Dev local', pixelsHint: 'aucun pixel' },
};

interface Props {
  value: GtmEnv;
  onChange: (env: GtmEnv) => void;
  disabled?: boolean;
}

export function GtmEnvTabs({ value, onChange, disabled }: Props) {
  const groupId = useId();
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    let next = idx;
    if (e.key === 'ArrowLeft') next = (idx - 1 + ENVS.length) % ENVS.length;
    if (e.key === 'ArrowRight') next = (idx + 1) % ENVS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = ENVS.length - 1;
    const target = ENVS[next];
    if (!target) return;
    onChange(target);
    tabsRef.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Environnement de génération"
      aria-orientation="horizontal"
      className="inline-flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1"
    >
      {ENVS.map((env, idx) => {
        const isActive = env === value;
        return (
          <button
            key={env}
            ref={(el) => {
              tabsRef.current[idx] = el;
            }}
            role="tab"
            id={`${groupId}-${env}`}
            aria-selected={isActive}
            aria-controls={`${groupId}-${env}-panel`}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            type="button"
            onClick={() => onChange(env)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={`group relative inline-flex items-baseline gap-2 rounded-md px-3 py-1.5 text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:opacity-50 ${
              isActive
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:bg-white/60 hover:text-stone-900'
            }`}
          >
            <span className="font-medium">{ENV_LABELS[env].label}</span>
            <span
              className={`text-[10px] uppercase tracking-wide transition-colors duration-150 ${
                isActive ? 'text-stone-500' : 'text-stone-400 group-hover:text-stone-500'
              }`}
            >
              {ENV_LABELS[env].pixelsHint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function envBadge(env: GtmEnv): { label: string; classes: string } {
  switch (env) {
    case 'production':
      return {
        label: 'Production',
        classes: 'bg-[#A8C4A6]/15 text-[#3F5B41] border-[#A8C4A6]/40',
      };
    case 'stage':
      return {
        label: 'Stage',
        classes: 'bg-[#C8A876]/15 text-[#7A6940] border-[#C8A876]/40',
      };
    case 'preview':
      return {
        label: 'Preview',
        classes: 'bg-[#7AA8C0]/15 text-[#3D6679] border-[#7AA8C0]/40',
      };
    case 'dev':
      return {
        label: 'Dev local',
        classes: 'bg-stone-200 text-stone-700 border-stone-300',
      };
  }
}
