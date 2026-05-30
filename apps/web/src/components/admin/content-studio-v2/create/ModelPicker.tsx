'use client';

import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { ChevronDown, Sparkles, Search, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContentFormat } from '@/lib/content-studio/types';
import type { ModelEntry, ProviderInfo, ModelRole } from '@/lib/content-studio-v2/models/registry';

interface ModelPickerProps {
  /** What kind of model to pick. Drives the API query and the registry filter. */
  role: ModelRole;
  /** Optional format hint — used to highlight the recommended model. */
  format?: ContentFormat;
  /** Currently selected model id, or null to fall back to the suggested default. */
  value: string | null;
  onChange: (modelId: string | null) => void;
  /** Allow free-text custom model id input. */
  allowCustom?: boolean;
  /** Disable the picker entirely (e.g. mid-generation). */
  disabled?: boolean;
  /** Stable testid for E2E targeting. */
  testId?: string;
}

interface ModelsResponse {
  models: ModelEntry[];
  suggested: ModelEntry | null;
  providers: ProviderInfo[];
}

const TIER_LABEL: Record<string, string> = {
  fast: 'Rapide',
  balanced: 'Équilibré',
  premium: 'Premium',
};

function formatCost(m: ModelEntry): string {
  const p = m.pricing;
  if (p.perCall !== undefined) return p.perCall === 0 ? 'gratuit' : `${p.perCall}¢/appel`;
  if (p.inputCentsPer1k !== undefined && p.outputCentsPer1k !== undefined) {
    return `${p.inputCentsPer1k}¢ / ${p.outputCentsPer1k}¢ /1k`;
  }
  return '';
}

