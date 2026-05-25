'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Cpu,
  GitBranch,
  FileText,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Zap,
  RefreshCw,
  ChevronRight,
  Hash,
  Eye,
  Star,
} from 'lucide-react';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { Badge } from '@/components/admin/content-studio-v2/primitives';

/* ================================================================
   Types
   ================================================================ */

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

type Tab = 'providers' | 'workflows' | 'prompts' | 'knowledge';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'providers', label: 'Fournisseurs', icon: <Cpu size={14} /> },
  { key: 'workflows', label: 'Workflows', icon: <GitBranch size={14} /> },
  { key: 'prompts', label: 'Prompts', icon: <FileText size={14} /> },
  { key: 'knowledge', label: 'Base de connaissances', icon: <BookOpen size={14} /> },
];

const CAPABILITY_LABELS: Record<string, string> = {
  text: 'Texte',
  image: 'Image',
  video: 'Video',
  tts: 'TTS',
  stt: 'STT',
  embedding: 'Embedding',
  moderation: 'Moderation',
  vision: 'Vision',
  music: 'Musique',
};

const HEALTH_CONFIG: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  healthy: { label: 'OK', tone: 'success' },
  degraded: { label: 'Degrade', tone: 'warning' },
  unhealthy: { label: 'Erreur', tone: 'danger' },
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
  brief_analysis: 'Analyse de brief',
  script_writer: 'Ecriture script',
  image_gen: 'Generation image',
  caption_gen: 'Generation caption',
  quality_gate: 'Controle qualite',
  tts_gen: 'Voix / TTS',
  video_gen: 'Generation video',
};

