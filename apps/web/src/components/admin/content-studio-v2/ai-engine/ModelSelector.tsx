'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { ChevronDown, Check, RefreshCw, X } from 'lucide-react';

/* ================================================================
   Types
   ================================================================ */

interface ModelEntry {
  id: string;
  role: string;
}

interface ModelSelectorProps {
  providerType: string;
  selectedModels: string[];
  onModelsChange: (models: string[]) => void;
  capabilityFilter?: string;
  disabled?: boolean;
}

type FetchSource = 'live' | 'cache' | 'fallback';

interface CachedResult {
  models: ModelEntry[];
  source: FetchSource;
}

/* ================================================================
   Role badge color mapping
   ================================================================ */

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  chat: { bg: 'var(--cs-accent-bg)', fg: 'var(--cs-accent)' },
  embedding: { bg: 'color-mix(in srgb, #6b8f71 18%, transparent)', fg: '#6b8f71' },
  tts: { bg: 'color-mix(in srgb, #c4a035 18%, transparent)', fg: '#c4a035' },
  image: { bg: 'color-mix(in srgb, #8b5cf6 18%, transparent)', fg: '#8b5cf6' },
};

const SOURCE_COLORS: Record<FetchSource, string> = {
  live: '#22c55e',
  cache: '#3b82f6',
  fallback: '#f59e0b',
};

/* ================================================================
   Component
   ================================================================ */

