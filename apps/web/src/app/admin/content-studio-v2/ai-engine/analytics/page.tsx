'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Activity,
  DollarSign,
  Star,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  TrendingUp,
  GitBranch,
} from 'lucide-react';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { Badge } from '@/components/admin/content-studio-v2/primitives';

/* ================================================================
   Types
   ================================================================ */

interface NodeMetric {
  nodeId: string;
  label: string;
  provider: string;
  avgLatencyMs: number;
  avgCostCents: number;
  totalInvocations: number;
  errorCount: number;
  errorRate: number;
  status: 'healthy' | 'degraded' | 'error';
}

interface AnalyticsData {
  overview: {
    generationsToday: number;
    generationsWeek: number;
    generationsMonth: number;
    costTodayCents: number;
    costWeekCents: number;
    costMonthCents: number;
    avgQualityScore: number;
    successRate: number;
    errorRate: number;
  };
  nodeMetrics: NodeMetric[];
  costByProvider: Array<{ provider: string; costCents: number; count: number }>;
  costByNode: Array<{ nodeName: string; costCents: number; count: number }>;
  recentJobs: Array<{
    id: string;
    status: string;
    platform: string;
    format: string;
    contentType: string;
    totalCostCents: string;
    durationMs: number | null;
    createdAt: string;
  }>;
}

type Period = 'day' | 'week' | 'month';

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Dernieres 24h',
  week: '7 jours',
  month: '30 jours',
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'var(--cs-accent)',
  anthropic: 'var(--cs-saffron)',
  google: 'var(--cs-sage)',
  elevenlabs: 'var(--cs-violet)',
  ollama: 'var(--cs-clay)',
};

const NODE_LABELS: Record<string, string> = {
  brief_analysis: 'Analyse brief',
  parseBrief: 'Analyse brief',
  script_writer: 'Script',
  generateScript: 'Script',
  image_gen: 'Image',
  generateImages: 'Image',
  caption_gen: 'Caption',
  generateCaption: 'Caption',
  quality_gate: 'Qualite',
  qualityCheck: 'Qualite',
  tts_gen: 'TTS',
  generateVoiceover: 'TTS',
  video_gen: 'Video',
  generateVideo: 'Video',
  enrichKnowledge: 'Savoir',
  enrichTrends: 'Tendances',
  generateMusic: 'Musique',
  generateSubtitles: 'Sous-titres',
  compose: 'Composition',
  transcodeExport: 'Export',
  moderate: 'Moderation',
  reviewGate: 'Revue',
  generateVariants: 'Variantes',
};

const STATUS_BADGE: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  completed: { label: 'Termine', tone: 'success' },
  failed: { label: 'Echoue', tone: 'danger' },
  pending: { label: 'En attente', tone: 'neutral' },
  running: { label: 'En cours', tone: 'warning' },
};

