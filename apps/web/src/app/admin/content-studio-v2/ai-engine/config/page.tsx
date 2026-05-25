'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Cpu,
  GitBranch,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Zap,
  RefreshCw,
  ChevronRight,
  Hash,
  Star,
  Eye,
  BarChart3,
  BookOpen,
  Activity,
  Wallet,
  Layers,
  PenTool,
  ArrowRight,
  CircleDot,
  Power,
} from 'lucide-react';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { Badge } from '@/components/admin/content-studio-v2/primitives';

interface ProviderModel {
  name: string;
  capability: string;
  costPer1MInput?: number;
  costPer1MOutput?: number;
  costPerUnit?: number;
}

interface ProviderData {
  id: string;
  providerType: string;
  name: string;
  apiKeyEnvVar: string;
  baseUrl: string | null;
  capabilities: string[];
  models: ProviderModel[];
  rateLimitRpm: number | null;
  dailyBudgetCents: number | null;
  circuitBreakerConfig: { failureThreshold: number; resetTimeoutMs: number; halfOpenMaxCalls: number } | null;
  priority: number;
  isFallback: boolean;
  isEnabled: boolean;
  healthStatus: string;
  lastHealthCheck: string | null;
  configured: boolean;
}

interface WorkflowData {
  id: string;
  name: string;
  description: string | null;
  platform: string | null;
  format: string | null;
  graphConfig: { nodes?: string[]; edges?: string[][] };
  defaultTone: string;
  defaultLanguage: string;
  qualityThreshold: string;
  maxRetries: number;
  maxBudgetCents: number;
  humanReviewRequired: boolean;
  autoPublish: boolean;
  providerOverrides: unknown;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptData {
  id: string;
  nodeName: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  version: number;
  isActive: boolean;
  parentId: string | null;
  avgQualityScore: string | null;
  usageCount: number;
  createdAt: string;
}

type Tab = 'providers' | 'workflows' | 'prompts';

const CAPABILITY_COLORS: Record<string, string> = {
  text: 'var(--cs-accent)',
  image: 'var(--cs-saffron)',
  video: 'var(--cs-violet)',
  tts: 'var(--cs-sage)',
  stt: 'var(--cs-sage)',
  embedding: 'var(--cs-clay)',
  moderation: 'var(--cs-danger)',
  vision: 'var(--cs-violet)',
  music: 'var(--cs-saffron)',
};

const CAPABILITY_LABELS: Record<string, string> = {
  text: 'Texte',
  image: 'Image',
  video: 'Vidéo',
  tts: 'Voix',
  stt: 'STT',
  embedding: 'Embed',
  moderation: 'Modération',
  vision: 'Vision',
  music: 'Musique',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
};

const NODE_LABELS: Record<string, string> = {
  brief_analysis: 'Brief',
  script_writer: 'Script',
  image_gen: 'Image',
  caption_gen: 'Caption',
  quality_gate: 'Qualité',
  tts_gen: 'TTS',
  video_gen: 'Vidéo',
};

function StatCard({ icon, value, label, accent }: { icon: React.ReactNode; value: string | number; label: string; accent?: string }) {
  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '20px 22px',
        boxShadow: 'var(--cs-shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--cs-radius)',
          background: accent ? `${accent}18` : 'var(--cs-bg-sunken)',
          color: accent ?? 'var(--cs-accent)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <div style={{ fontFamily: 'var(--cs-font-display)', fontSize: 'var(--cs-text-xl)', fontWeight: 600, lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  onTestConnection,
  testing,
}: {
  provider: ProviderData;
  onTestConnection: (id: string) => void;
  testing: boolean;
}) {
  const models = Array.isArray(provider.models) ? (provider.models as ProviderModel[]) : [];
  const maxModels = 3;
  const visibleModels = models.slice(0, maxModels);
  const hiddenCount = models.length - maxModels;

  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: `1px solid ${provider.configured ? 'var(--cs-border-hair)' : 'var(--cs-border)'}`,
        borderRadius: 'var(--cs-radius-md)',
        padding: 0,
        boxShadow: 'var(--cs-shadow-sm)',
        overflow: 'hidden',
        opacity: provider.isEnabled ? 1 : 0.55,
        transition: 'all var(--cs-motion-base) var(--cs-easing)',
      }}
    >
      {/* Status bar top */}
      <div
        style={{
          height: 3,
          background: provider.configured
            ? provider.healthStatus === 'healthy' ? 'var(--cs-success)' : provider.healthStatus === 'degraded' ? 'var(--cs-warning)' : 'var(--cs-danger)'
            : 'var(--cs-border)',
          transition: 'background var(--cs-motion-base) var(--cs-easing)',
        }}
      />

      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--cs-radius)',
                  background: provider.configured ? 'var(--cs-accent-bg)' : 'var(--cs-bg-sunken)',
                  color: provider.configured ? 'var(--cs-accent)' : 'var(--cs-fg-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 18,
                }}
              >
                <Cpu size={20} />
              </span>
              {/* Live dot indicator */}
              <span
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 10,
                  height: 10,
                  borderRadius: 'var(--cs-radius-full)',
                  border: '2px solid var(--cs-bg-elevated)',
                  background: provider.configured ? 'var(--cs-success)' : 'var(--cs-fg-muted)',
                }}
              />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-base)' }}>
                {provider.name}
              </div>
              <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                <span>Priorité {provider.priority}</span>
                {provider.isFallback && (
                  <Badge tone="warning" size="sm">fallback</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Enable toggle visual */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--cs-radius-full)',
              background: provider.configured ? 'var(--cs-success-bg)' : 'var(--cs-bg-sunken)',
              fontSize: 'var(--cs-text-xs)',
              fontWeight: 500,
              color: provider.configured ? 'var(--cs-success)' : 'var(--cs-fg-muted)',
            }}
          >
            <CircleDot size={10} />
            {provider.configured ? 'Actif' : 'Inactif'}
          </div>
        </div>

        {/* Capabilities row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {provider.capabilities.map((cap) => {
            const color = CAPABILITY_COLORS[cap] ?? 'var(--cs-fg-muted)';
            return (
              <span
                key={cap}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 8px',
                  borderRadius: 'var(--cs-radius-sm)',
                  background: `color-mix(in srgb, ${color} 10%, transparent)`,
                  color,
                  fontSize: 'var(--cs-text-xs)',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}
              >
                {CAPABILITY_LABELS[cap] ?? cap}
              </span>
            );
          })}
        </div>

        {/* Models */}
        {visibleModels.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {visibleModels.map((m, i) => (
              <div
                key={m.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 0',
                  borderTop: i === 0 ? '1px solid var(--cs-border-hair)' : 'none',
                  borderBottom: '1px solid var(--cs-border-hair)',
                }}
              >
                <span style={{ fontFamily: 'var(--cs-font-mono)', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-primary)', fontWeight: 500 }}>
                  {m.name}
                </span>
                <span style={{ fontFamily: 'var(--cs-font-mono)', fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
                  {m.costPerUnit != null
                    ? `${(m.costPerUnit / 100).toFixed(0)}c/u`
                    : m.costPer1MInput != null
                      ? `${m.costPer1MInput}c/1M`
                      : '—'}
                </span>
              </div>
            ))}
            {hiddenCount > 0 && (
              <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', padding: '5px 0', fontStyle: 'italic' }}>
                + {hiddenCount} autres modèles
              </div>
            )}
          </div>
        )}

        {/* Footer: budget + test */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
            {provider.dailyBudgetCents != null && provider.dailyBudgetCents > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Shield size={10} />
                {(provider.dailyBudgetCents / 100).toFixed(2)} MAD/j
              </span>
            )}
            {provider.rateLimitRpm && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Zap size={10} />
                {provider.rateLimitRpm}/min
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={11} className={testing ? 'cs-spin' : ''} />}
            onClick={() => onTestConnection(provider.id)}
            disabled={testing || !provider.configured}
            style={{ opacity: provider.configured ? 1 : 0.4 }}
          >
            Tester
          </Button>
        </div>
      </div>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowData }) {
  const nodes = workflow.graphConfig?.nodes ?? [];
  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '20px 24px',
        boxShadow: 'var(--cs-shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-base)' }}>
            {workflow.name}
          </div>
          {workflow.description && (
            <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', marginTop: 2 }}>
              {workflow.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {workflow.isActive ? (
            <Badge tone="success" size="sm">Actif</Badge>
          ) : (
            <Badge tone="neutral" size="sm">Inactif</Badge>
          )}
          <Badge tone="accent" size="sm">v{workflow.version}</Badge>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-secondary)' }}>
        {workflow.platform && <span style={{ fontWeight: 500 }}>{PLATFORM_LABELS[workflow.platform] ?? workflow.platform}</span>}
        {workflow.format && <span style={{ textTransform: 'capitalize' }}>{workflow.format}</span>}
        <span>Qualité ≥ {(parseFloat(workflow.qualityThreshold) * 100).toFixed(0)}%</span>
        <span>Budget: {(workflow.maxBudgetCents / 100).toFixed(2)} MAD</span>
        <span>Retries: {workflow.maxRetries}</span>
      </div>

      {nodes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          {nodes.map((node, i) => (
            <span key={node} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--cs-radius-sm)',
                  background: 'var(--cs-bg-sunken)',
                  fontSize: 'var(--cs-text-xs)',
                  fontWeight: 500,
                  color: 'var(--cs-fg-secondary)',
                }}
              >
                {NODE_LABELS[node] ?? node}
              </span>
              {i < nodes.length - 1 && <ArrowRight size={10} style={{ color: 'var(--cs-fg-muted)' }} />}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Eye size={10} /> HITL: {workflow.humanReviewRequired ? 'Requis' : 'Auto'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Power size={10} /> Publication: {workflow.autoPublish ? 'Auto' : 'Manuelle'}
        </span>
      </div>
    </div>
  );
}

function PromptCard({ prompt }: { prompt: PromptData }) {
  const truncated = prompt.systemPrompt.length > 200 ? prompt.systemPrompt.slice(0, 200) + '…' : prompt.systemPrompt;
  const qualityPct = prompt.avgQualityScore ? Math.round(parseFloat(prompt.avgQualityScore) * 100) : null;

  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '20px 24px',
        boxShadow: 'var(--cs-shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-base)' }}>
            {prompt.name}
          </div>
          <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--cs-font-mono)' }}>{prompt.nodeName}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {prompt.isActive ? (
            <Badge tone="success" size="sm">Active</Badge>
          ) : (
            <Badge tone="neutral" size="sm">Inactive</Badge>
          )}
          <Badge tone="accent" size="sm">v{prompt.version}</Badge>
        </div>
      </div>

      <div
        style={{
          fontSize: 'var(--cs-text-xs)',
          color: 'var(--cs-fg-secondary)',
          lineHeight: 1.55,
          padding: '10px 12px',
          background: 'var(--cs-bg-sunken)',
          borderRadius: 'var(--cs-radius-sm)',
          fontFamily: 'var(--cs-font-mono)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 80,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {truncated}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 24, background: 'linear-gradient(transparent, var(--cs-bg-sunken))' }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {prompt.variables.slice(0, 5).map((v) => (
          <span
            key={v}
            style={{
              padding: '2px 7px',
              borderRadius: 'var(--cs-radius-sm)',
              background: 'var(--cs-warning-bg)',
              color: 'var(--cs-saffron)',
              fontSize: 10,
              fontWeight: 500,
              fontFamily: 'var(--cs-font-mono)',
            }}
          >
            {'{' + v + '}'}
          </span>
        ))}
        {prompt.variables.length > 5 && (
          <span style={{ fontSize: 10, color: 'var(--cs-fg-muted)' }}>+{prompt.variables.length - 5}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {qualityPct !== null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Star size={10} style={{ color: 'var(--cs-saffron)' }} />
              <span style={{ color: 'var(--cs-fg-secondary)', fontWeight: 500 }}>{qualityPct}%</span>
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Zap size={10} />
            {prompt.usageCount} utilisations
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description, cta }: { icon: React.ReactNode; title: string; description: string; cta?: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px dashed var(--cs-border)',
        borderRadius: 'var(--cs-radius-lg)',
        padding: '56px 32px',
        textAlign: 'center',
        boxShadow: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          width: 56,
          height: 56,
          borderRadius: 'var(--cs-radius-full)',
          background: 'var(--cs-bg-sunken)',
          color: 'var(--cs-fg-muted)',
          marginBottom: 16,
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 'var(--cs-text-lg)', fontWeight: 500, margin: '0 0 8px 0', color: 'var(--cs-fg-primary)' }}>
        {title}
      </h3>
      <p style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
        {description}
      </p>
      {cta && <div style={{ marginTop: 20 }}>{cta}</div>}
    </div>
  );
}