/* ================================================================
   Subcomponents
   ================================================================ */

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      style={{
        display: 'flex',
        gap: 4,
        background: 'var(--cs-bg-sunken)',
        borderRadius: 'var(--cs-radius)',
        padding: 4,
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 'var(--cs-radius-sm)',
            border: 'none',
            background: active === tab.key ? 'var(--cs-bg-elevated)' : 'transparent',
            color: active === tab.key ? 'var(--cs-fg-primary)' : 'var(--cs-fg-muted)',
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-sm)',
            fontWeight: active === tab.key ? 500 : 400,
            cursor: 'pointer',
            transition: 'all var(--cs-motion-fast) var(--cs-easing)',
            boxShadow: active === tab.key ? 'var(--cs-shadow-sm)' : 'none',
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

/* ---------- Provider Card ---------- */

function ProviderCard({
  provider,
  onTestConnection,
  testing,
}: {
  provider: ProviderData;
  onTestConnection: (id: string) => void;
  testing: boolean;
}) {
  const healthCfg = HEALTH_CONFIG[provider.healthStatus] ?? HEALTH_CONFIG['healthy']!;
  const models = Array.isArray(provider.models) ? (provider.models as ProviderModel[]) : [];

  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: `1px solid ${provider.configured ? 'var(--cs-border-hair)' : 'var(--cs-border)'}`,
        borderRadius: 'var(--cs-radius-md)',
        padding: '20px 24px',
        boxShadow: 'var(--cs-shadow-sm)',
        opacity: provider.configured ? 1 : 0.65,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--cs-radius)',
              background: provider.configured ? 'var(--cs-accent-bg)' : 'var(--cs-bg-sunken)',
              color: provider.configured ? 'var(--cs-accent)' : 'var(--cs-fg-muted)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Cpu size={18} />
          </span>
          <div>
            <span style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-sm)' }}>
              {provider.name}
            </span>
            <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
              Priorite: {provider.priority} {provider.isFallback && '(fallback)'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {provider.configured ? (
            <Badge tone={healthCfg.tone} size="sm">
              <CheckCircle2 size={10} />
              <span style={{ marginLeft: 2 }}>Configure</span>
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm">
              <XCircle size={10} />
              <span style={{ marginLeft: 2 }}>Non configure</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Capabilities */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {provider.capabilities.map((cap) => (
          <Badge key={cap} tone="clay" size="sm">
            {CAPABILITY_LABELS[cap] ?? cap}
          </Badge>
        ))}
      </div>

      {/* Models */}
      {models.length > 0 && (
        <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-secondary)' }}>
          <div style={{ fontWeight: 500, marginBottom: 4, color: 'var(--cs-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Modeles
          </div>
          {models.map((m) => (
            <div
              key={m.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '3px 0',
                borderBottom: '1px solid var(--cs-border-hair)',
              }}
            >
              <span className="cs-mono" style={{ color: 'var(--cs-fg-primary)' }}>{m.name}</span>
              <span style={{ color: 'var(--cs-fg-muted)' }}>
                {m.costPerUnit != null
                  ? `${(m.costPerUnit / 100).toFixed(0)} cts/unite`
                  : m.costPer1MInput != null
                    ? `${m.costPer1MInput} cts/1M in`
                    : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Budget */}
      {provider.dailyBudgetCents != null && provider.dailyBudgetCents > 0 && (
        <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
          <Shield size={10} style={{ display: 'inline', marginRight: 4 }} />
          Budget quotidien : {(provider.dailyBudgetCents / 100).toFixed(2)} MAD
          {provider.rateLimitRpm && (
            <>
              <span style={{ margin: '0 6px' }}>&middot;</span>
              <Zap size={10} style={{ display: 'inline', marginRight: 4 }} />
              {provider.rateLimitRpm} req/min
            </>
          )}
        </div>
      )}

      {/* Test connection */}
      {provider.configured && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RefreshCw size={12} />}
          onClick={() => onTestConnection(provider.id)}
          loading={testing}
        >
          Tester la connexion
        </Button>
      )}
    </div>
  );
}

/* ---------- Workflow Card ---------- */

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
          <div style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-sm)' }}>
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

      {/* Meta row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-secondary)' }}>
        {workflow.platform && (
          <span>
            <strong>{PLATFORM_LABELS[workflow.platform] ?? workflow.platform}</strong>
          </span>
        )}
        {workflow.format && (
          <span style={{ textTransform: 'capitalize' }}>{workflow.format}</span>
        )}
        <span>Seuil qualite : {(parseFloat(workflow.qualityThreshold) * 100).toFixed(0)}%</span>
        <span>Budget max : {(workflow.maxBudgetCents / 100).toFixed(2)} MAD</span>
        <span>Retries : {workflow.maxRetries}</span>
      </div>

      {/* Nodes pipeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {nodes.map((node, i) => (
          <span key={node} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Badge tone="sage" size="sm">{NODE_LABELS[node] ?? node}</Badge>
            {i < nodes.length - 1 && <ChevronRight size={10} style={{ color: 'var(--cs-fg-muted)' }} />}
          </span>
        ))}
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 16, fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Eye size={10} />
          HITL : {workflow.humanReviewRequired ? 'Oui' : 'Non'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Zap size={10} />
          Auto-publish : {workflow.autoPublish ? 'Oui' : 'Non'}
        </span>
      </div>
    </div>
  );
}

/* ---------- Prompt Card ---------- */

function PromptCard({ prompt }: { prompt: PromptData }) {
  const truncatedPrompt =
    prompt.systemPrompt.length > 180
      ? prompt.systemPrompt.slice(0, 180) + '...'
      : prompt.systemPrompt;

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-sm)' }}>
            {prompt.name}
          </div>
          <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', marginTop: 2 }}>
            Noeud : <span className="cs-mono">{prompt.nodeName}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {prompt.isActive ? (
            <Badge tone="success" size="sm">Active</Badge>
          ) : (
            <Badge tone="neutral" size="sm">Inactive</Badge>
          )}
          <Badge tone="accent" size="sm">v{prompt.version}</Badge>
        </div>
      </div>

      {/* System prompt preview */}
      <div
        style={{
          fontSize: 'var(--cs-text-xs)',
          color: 'var(--cs-fg-secondary)',
          lineHeight: 1.5,
          padding: '10px 12px',
          background: 'var(--cs-bg-sunken)',
          borderRadius: 'var(--cs-radius-sm)',
          fontFamily: 'var(--cs-font-mono)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {truncatedPrompt}
      </div>

      {/* Variables */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {prompt.variables.map((v) => (
          <Badge key={v} tone="saffron" size="sm">
            <Hash size={8} />
            {v}
          </Badge>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
        {prompt.avgQualityScore != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Star size={10} />
            Qualite moy. : {(parseFloat(prompt.avgQualityScore) * 100).toFixed(0)}%
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Zap size={10} />
          Utilisations : {prompt.usageCount}
        </span>
      </div>
    </div>
  );
}

/* ---------- Knowledge (placeholder) ---------- */

function KnowledgeTab() {
  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '48px 32px',
        boxShadow: 'var(--cs-shadow-sm)',
        textAlign: 'center',
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
          color: 'var(--cs-accent)',
          marginBottom: 16,
        }}
      >
        <BookOpen size={24} />
      </div>
      <h3
        className="cs-display"
        style={{ fontSize: 'var(--cs-text-lg)', fontWeight: 500, margin: '0 0 8px 0' }}
      >
        Base de connaissances
      </h3>
      <p style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
        Gerez les collections de documents utilises par le RAG (Retrieval-Augmented Generation)
        pour enrichir les generations avec le contexte de votre marque.
      </p>
      <p
        style={{
          marginTop: 20,
          fontSize: 'var(--cs-text-xs)',
          color: 'var(--cs-fg-muted)',
          fontFamily: 'var(--cs-font-mono)',
        }}
      >
        Bientot disponible
      </p>
    </div>
  );
}

/* ================================================================
   Main Page
   ================================================================ */

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
      if (!wfRes.ok) throw new Error(`Workflows: ${wfRes.status}`);
      if (!promptRes.ok) throw new Error(`Prompts: ${promptRes.status}`);

      const [provData, wfData, promptData] = await Promise.all([
        provRes.json(),
        wfRes.json(),
        promptRes.json(),
      ]);

      setProviders(provData.providers ?? []);
      setWorkflows(wfData.workflows ?? []);
      setPrompts(promptData.prompts ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTestConnection = useCallback(async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      // Simple health check via the existing health endpoint
      const res = await fetch('/api/admin/ai-engine/health');
      if (!res.ok) throw new Error('Health check failed');
      // In a full implementation this would test the specific provider
      // For MVP we just ping the health endpoint
      await new Promise((r) => setTimeout(r, 1200));
    } catch {
      // Silent fail for MVP
    } finally {
      setTestingProvider(null);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[60, 200, 200, 200].map((h, i) => (
          <div
            key={i}
            style={{
              background: 'var(--cs-bg-elevated)',
              border: '1px solid var(--cs-border)',
              borderRadius: 'var(--cs-radius-md)',
              minHeight: h,
              animation: 'cs-shimmer 1.6s ease-in-out infinite',
              backgroundImage: 'linear-gradient(90deg, var(--cs-bg-sunken) 0%, var(--cs-bg-feature) 50%, var(--cs-bg-sunken) 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <section
        style={{
          background: 'var(--cs-danger-bg)',
          border: '1px solid var(--cs-danger)',
          borderRadius: 'var(--cs-radius-md)',
          padding: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <AlertTriangle size={20} style={{ color: 'var(--cs-danger)', flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--cs-text-sm)' }}>
            Impossible de charger la configuration
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>
            {error}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw size={12} />}>
          Reessayer
        </Button>
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 'var(--cs-radius)',
              border: '1px solid var(--cs-border)',
              color: 'var(--cs-fg-secondary)',
              textDecoration: 'none',
              transition: 'all var(--cs-motion-fast) var(--cs-easing)',
              background: 'var(--cs-bg-elevated)',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <p className="cs-eyebrow" style={{ marginBottom: 4 }}>AI Engine</p>
            <h1
              className="cs-display"
              style={{
                margin: 0,
                fontSize: 'var(--cs-text-xl)',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              Configuration
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/content-studio-v2/ai-engine/analytics" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" leftIcon={<Settings size={14} />}>Analytiques</Button>
          </Link>
        </div>
      </header>

      {/* Tab navigation */}
      <TabNav active={tab} onChange={setTab} />

      {/* Tab content */}
      {tab === 'providers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="cs-display" style={{ margin: 0, fontSize: 'var(--cs-text-lg)', fontWeight: 500 }}>
              Fournisseurs IA
            </h2>
            <span style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
              {providers.filter((p) => p.configured).length} / {providers.length} configures
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: 16,
            }}
          >
            {providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onTestConnection={handleTestConnection}
                testing={testingProvider === p.id}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'workflows' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="cs-display" style={{ margin: 0, fontSize: 'var(--cs-text-lg)', fontWeight: 500 }}>
              Workflows de generation
            </h2>
            <Badge tone="accent" size="sm">{workflows.length} workflows</Badge>
          </div>
          {workflows.length === 0 ? (
            <div
              style={{
                background: 'var(--cs-bg-elevated)',
                border: '1px solid var(--cs-border-hair)',
                borderRadius: 'var(--cs-radius-md)',
                padding: '48px 32px',
                textAlign: 'center',
                boxShadow: 'var(--cs-shadow-sm)',
              }}
            >
              <GitBranch size={24} style={{ color: 'var(--cs-fg-muted)', marginBottom: 12 }} />
              <p style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>
                Aucun workflow configure. Les workflows par defaut seront utilises.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {workflows.map((w) => (
                <WorkflowCard key={w.id} workflow={w} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'prompts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="cs-display" style={{ margin: 0, fontSize: 'var(--cs-text-lg)', fontWeight: 500 }}>
              Templates de prompts
            </h2>
            <Badge tone="accent" size="sm">{prompts.length} templates</Badge>
          </div>
          {prompts.length === 0 ? (
            <div
              style={{
                background: 'var(--cs-bg-elevated)',
                border: '1px solid var(--cs-border-hair)',
                borderRadius: 'var(--cs-radius-md)',
                padding: '48px 32px',
                textAlign: 'center',
                boxShadow: 'var(--cs-shadow-sm)',
              }}
            >
              <FileText size={24} style={{ color: 'var(--cs-fg-muted)', marginBottom: 12 }} />
              <p style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>
                Aucun template de prompt. Les templates par defaut seront utilises.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                gap: 14,
              }}
            >
              {prompts.map((p) => (
                <PromptCard key={p.id} prompt={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'knowledge' && <KnowledgeTab />}
    </div>
  );
}
