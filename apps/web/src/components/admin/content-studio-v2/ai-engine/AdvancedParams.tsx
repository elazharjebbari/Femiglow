'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ModelPresetSelector } from './ModelPresetSelector';
import type { ModelPreset } from './ModelPresetSelector';

export type { ModelPreset };

/* ================================================================
   Types
   ================================================================ */

export interface AdvancedParamsProps {
  // Text model
  modelPreset: ModelPreset;
  customModel: string;
  onPresetChange: (preset: ModelPreset) => void;
  onCustomModelChange: (model: string) => void;
  // Temperature
  temperature: number;
  onTemperatureChange: (t: number) => void;
  // Max tokens
  maxTokens: number;
  onMaxTokensChange: (t: number) => void;
  // Image generation
  imageEnabled: boolean;
  onImageEnabledChange: (v: boolean) => void;
  imageModel: string;
  onImageModelChange: (m: string) => void;
  // Video generation
  videoEnabled: boolean;
  onVideoEnabledChange: (v: boolean) => void;
  videoModel: string;
  onVideoModelChange: (m: string) => void;
  // Review toggle
  reviewEnabled: boolean;
  onReviewEnabledChange: (v: boolean) => void;
}

/* ================================================================
   Toggle Switch sub-component
   ================================================================ */

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        background: checked ? 'var(--cs-accent)' : 'var(--cs-border)',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background 200ms ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 200ms ease',
        }}
      />
    </button>
  );
}

/* ================================================================
   Section helper
   ================================================================ */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label
        style={{
          display: 'block',
          fontSize: 'var(--cs-text-sm)',
          fontWeight: 600,
          color: 'var(--cs-fg-primary)',
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/* ================================================================
   Component
   ================================================================ */

export function AdvancedParams({
  modelPreset,
  customModel,
  onPresetChange,
  onCustomModelChange,
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
  imageEnabled,
  onImageEnabledChange,
  imageModel,
  onImageModelChange,
  videoEnabled,
  onVideoEnabledChange,
  videoModel,
  onVideoModelChange,
  reviewEnabled,
  onReviewEnabledChange,
}: AdvancedParamsProps) {
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        border: '1px solid var(--cs-border)',
        borderRadius: 'var(--cs-radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* ---- Collapsible header ---- */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '12px 16px',
          border: 'none',
          background: 'var(--cs-bg-elevated)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 'var(--cs-text-sm)',
          fontWeight: 600,
          color: 'var(--cs-fg-primary)',
          textAlign: 'left',
        }}
      >
        {open ? (
          <ChevronDown size={16} style={{ color: 'var(--cs-fg-muted)', flexShrink: 0 }} />
        ) : (
          <ChevronRight size={16} style={{ color: 'var(--cs-fg-muted)', flexShrink: 0 }} />
        )}
        Paramètres avancés
      </button>

      {/* ---- Panel ---- */}
      {open && (
        <div
          style={{
            padding: '20px 16px 4px',
            borderTop: '1px solid var(--cs-border-hair)',
          }}
        >
          {/* 1. Text model */}
          <Section label="Modèle texte">
            <ModelPresetSelector
              value={modelPreset}
              customModel={customModel}
              onPresetChange={onPresetChange}
              onCustomModelChange={onCustomModelChange}
            />
          </Section>

          {/* 2. Temperature */}
          <Section label="Température">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                aria-label="Température"
                style={{
                  flex: 1,
                  accentColor: 'var(--cs-accent)',
                  cursor: 'pointer',
                }}
              />
              <span
                style={{
                  minWidth: 36,
                  textAlign: 'right',
                  fontFamily: 'var(--cs-font-mono)',
                  fontSize: 'var(--cs-text-sm)',
                  color: 'var(--cs-fg-primary)',
                  fontWeight: 600,
                }}
              >
                {temperature.toFixed(1)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 4,
                fontSize: 'var(--cs-text-xs)',
                color: 'var(--cs-fg-muted)',
              }}
            >
              <span>Précis</span>
              <span>Créatif</span>
            </div>
          </Section>

          {/* 3. Max tokens */}
          <Section label="Tokens maximum">
            <input
              type="number"
              min={256}
              max={16384}
              step={256}
              value={maxTokens}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) onMaxTokensChange(v);
              }}
              aria-label="Tokens maximum"
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
          </Section>

          {/* 4. Image generation */}
          <Section label="Génération d'images">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: imageEnabled ? 10 : 0,
              }}
            >
              <span
                style={{
                  fontSize: 'var(--cs-text-sm)',
                  color: 'var(--cs-fg-secondary)',
                }}
              >
                Activer la génération d&apos;images
              </span>
              <ToggleSwitch
                checked={imageEnabled}
                onChange={onImageEnabledChange}
                ariaLabel="Activer la génération d'images"
              />
            </div>
            {imageEnabled && (
              <input
                type="text"
                value={imageModel}
                onChange={(e) => onImageModelChange(e.target.value)}
                placeholder="flux_2"
                aria-label="Modèle de génération d'images"
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
            )}
          </Section>

          {/* 5. Video generation */}
          <Section label="Génération vidéo">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: videoEnabled ? 10 : 0,
              }}
            >
              <span
                style={{
                  fontSize: 'var(--cs-text-sm)',
                  color: 'var(--cs-fg-secondary)',
                }}
              >
                Activer la génération vidéo
              </span>
              <ToggleSwitch
                checked={videoEnabled}
                onChange={onVideoEnabledChange}
                ariaLabel="Activer la génération vidéo"
              />
            </div>
            {videoEnabled && (
              <input
                type="text"
                value={videoModel}
                onChange={(e) => onVideoModelChange(e.target.value)}
                placeholder="cinematic_studio_3_0"
                aria-label="Modèle de génération vidéo"
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
            )}
          </Section>

          {/* 6. Human review (HITL) */}
          <Section label="Revue humaine (HITL)">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--cs-text-sm)',
                  color: 'var(--cs-fg-secondary)',
                  maxWidth: '70%',
                  lineHeight: 1.4,
                }}
              >
                Soumettre le contenu pour approbation avant publication
              </span>
              <ToggleSwitch
                checked={reviewEnabled}
                onChange={onReviewEnabledChange}
                ariaLabel="Activer la revue humaine"
              />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