export function ModelPicker({
  role,
  format,
  value,
  onChange,
  allowCustom = true,
  disabled = false,
  testId,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [suggested, setSuggested] = useState<ModelEntry | null>(null);
  const [source, setSource] = useState<'static' | 'cache' | 'live'>('static');
  const [loading, setLoading] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const cacheRef = useRef<Map<string, ModelsResponse>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const cacheKey = `${role}:${format ?? ''}`;

  const fetchModels = useCallback(async () => {
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setModels(cached.models);
      setSuggested(cached.suggested);
      setSource('cache');
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ role });
      if (format) qs.set('format', format);
      const res = await fetch(`/api/admin/content-studio/models?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ModelsResponse;
      setModels(json.models);
      setSuggested(json.suggested);
      setSource(json.models[0]?.source ?? 'static');
      cacheRef.current.set(cacheKey, json);
    } catch {
      // Graceful: keep prior state, ModelPicker just shows empty list
    } finally {
      setLoading(false);
    }
  }, [role, format, cacheKey]);

  useEffect(() => {
    if (!open) return;
    void fetchModels();
  }, [open, fetchModels]);

  // Fetch eagerly when role/format changes so the suggested model is known
  // even if the operator never opens the picker. Required so MediaStudio can
  // send `body.model = suggested.id` instead of letting it be undefined (which
  // would lead the backend to fall back to env-default in live mode).
  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  // When format changes externally, invalidate the displayed suggestion lazily
  useEffect(() => {
    setSuggested(null);
  }, [format]);

  // Auto-select the suggested model when value is null and a suggestion arrives,
  // so the parent component always has a concrete model id to forward to the API.
  useEffect(() => {
    if (value === null && suggested) {
      onChange(suggested.id);
    }
  }, [value, suggested, onChange]);

  const current = models.find((m) => m.id === value) ?? null;
  const triggerLabel = current?.label ?? (value ?? (suggested?.label ?? 'Choisir un modèle…'));
  // ACT-UX-001 — l'étiquette de source de l'en-tête reflète le modèle RÉELLEMENT
  // retenu (sélectionné, sinon suggéré), pas `models[0]` : sur une liste à
  // sources mixtes (OpenAI live + Higgsfield statique), un label global figé
  // sur le 1er modèle mentait sur ce que l'opérateur va vraiment utiliser.
  const effectiveSource: 'static' | 'cache' | 'live' =
    current?.source ?? suggested?.source ?? source;

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const handleCustomSubmit = () => {
    const v = (customInput || searchQuery).trim();
    if (!v) return;
    onChange(v);
    setCustomInput('');
    setSearchQuery('');
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid={testId ?? `model-picker-${role}`}
          data-role={role}
          aria-haspopup="listbox"
          aria-expanded={open}
          onKeyDown={(e) => {
            // Type-ahead : printable keys ouvrent le popover ET pré-remplissent
            // la recherche, comme une vraie barre d'autocompletion.
            if (
              !disabled &&
              !open &&
              e.key.length === 1 &&
              !e.metaKey &&
              !e.ctrlKey &&
              !e.altKey
            ) {
              e.preventDefault();
              setSearchQuery(e.key);
              setOpen(true);
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            width: '100%',
            padding: '8px 12px',
            background: 'var(--cs-bg-base)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-sm)',
            fontFamily: 'var(--cs-font-body)',
            fontSize: 'var(--cs-text-sm)',
            color: 'var(--cs-fg-primary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            textAlign: 'left',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {triggerLabel}
          </span>
          <ChevronDown size={14} aria-hidden style={{ flexShrink: 0, opacity: 0.6 }} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => {
            // Redirect focus to the search input so the operator can type
            // immediately to filter — this is what makes the picker feel like
            // an autocompletion rather than a static list.
            e.preventDefault();
            requestAnimationFrame(() => searchInputRef.current?.focus());
          }}
          style={{
            width: 380,
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-md)',
            boxShadow: 'var(--cs-shadow-md)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          {/* Header : source + counter */}
          <div
            style={{
              padding: '6px 12px',
              fontSize: 10,
              color: 'var(--cs-fg-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--cs-border-hair)',
            }}
          >
            <span data-cs-model-picker-source style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {effectiveSource === 'live' ? '● Live' : effectiveSource === 'cache' ? '◐ Cache' : '◯ Statique'}
            </span>
            <span data-cs-model-picker-count style={{ fontFamily: 'var(--cs-font-mono, ui-monospace)' }}>
              {loading ? 'Chargement…' : `${models.length} modèle${models.length > 1 ? 's' : ''}`}
            </span>
          </div>

          <Command
            label="Choisir un modèle"
            shouldFilter
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 440,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 12px',
                borderBottom: '1px solid var(--cs-border-hair)',
                background: 'var(--cs-bg-sunken)',
              }}
            >
              <Search size={14} aria-hidden style={{ color: 'var(--cs-fg-muted)' }} />
              <Command.Input
                ref={searchInputRef}
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Tapez pour filtrer : gpt-image-2, flux, sonnet…"
                data-testid="model-picker-search"
                autoFocus
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 'var(--cs-text-sm)',
                  fontFamily: 'var(--cs-font-body)',
                  color: 'var(--cs-fg-primary)',
                }}
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--cs-fg-muted)',
                    cursor: 'pointer',
                    padding: 2,
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>

            <Command.List
              style={{
                overflowY: 'auto',
                maxHeight: 340,
                padding: 6,
              }}
            >
              <Command.Empty
                style={{ padding: 16, fontSize: 12, color: 'var(--cs-fg-muted)', textAlign: 'center' }}
              >
                {searchQuery ? (
                  <>
                    Aucun modèle ne correspond à « <strong>{searchQuery}</strong> ».
                    {allowCustom ? (
                      <>
                        <br />
                        <span style={{ fontSize: 11 }}>
                          Vous pouvez ajouter « {searchQuery} » comme modèle custom ci-dessous.
                        </span>
                      </>
                    ) : null}
                  </>
                ) : (
                  'Aucun modèle disponible'
                )}
              </Command.Empty>

              {suggested ? (
                <Command.Group
                  heading={
                    <span style={groupHeadingStyle}>
                      <Sparkles size={11} aria-hidden style={{ marginRight: 4 }} />
                      Recommandé{format ? ` pour ${format}` : ''}
                    </span>
                  }
                >
                  <ModelItem
                    model={suggested}
                    selected={value === suggested.id}
                    onSelect={() => handleSelect(suggested.id)}
                  />
                </Command.Group>
              ) : null}

              {/* Group items by provider when there's > 8 models, otherwise keep flat. */}
              {(() => {
                const others = models.filter((m) => m.id !== suggested?.id);
                if (others.length === 0) return null;
                if (others.length <= 8) {
                  return (
                    <Command.Group heading={<span style={groupHeadingStyle}>Autres modèles</span>}>
                      {others.map((m) => (
                        <ModelItem
                          key={m.id}
                          model={m}
                          selected={value === m.id}
                          onSelect={() => handleSelect(m.id)}
                        />
                      ))}
                    </Command.Group>
                  );
                }
                // Group by provider for readability when the live discovery
                // returns many models.
                const byProvider = new Map<string, ModelEntry[]>();
                for (const m of others) {
                  const arr = byProvider.get(m.provider) ?? [];
                  arr.push(m);
                  byProvider.set(m.provider, arr);
                }
                const providerOrder = ['openai', 'anthropic', 'higgsfield', 'google', 'mock'];
                const sortedProviders = Array.from(byProvider.keys()).sort(
                  (a, b) => providerOrder.indexOf(a) - providerOrder.indexOf(b),
                );
                return sortedProviders.map((prov) => (
                  <Command.Group
                    key={prov}
                    heading={
                      <span style={groupHeadingStyle}>
                        {prov} · {byProvider.get(prov)!.length}
                      </span>
                    }
                  >
                    {byProvider.get(prov)!.map((m) => (
                      <ModelItem
                        key={m.id}
                        model={m}
                        selected={value === m.id}
                        onSelect={() => handleSelect(m.id)}
                      />
                    ))}
                  </Command.Group>
                ));
              })()}

              {allowCustom ? (
                <Command.Group heading={<span style={groupHeadingStyle}>Ajouter un id custom</span>}>
                  <div style={{ padding: '4px 8px', display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={customInput || searchQuery}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="ex. gpt-image-2, claude-opus-4-7…"
                      aria-label="Identifiant de modèle custom"
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: 'var(--cs-bg-base)',
                        border: '1px solid var(--cs-border)',
                        borderRadius: 'var(--cs-radius-sm)',
                        fontSize: 12,
                        color: 'var(--cs-fg-primary)',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCustomSubmit();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCustomSubmit}
                      disabled={!customInput.trim()}
                      data-testid="model-picker-custom-add"
                      style={{
                        padding: '6px 8px',
                        background: customInput.trim() ? 'var(--cs-accent)' : 'var(--cs-bg-sunken)',
                        color: customInput.trim() ? 'var(--cs-fg-on-accent, #fff)' : 'var(--cs-fg-muted)',
                        border: 'none',
                        borderRadius: 'var(--cs-radius-sm)',
                        cursor: customInput.trim() ? 'pointer' : 'not-allowed',
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Plus size={12} /> Ajouter
                    </button>
                  </div>
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const groupHeadingStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--cs-fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '8px 8px 4px',
};

function ModelItem({
  model,
  selected,
  onSelect,
}: {
  model: ModelEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const cost = formatCost(model);
  return (
    <Command.Item
      value={`${model.id} ${model.label} ${model.provider} ${model.tier}`}
      onSelect={onSelect}
      data-testid={`model-picker-item-${model.id}`}
      data-selected={selected ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 10px',
        borderRadius: 'var(--cs-radius-sm)',
        cursor: 'pointer',
        background: selected ? 'var(--cs-accent-bg)' : 'transparent',
        outline: 'none',
      }}
      className="cs-cmdk-item"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: selected ? 'var(--cs-accent)' : 'var(--cs-fg-primary)',
          }}
        >
          {model.label}
        </span>
        <span
          aria-label={`Tier ${model.tier}`}
          style={{
            padding: '2px 6px',
            borderRadius: 'var(--cs-radius-full)',
            background: 'var(--cs-bg-sunken)',
            color: 'var(--cs-fg-muted)',
            fontSize: 10,
            fontFamily: 'var(--cs-font-mono)',
          }}
        >
          {TIER_LABEL[model.tier] ?? model.tier}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--cs-fg-muted)', alignItems: 'center' }}>
        <span>{model.provider}</span>
        {cost ? <span>· {cost}</span> : null}
        {model.source === 'live' ? (
          <span
            data-cs-model-source-badge
            title="Modèle découvert via l'API live du provider"
            style={{
              marginLeft: 'auto',
              padding: '1px 6px',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.05em',
              background: 'var(--cs-success-bg, #ecfdf5)',
              color: 'var(--cs-success, #047857)',
              borderRadius: 'var(--cs-radius-full)',
              textTransform: 'uppercase',
            }}
          >
            Live
          </span>
        ) : null}
      </div>
    </Command.Item>
  );
}