/* ================================================================
   Subcomponents
   ================================================================ */

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        background: 'var(--cs-bg-sunken)',
        borderRadius: 'var(--cs-radius)',
        padding: 2,
      }}
    >
      {(['day', 'week', 'month'] as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: '6px 14px',
            fontSize: 'var(--cs-text-xs)',
            fontWeight: value === p ? 600 : 400,
            color: value === p ? 'var(--cs-fg-primary)' : 'var(--cs-fg-muted)',
            background: value === p ? 'var(--cs-bg-elevated)' : 'transparent',
            border: value === p ? '1px solid var(--cs-border-hair)' : '1px solid transparent',
            borderRadius: 'var(--cs-radius-sm, 4px)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontFamily: 'inherit',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            boxShadow: value === p ? 'var(--cs-shadow-sm)' : 'none',
          }}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '20px 22px',
        boxShadow: 'var(--cs-shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--cs-radius)',
            background: 'var(--cs-bg-sunken)',
            color: tone ?? 'var(--cs-accent)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
        </span>
      </div>
      <div>
        <div
          className="cs-display"
          style={{ fontSize: 'var(--cs-text-2xl)', fontWeight: 500, letterSpacing: '-0.01em' }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function BarChart({
  data,
  colors,
  labelMap,
  formatValue,
}: {
  data: Array<{ key: string; value: number; count: number }>;
  colors: Record<string, string>;
  labelMap: Record<string, string>;
  formatValue: (v: number) => string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((item) => {
        const pct = (item.value / maxValue) * 100;
        const color = colors[item.key] ?? 'var(--cs-accent)';
        return (
          <div key={item.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)', textTransform: 'capitalize' }}>
                {labelMap[item.key] ?? item.key}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="cs-mono" style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
                  {item.count} appels
                </span>
                <span className="cs-mono" style={{ fontSize: 'var(--cs-text-sm)', fontWeight: 500 }}>
                  {formatValue(item.value)}
                </span>
              </div>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 'var(--cs-radius-full)',
                background: 'var(--cs-bg-sunken)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 'var(--cs-radius-full)',
                  background: color,
                  transition: 'width var(--cs-motion-base) var(--cs-easing)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JobsTable({
  jobs,
}: {
  jobs: AnalyticsData['recentJobs'];
}) {
  function formatDuration(ms: number | null): string {
    if (ms == null) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'maintenant';
    if (diffMin < 60) return `il y a ${diffMin}m`;
    if (diffMin < 1440) return `il y a ${Math.round(diffMin / 60)}h`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--cs-text-sm)',
        }}
      >
        <thead>
          <tr>
            {['Statut', 'Plateforme', 'Format', 'Type', 'Cout', 'Duree', 'Date'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--cs-border)',
                  fontFamily: 'var(--cs-font-mono)',
                  fontSize: 'var(--cs-text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--cs-fg-muted)',
                  fontWeight: 500,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const statusCfg = STATUS_BADGE[job.status] ?? STATUS_BADGE['pending']!;
            return (
              <tr key={job.id}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--cs-border-hair)' }}>
                  <Badge tone={statusCfg!.tone} size="sm">{statusCfg!.label}</Badge>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--cs-border-hair)', textTransform: 'capitalize' }}>
                  {job.platform}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--cs-border-hair)', textTransform: 'capitalize' }}>
                  {job.format}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--cs-border-hair)', textTransform: 'capitalize' }}>
                  {job.contentType}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--cs-border-hair)' }}>
                  <span className="cs-mono">{(parseFloat(job.totalCostCents) / 100).toFixed(2)} MAD</span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--cs-border-hair)', color: 'var(--cs-fg-secondary)' }}>
                  {formatDuration(job.durationMs)}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--cs-border-hair)', color: 'var(--cs-fg-muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={10} />
                    {formatTime(job.createdAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================
   Main Page
   ================================================================ */

export default function AIEngineAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');

  const fetchAnalytics = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai-engine/analytics?period=${p}&includeNodeMetrics=true`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(period);
  }, [fetchAnalytics, period]);

  const handlePeriodChange = useCallback((p: Period) => {
    setPeriod(p);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[60, 100, 200, 300].map((h, i) => (
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
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--cs-text-sm)' }}>
            Impossible de charger les analytiques
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>
            {error}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => fetchAnalytics(period)} leftIcon={<RefreshCw size={12} />}>
          Reessayer
        </Button>
      </section>
    );
  }

  if (!data) return null;

  const { overview, nodeMetrics, costByProvider, costByNode, recentJobs } = data;

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
              Analytiques
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <PeriodSelector value={period} onChange={handlePeriodChange} />
          <Button variant="ghost" size="sm" onClick={() => fetchAnalytics(period)} leftIcon={<RefreshCw size={12} />}>
            Actualiser
          </Button>
          <Link href="/admin/content-studio-v2/ai-engine/graph" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="sm" leftIcon={<GitBranch size={12} />}>
              Graphe
            </Button>
          </Link>
          <Link href="/admin/content-studio-v2/ai-engine/config" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="sm">Configuration</Button>
          </Link>
        </div>
      </header>

      {/* KPI Cards */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        <KPICard
          icon={<Activity size={18} />}
          label="Generations aujourd'hui"
          value={String(overview.generationsToday)}
          sub={`${overview.generationsWeek} cette semaine / ${overview.generationsMonth} ce mois`}
          tone="var(--cs-accent)"
        />
        <KPICard
          icon={<DollarSign size={18} />}
          label="Cout total (mois)"
          value={`${(overview.costMonthCents / 100).toFixed(2)} MAD`}
          sub={`${(overview.costTodayCents / 100).toFixed(2)} MAD aujourd'hui`}
          tone="var(--cs-saffron)"
        />
        <KPICard
          icon={<Star size={18} />}
          label="Qualite moyenne"
          value={`${(overview.avgQualityScore * 100).toFixed(0)}%`}
          sub="Score moyen sur le mois"
          tone="var(--cs-sage)"
        />
        <KPICard
          icon={<CheckCircle2 size={18} />}
          label="Taux de succes"
          value={`${overview.successRate.toFixed(1)}%`}
          sub={`${overview.errorRate.toFixed(1)}% taux d'erreur`}
          tone="var(--cs-success)"
        />
      </section>

      {/* Node health summary (from nodeMetrics) */}
      {nodeMetrics && nodeMetrics.length > 0 && (
        <section
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border-hair)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '20px 24px',
            boxShadow: 'var(--cs-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={16} style={{ color: 'var(--cs-accent)' }} />
              <h2 className="cs-display" style={{ margin: 0, fontSize: 'var(--cs-text-base)', fontWeight: 500 }}>
                Sante des noeuds du pipeline
              </h2>
            </div>
            <Link href="/admin/content-studio-v2/ai-engine/graph" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm" leftIcon={<GitBranch size={12} />}>
                Vue graphe
              </Button>
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {nodeMetrics
              .filter((m) => m.totalInvocations > 0 || m.avgCostCents > 0)
              .map((m) => (
              <div
                key={m.nodeId}
                style={{
                  padding: '8px 12px',
                  background: 'var(--cs-bg-sunken)',
                  borderRadius: 'var(--cs-radius)',
                  borderLeft: `3px solid ${
                    m.status === 'healthy'
                      ? 'var(--cs-success, #22c55e)'
                      : m.status === 'degraded'
                      ? 'var(--cs-warning, #f59e0b)'
                      : 'var(--cs-danger, #ef4444)'
                  }`,
                  fontSize: 'var(--cs-text-xs)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  minWidth: 120,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--cs-fg-primary)' }}>
                  {m.label}
                </span>
                <div style={{ display: 'flex', gap: 10, color: 'var(--cs-fg-muted)' }}>
                  <span className="cs-mono">{m.totalInvocations} inv.</span>
                  {m.avgCostCents > 0 && (
                    <span className="cs-mono">{(m.avgCostCents / 100).toFixed(2)} MAD</span>
                  )}
                  {m.errorCount > 0 && (
                    <span className="cs-mono" style={{ color: 'var(--cs-danger, #ef4444)' }}>
                      {m.errorCount} err.
                    </span>
                  )}
                </div>
              </div>
            ))}
            {nodeMetrics.every((m) => m.totalInvocations === 0 && m.avgCostCents === 0) && (
              <p style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-muted)', padding: 12 }}>
                Aucune donnee de noeud disponible pour cette periode. Les metriques apparaitront apres la premiere generation.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Cost by provider */}
        <section
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border-hair)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '24px 28px',
            boxShadow: 'var(--cs-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <TrendingUp size={16} style={{ color: 'var(--cs-accent)' }} />
            <h2 className="cs-display" style={{ margin: 0, fontSize: 'var(--cs-text-base)', fontWeight: 500 }}>
              Cout par fournisseur
            </h2>
          </div>
          {costByProvider.length > 0 ? (
            <BarChart
              data={costByProvider.map((p) => ({ key: p.provider, value: p.costCents, count: p.count }))}
              colors={PROVIDER_COLORS}
              labelMap={{
                openai: 'OpenAI',
                anthropic: 'Anthropic',
                google: 'Google',
                elevenlabs: 'ElevenLabs',
                ollama: 'Ollama',
              }}
              formatValue={(v) => `${(v / 100).toFixed(2)} MAD`}
            />
          ) : (
            <p style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-muted)', textAlign: 'center', padding: 20 }}>
              Aucune donnee de cout disponible
            </p>
          )}
        </section>

        {/* Cost by node */}
        <section
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border-hair)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '24px 28px',
            boxShadow: 'var(--cs-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <TrendingUp size={16} style={{ color: 'var(--cs-sage)' }} />
            <h2 className="cs-display" style={{ margin: 0, fontSize: 'var(--cs-text-base)', fontWeight: 500 }}>
              Cout par noeud
            </h2>
          </div>
          {costByNode.length > 0 ? (
            <BarChart
              data={costByNode.map((n) => ({ key: n.nodeName, value: n.costCents, count: n.count }))}
              colors={{
                brief_analysis: 'var(--cs-accent)',
                parseBrief: 'var(--cs-accent)',
                script_writer: 'var(--cs-saffron)',
                generateScript: 'var(--cs-saffron)',
                image_gen: 'var(--cs-sage)',
                generateImages: 'var(--cs-sage)',
                caption_gen: 'var(--cs-violet)',
                generateCaption: 'var(--cs-violet)',
                quality_gate: 'var(--cs-clay)',
                qualityCheck: 'var(--cs-clay)',
                tts_gen: 'var(--cs-accent-soft)',
                generateVoiceover: 'var(--cs-accent-soft)',
                video_gen: 'var(--cs-warning)',
                generateVideo: 'var(--cs-warning)',
                enrichKnowledge: 'var(--cs-sage)',
                enrichTrends: 'var(--cs-saffron)',
                generateMusic: 'var(--cs-violet)',
                generateSubtitles: 'var(--cs-clay)',
                compose: 'var(--cs-accent)',
                transcodeExport: 'var(--cs-accent-soft)',
                moderate: 'var(--cs-warning)',
                reviewGate: 'var(--cs-sage)',
                generateVariants: 'var(--cs-violet)',
              }}
              labelMap={NODE_LABELS}
              formatValue={(v) => `${(v / 100).toFixed(2)} MAD`}
            />
          ) : (
            <p style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-muted)', textAlign: 'center', padding: 20 }}>
              Aucune donnee de cout disponible
            </p>
          )}
        </section>
      </div>

      {/* Recent jobs table */}
      <section
        style={{
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border-hair)',
          borderRadius: 'var(--cs-radius-md)',
          padding: '24px 28px',
          boxShadow: 'var(--cs-shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={16} style={{ color: 'var(--cs-accent)' }} />
            <h2 className="cs-display" style={{ margin: 0, fontSize: 'var(--cs-text-base)', fontWeight: 500 }}>
              Generations recentes
            </h2>
          </div>
          <Badge tone="neutral" size="sm">{recentJobs.length} resultats</Badge>
        </div>
        {recentJobs.length > 0 ? (
          <JobsTable jobs={recentJobs} />
        ) : (
          <p style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-muted)', textAlign: 'center', padding: 20 }}>
            Aucune generation enregistree
          </p>
        )}
      </section>
    </div>
  );
}
