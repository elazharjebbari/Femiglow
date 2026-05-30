'use client';

import { useState } from 'react';
import { Zap, Timer, Crown, Settings } from 'lucide-react';

/* ================================================================
   Types
   ================================================================ */

export type ModelPreset = 'auto' | 'fast' | 'premium' | 'custom';

interface ModelPresetOption {
  id: ModelPreset;
  label: string;
  description: string;
  model: string;
  icon: React.ReactNode;
}

export interface ModelPresetSelectorProps {
  value: ModelPreset;
  customModel: string;
  onPresetChange: (preset: ModelPreset) => void;
  onCustomModelChange: (model: string) => void;
}

/* ================================================================
   Presets
   ================================================================ */

const PRESETS: ModelPresetOption[] = [
  {
    id: 'auto',
    label: 'Auto',
    description: 'Meilleur rapport qualité/prix',
    model: 'glm-5.1:cloud',
    icon: <Zap size={20} />,
  },
  {
    id: 'fast',
    label: 'Rapide',
    description: 'Génération ultra-rapide',
    model: 'gpt-4o-mini',
    icon: <Timer size={20} />,
  },
  {
    id: 'premium',
    label: 'Premium',
    description: 'Qualité maximale',
    model: 'gpt-4o',
    icon: <Crown size={20} />,
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Choisir le modèle',
    model: '',
    icon: <Settings size={20} />,
  },
];

/* ================================================================
   Component
   ================================================================ */

export function ModelPresetSelector({
  value,
  customModel,
  onPresetChange,
  onCustomModelChange,
}: ModelPresetSelectorProps) {
  const [hovered, setHovered] = useState<ModelPreset | null>(null);

  return (
    <div>
      {/* ---- 2x2 Grid ---- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        {PRESETS.map((preset) => {
          const isSelected = value === preset.id;
          const isHovered = hovered === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPresetChange(preset.id)}
              onMouseEnter={() => setHovered(preset.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '12px 14px',
                border: `1px solid ${isSelected ? 'var(--cs-accent)' : 'var(--cs-border)'}`,
                borderRadius: 'var(--cs-radius)',
                background: isSelected
                  ? 'var(--cs-accent-bg)'
                  : isHovered
                    ? 'var(--cs-bg-elevated)'
                    : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--cs-accent)',
                }}
              >
                {preset.icon}
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 'var(--cs-text-sm)',
                    color: 'var(--cs-fg-primary)',
                  }}
                >
                  {preset.label}
                </span>
              </span>
              <span
                style={{
                  fontSize: 'var(--cs-text-xs)',
                  color: 'var(--cs-fg-muted)',
                  lineHeight: 1.4,
                }}
              >
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---- Custom model input ---- */}
      {value === 'custom' && (
        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            value={customModel}
            onChange={(e) => onCustomModelChange(e.target.value)}
            placeholder="ex: gpt-4-turbo, claude-3-opus..."
            aria-label="Nom du modèle personnalisé"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--cs-border)',
              borderRadius: 'var(--cs-radius-sm)',
              background: 'var(--cs-bg-base)',
              fontSize: 'var(--cs-text-sm)',
              color: 'var(--cs-fg-primary)',
              fontFamily: 'var(--cs-font-mono)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--cs-accent)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--cs-border)';
            }}
          />
        </div>
      )}
    </div>
  );
}