export default function AIEngineConfigPage() {
  const [tab, setTab] = useState<Tab>('providers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [provRes, wfRes, promptRes] = await Promise.all([
        fetch('/api/admin/ai-engine/config/providers'),
        fetch('/api/admin/ai-engine/config/workflows'),
        fetch('/api/admin/ai-engine/config/prompts'),
      ]);
      if (!provRes.ok) throw new Error(`Fournisseurs: ${provRes.status}`);
      const [provData, wfData, promptData] = await Promise.all([provRes.json(), wfRes.json(), promptRes.json()]);
      setProviders(provData.providers ?? []);
      setWorkflows(wfData.workflows ?? []);
      setPrompts(promptData.prompts ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTestConnection = useCallback(async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      await fetch('/api/admin/ai-engine/health');
      await new Promise((r) => setTimeout(r, 1200));
    } catch { /* noop */ } finally {
      setTestingProvider(null);
    }
  }, []);

  const configuredCount = providers.filter((p) => p.configured).length;
  const activeWorkflows = workflows.filter((w) => w.isActive).length;
  const activePrompts = prompts.filter((p) => p.isActive).length;
  const totalBudget = providers.reduce((sum, p) => sum + (p.dailyBudgetCents ?? 0), 0);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'providers', label: 'Fournisseurs', icon: <Cpu size={14} />, count: providers.length },
    { key: 'workflows', label: 'Workflows', icon: <GitBranch size={14} />, count: workflows.length },
    { key: 'prompts', label: 'Prompts', icon: <FileText size={14} />, count: prompts.length },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[60, 80, 200].map((h, i) => (
          <div key={i} style={{ background: 'var(--cs-bg-elevated)', border: '1px solid var(--cs-border)', borderRadius: 'var(--cs-radius-md)', minHeight: h }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <section style={{ background: 'var(--cs-danger-bg)', border: '1px solid var(--cs-danger)', borderRadius: 'var(--cs-radius-md)', padding: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
        <AlertTriangle size={20} style={{ color: 'var(--cs-danger)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--cs-text-sm)' }}>Impossible de charger la configuration</p>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>{error}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw size={12} />}>Réessayer</Button>
      </section>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href="/admin/content-studio-v2/ai-engine"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 'var(--cs-radius)', border: '1px solid var(--cs-border)', color: 'var(--cs-fg-secondary)', textDecoration: 'none', background: 'var(--cs-bg-elevated)', flexShrink: 0 }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <p className="cs-eyebrow" style={{ marginBottom: 4 }}>AI Engine</p>
            <h1 className="cs-display" style={{ margin: 0, fontSize: 'var(--cs-text-xl)', fontWeight: 500, letterSpacing: '-0.01em' }}>
              Configuration
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-muted)' }}>
              Gérez les fournisseurs IA, les workflows de génération et les templates de prompts.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/content-studio-v2/ai-engine/knowledge" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" leftIcon={<BookOpen size={14} />}>Base de connaissances</Button>
          </Link>
          <Link href="/admin/content-studio-v2/ai-engine/analytics" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" leftIcon={<BarChart3 size={14} />}>Analytiques</Button>
          </Link>
        </div>
      </header>

      {/* Stats summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard icon={<Activity size={18} />} value={`${configuredCount}/${providers.length}`} label="Fournisseurs actifs" accent="var(--cs-success)" />
        <StatCard icon={<Layers size={18} />} value={activeWorkflows || '—'} label="Workflows actifs" accent="var(--cs-violet)" />
        <StatCard icon={<PenTool size={18} />} value={activePrompts || '—'} label="Prompts versionnés" accent="var(--cs-saffron)" />
        <StatCard icon={<Wallet size={18} />} value={totalBudget > 0 ? `${(totalBudget / 100).toFixed(0)} MAD` : '—'} label="Budget quotidien total" accent="var(--cs-accent)" />
      </div>

      {/* Tab navigation */}
      <nav style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--cs-border-hair)' }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '12px 20px',
                border: 'none',
                borderBottom: active ? '2px solid var(--cs-accent)' : '2px solid transparent',
                background: 'transparent',
                color: active ? 'var(--cs-accent)' : 'var(--cs-fg-muted)',
                fontFamily: 'var(--cs-font-display)',
                fontSize: 'var(--cs-text-sm)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all var(--cs-motion-fast) var(--cs-easing)',
                marginBottom: -1,
              }}
            >
              {t.icon}
              {t.label}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'var(--cs-font-mono)',
                  padding: '1px 6px',
                  borderRadius: 'var(--cs-radius-full)',
                  background: active ? 'var(--cs-accent-bg)' : 'var(--cs-bg-sunken)',
                  color: active ? 'var(--cs-accent)' : 'var(--cs-fg-muted)',
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Providers Tab */}
      {tab === 'providers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} onTestConnection={handleTestConnection} testing={testingProvider === p.id} />
          ))}
        </div>
      )}

      {/* Workflows Tab */}
      {tab === 'workflows' && (
        workflows.length === 0 ? (
          <EmptyState
            icon={<GitBranch size={24} />}
            title="Aucun workflow personnalisé"
            description="Les workflows par défaut sont utilisés pour la génération. Créez un workflow personnalisé pour ajuster les nœuds, seuils de qualité et providers par format."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {workflows.map((w) => <WorkflowCard key={w.id} workflow={w} />)}
          </div>
        )
      )}

      {/* Prompts Tab */}
      {tab === 'prompts' && (
        prompts.length === 0 ? (
          <EmptyState
            icon={<FileText size={24} />}
            title="Aucun prompt personnalisé"
            description="Les templates de prompts par défaut sont utilisés pour chaque nœud du pipeline. Créez des templates versionnés pour itérer sur la qualité de génération."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 14 }}>
            {prompts.map((p) => <PromptCard key={p.id} prompt={p} />)}
          </div>
        )
      )}

      <style>{`
        @keyframes cs-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes cs-spin { to { transform: rotate(360deg); } }
        .cs-spin { animation: cs-spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}