export function ModelSelector({
  providerType,
  selectedModels,
  onModelsChange,
  capabilityFilter,
  disabled = false,
}: ModelSelectorProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<FetchSource>('live');
  const [search, setSearch] = useState('');

  // Cache: keyed by "providerType:capabilityFilter"
  const cacheRef = useRef<Map<string, CachedResult>>(new Map());

  const cacheKey = `${providerType}:${capabilityFilter ?? ''}`;

  /* ---- Fetch models ---- */

  const fetchModels = useCallback(
    async (bypassCache: boolean = false) => {
      // Check cache first
      if (!bypassCache) {
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
          setModels(cached.models);
          setSource(cached.source);
          setError(null);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ provider: providerType });
        if (capabilityFilter) {
          params.set('capability', capabilityFilter);
        }

        const res = await fetch(
          `/api/admin/ai-engine/config/providers/models?${params.toString()}`,
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        // The API may return { models, source } or just an array
        const fetchedModels: ModelEntry[] = Array.isArray(data)
          ? data
          : Array.isArray(data.models)
            ? data.models
            : [];
        const fetchedSource: FetchSource =
          data.source === 'fallback' ? 'fallback' : 'live';

        setModels(fetchedModels);
        setSource(fetchedSource);
        setError(null);

        // Store in cache
        cacheRef.current.set(cacheKey, {
          models: fetchedModels,
          source: fetchedSource === 'live' ? 'cache' : fetchedSource,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erreur inconnue';
        setError(message);
        setSource('fallback');
        setModels([]);
      } finally {
        setLoading(false);
      }
    },
    [providerType, capabilityFilter, cacheKey],
  );

  /* ---- Fetch on open ---- */

  useEffect(() => {
    if (open) {
      void fetchModels(false);
      setSearch('');
    }
  }, [open, fetchModels]);

  /* ---- Refresh: clear cache and re-fetch ---- */

  const refreshModels = useCallback(() => {
    cacheRef.current.delete(cacheKey);
    void fetchModels(true);
  }, [cacheKey, fetchModels]);

  /* ---- Toggle model selection ---- */

  const toggleModel = useCallback(
    (modelId: string) => {
      if (selectedModels.includes(modelId)) {
        onModelsChange(selectedModels.filter((m) => m !== modelId));
      } else {
        onModelsChange([...selectedModels, modelId]);
      }
    },
    [selectedModels, onModelsChange],
  );

  /* ---- Add a custom model typed in the search box ---- */

  const addCustomModel = useCallback(
    (modelId: string) => {
      if (!selectedModels.includes(modelId)) {
        onModelsChange([...selectedModels, modelId]);
      }
      setSearch('');
    },
    [selectedModels, onModelsChange],
  );

  /* ---- Remove a badge from the trigger ---- */

  const removeModel = useCallback(
    (modelId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onModelsChange(selectedModels.filter((m) => m !== modelId));
    },
    [selectedModels, onModelsChange],
  );

  /* ---- Trim search for custom entry option ---- */

  const trimmedSearch = search.trim();
  const showCustomEntry =
    trimmedSearch.length > 0 &&
    !models.some((m) => m.id === trimmedSearch) &&
    !selectedModels.includes(trimmedSearch);

  /* ================================================================
     Render
     ================================================================ */

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* ---- Trigger ---- */}
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            padding: '6px 10px',
            minHeight: 36,
            alignItems: 'center',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-sm)',
            background: 'var(--cs-bg-base)',
            cursor: disabled ? 'default' : 'pointer',
            fontSize: 'var(--cs-text-sm)',
            color: 'var(--cs-fg-secondary)',
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? 'none' : 'auto',
            width: '100%',
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          {selectedModels.length === 0 ? (
            <span>S&eacute;lectionner des mod&egrave;les</span>
          ) : (
            selectedModels.map((modelId) => (
              <span
                key={modelId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 'var(--cs-radius-sm)',
                  background: 'var(--cs-accent-bg)',
                  color: 'var(--cs-accent)',
                  fontFamily: 'var(--cs-font-mono)',
                  fontSize: 'var(--cs-text-xs)',
                  lineHeight: 1.4,
                }}
              >
                {modelId}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Retirer ${modelId}`}
                  onClick={(e) => removeModel(modelId, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      removeModel(modelId, e as unknown as React.MouseEvent);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    opacity: 0.7,
                    marginLeft: 2,
                  }}
                >
                  <X size={10} />
                </span>
              </span>
            ))
          )}
          <ChevronDown
            size={14}
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              color: 'var(--cs-fg-muted)',
            }}
          />
        </button>
      </Popover.Trigger>

      {/* ---- Popover content ---- */}
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          style={{
            minWidth: 340,
            maxHeight: 400,
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-md)',
            boxShadow: 'var(--cs-shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 50,
            fontFamily: 'var(--cs-font-body)',
          }}
          onOpenAutoFocus={(e) => {
            // Let cmdk handle focus
            e.preventDefault();
          }}
        >
          <Command shouldFilter={true} label="Rechercher un modèle">
            {/* ---- Search input ---- */}
            <Command.Input
              placeholder="Rechercher un modèle..."
              value={search}
              onValueChange={setSearch}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                border: 'none',
                borderBottom: '1px solid var(--cs-border-hair)',
                background: 'transparent',
                fontSize: 'var(--cs-text-sm)',
                color: 'var(--cs-fg-primary)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />

            {/* ---- Model list ---- */}
            <Command.List
              style={{
                maxHeight: 300,
                overflowY: 'auto',
                padding: 4,
              }}
            >
              <Command.Empty
                style={{
                  padding: 20,
                  textAlign: 'center',
                  color: 'var(--cs-fg-muted)',
                  fontSize: 'var(--cs-text-sm)',
                }}
              >
                Aucun mod&egrave;le trouv&eacute;
              </Command.Empty>

              {loading && (
                <Command.Loading
                  style={{
                    padding: '12px 14px',
                    color: 'var(--cs-fg-muted)',
                    fontSize: 'var(--cs-text-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: '2px solid var(--cs-border)',
                      borderTopColor: 'var(--cs-accent)',
                      animation: 'cs-spin 600ms linear infinite',
                    }}
                  />
                  Chargement...
                </Command.Loading>
              )}

              {error && (
                <div
                  style={{
                    padding: '8px 12px',
                    color: '#ef4444',
                    fontSize: 'var(--cs-text-xs)',
                  }}
                >
                  Erreur : {error}
                </div>
              )}

              {models.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                const roleColor = ROLE_COLORS[model.role] ?? ROLE_COLORS['chat'] ?? { bg: 'var(--cs-accent-bg)', fg: 'var(--cs-accent)' };

                return (
                  <Command.Item
                    key={model.id}
                    value={model.id}
                    onSelect={() => toggleModel(model.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 'var(--cs-radius-sm)',
                      cursor: 'pointer',
                      fontFamily: 'var(--cs-font-mono)',
                      fontSize: 'var(--cs-text-sm)',
                      color: 'var(--cs-fg-primary)',
                    }}
                  >
                    {/* Checkmark */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 16,
                        height: 16,
                        flexShrink: 0,
                        color: isSelected
                          ? 'var(--cs-accent)'
                          : 'transparent',
                      }}
                    >
                      <Check size={14} strokeWidth={2.5} />
                    </span>

                    {/* Model name */}
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {model.id}
                    </span>

                    {/* Role badge */}
                    {model.role && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 'var(--cs-radius-sm)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          background: roleColor.bg,
                          color: roleColor.fg,
                          flexShrink: 0,
                          fontFamily: 'var(--cs-font-mono)',
                        }}
                      >
                        {model.role}
                      </span>
                    )}
                  </Command.Item>
                );
              })}

              {/* ---- Custom entry option ---- */}
              {showCustomEntry && (
                <Command.Item
                  value={`add-custom-${trimmedSearch}`}
                  onSelect={() => addCustomModel(trimmedSearch)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 'var(--cs-radius-sm)',
                    cursor: 'pointer',
                    fontSize: 'var(--cs-text-sm)',
                    color: 'var(--cs-fg-secondary)',
                    borderTop: '1px solid var(--cs-border-hair)',
                    marginTop: 4,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      color: 'var(--cs-accent)',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    +
                  </span>
                  <span>
                    Ajouter{' '}
                    <span
                      style={{
                        fontFamily: 'var(--cs-font-mono)',
                        color: 'var(--cs-fg-primary)',
                      }}
                    >
                      &laquo;&nbsp;{trimmedSearch}&nbsp;&raquo;
                    </span>
                  </span>
                </Command.Item>
              )}
            </Command.List>

            {/* ---- Footer with source indicator ---- */}
            <div
              style={{
                padding: '6px 12px',
                borderTop: '1px solid var(--cs-border-hair)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 'var(--cs-text-xs)',
                color: 'var(--cs-fg-muted)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: SOURCE_COLORS[source],
                  }}
                />
                {source === 'live'
                  ? 'Live'
                  : source === 'cache'
                    ? 'Cache'
                    : 'Statique'}
                {models.length > 0 && (
                  <span style={{ marginLeft: 4 }}>
                    ({models.length} mod&egrave;le{models.length > 1 ? 's' : ''})
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={refreshModels}
                title="Rafraîchir la liste"
                aria-label="Rafraîchir la liste des modèles"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  padding: 0,
                  border: 'none',
                  borderRadius: 'var(--cs-radius-sm)',
                  background: 'transparent',
                  color: 'var(--cs-fg-muted)',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw
                  size={12}
                  style={{
                    animation: loading
                      ? 'cs-spin 600ms linear infinite'
                      : 'none',
                  }}
                />
              </button>
            </div>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
