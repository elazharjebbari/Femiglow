'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  DollarSign,
  AlertCircle,
  Cpu,
  GitBranch,
} from 'lucide-react';
import { Button, Badge } from '@/components/admin/content-studio-v2/primitives';

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

interface AnalyticsWithNodes {
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

/* ================================================================
   Graph topology definition
   ================================================================ */

/** Column/row position for each node in the CSS grid layout */
interface NodePosition {
  id: string;
  label: string;
  col: number;
  row: number;
  /** Width in grid columns */
  colSpan?: number;
}

/** Edge between two nodes */
interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  conditional?: boolean;
}

const NODES: NodePosition[] = [
  // Row 1: Linear opening
  { id: 'START', label: 'Debut', col: 1, row: 1 },
  { id: 'parseBrief', label: 'Analyse du brief', col: 2, row: 1 },
  { id: 'enrichKnowledge', label: 'Enrichissement savoir', col: 3, row: 1 },
  { id: 'enrichTrends', label: 'Enrichissement tendances', col: 4, row: 1 },
  { id: 'generateScript', label: 'Generation script', col: 5, row: 1 },

  // Row 2: Video flow branch
  { id: 'generateVideo', label: 'Generation video', col: 6, row: 1 },
  { id: 'generateVoiceover', label: 'Voix off', col: 7, row: 1 },
  { id: 'generateMusic', label: 'Musique', col: 8, row: 1 },
  { id: 'generateSubtitles', label: 'Sous-titres', col: 9, row: 1 },

  // Row 3: Image/carousel branch
  { id: 'generateImages', label: 'Generation images', col: 6, row: 3 },

  // Row 4: Caption only (text)
  // Text goes directly to generateCaption

  // Row 2-3 merge: generateCaption
  { id: 'generateCaption', label: 'Generation caption', col: 10, row: 2 },

  // Post-composition
  { id: 'compose', label: 'Composition', col: 11, row: 2 },
  { id: 'transcodeExport', label: 'Transcodage / Export', col: 12, row: 2 },
  { id: 'qualityCheck', label: 'Controle qualite', col: 13, row: 2 },

  // Quality check outcomes
  { id: 'moderate', label: 'Moderation', col: 14, row: 2 },

  // Moderation outcomes
  { id: 'reviewGate', label: 'Revue humaine', col: 15, row: 2 },

  // Review gate outcomes
  { id: 'generateVariants', label: 'Generation variantes', col: 16, row: 2 },
  { id: 'END', label: 'Fin', col: 17, row: 2 },
];

const EDGES: GraphEdge[] = [
  // Linear opening
  { from: 'START', to: 'parseBrief' },
  { from: 'parseBrief', to: 'enrichKnowledge' },
  { from: 'enrichKnowledge', to: 'enrichTrends' },
  { from: 'enrichTrends', to: 'generateScript' },

  // After script: conditional
  { from: 'generateScript', to: 'generateVideo', label: 'reel / story', conditional: true },
  { from: 'generateScript', to: 'generateImages', label: 'carousel / image', conditional: true },
  { from: 'generateScript', to: 'generateCaption', label: 'texte', conditional: true },

  // Video flow
  { from: 'generateVideo', to: 'generateVoiceover' },
  { from: 'generateVoiceover', to: 'generateMusic' },
  { from: 'generateMusic', to: 'generateSubtitles' },
  { from: 'generateSubtitles', to: 'generateCaption' },

  // Image flows
  { from: 'generateImages', to: 'generateCaption' },

  // Post composition
  { from: 'generateCaption', to: 'compose' },
  { from: 'compose', to: 'transcodeExport' },
  { from: 'transcodeExport', to: 'qualityCheck' },

  // Quality gate
  { from: 'qualityCheck', to: 'moderate', label: 'passe', conditional: true },
  { from: 'qualityCheck', to: 'generateScript', label: 'reessai', conditional: true },
  { from: 'qualityCheck', to: 'END', label: 'echec', conditional: true },

  // Moderation gate
  { from: 'moderate', to: 'reviewGate', label: 'valide', conditional: true },
  { from: 'moderate', to: 'generateScript', label: 'signale', conditional: true },
  { from: 'moderate', to: 'END', label: 'bloque', conditional: true },

  // Human review gate
  { from: 'reviewGate', to: 'generateVariants', label: 'approuve', conditional: true },
  { from: 'reviewGate', to: 'END', label: 'approuve direct', conditional: true },
  { from: 'reviewGate', to: 'generateScript', label: 'rejete', conditional: true },

  // Terminal
  { from: 'generateVariants', to: 'END' },
];

/* ================================================================
   Layout: We use a simplified row-based layout approach
   ================================================================ */

interface LayoutRow {
  id: string;
  label: string;
  nodes: string[];
}

const LAYOUT_ROWS: LayoutRow[] = [
  {
    id: 'opening',
    label: 'Sequence d\'ouverture',
    nodes: ['START', 'parseBrief', 'enrichKnowledge', 'enrichTrends', 'generateScript'],
  },
  {
    id: 'video_branch',
    label: 'Branche video (reel / story)',
    nodes: ['generateVideo', 'generateVoiceover', 'generateMusic', 'generateSubtitles'],
  },
  {
    id: 'image_branch',
    label: 'Branche image (carousel / image / texte)',
    nodes: ['generateImages'],
  },
  {
    id: 'post_composition',
    label: 'Post-composition',
    nodes: ['generateCaption', 'compose', 'transcodeExport'],
  },
  {
    id: 'quality_gates',
    label: 'Controle et validation',
    nodes: ['qualityCheck', 'moderate', 'reviewGate'],
  },
  {
    id: 'terminal',
    label: 'Finalisation',
    nodes: ['generateVariants', 'END'],
  },
];

/* ================================================================
   Status color mapping
   ================================================================ */

function getStatusColor(status: 'healthy' | 'degraded' | 'error'): string {
  switch (status) {
    case 'healthy': return 'var(--cs-success, #22c55e)';
    case 'degraded': return 'var(--cs-warning, #f59e0b)';
    case 'error': return 'var(--cs-danger, #ef4444)';
  }
}

function getStatusTone(status: 'healthy' | 'degraded' | 'error'): 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'healthy': return 'success';
    case 'degraded': return 'warning';
    case 'error': return 'danger';
  }
}

function getStatusLabel(status: 'healthy' | 'degraded' | 'error'): string {
  switch (status) {
    case 'healthy': return 'Sain';
    case 'degraded': return 'Degrade';
    case 'error': return 'Erreur';
  }
}

/* ================================================================
   Node card component
   ================================================================ */

function NodeCard({
  node,
  metric,
  expanded,
  onToggle,
  isTerminal,
}: {
  node: NodePosition;
  metric: NodeMetric | undefined;
  expanded: boolean;
  onToggle: () => void;
  isTerminal: boolean;
}) {
  const isStartEnd = node.id === 'START' || node.id === 'END';
  const statusColor = metric ? getStatusColor(metric.status) : 'var(--cs-fg-muted)';

  return (
    <div
      onClick={isStartEnd ? undefined : onToggle}
      role={isStartEnd ? undefined : 'button'}
      tabIndex={isStartEnd ? undefined : 0}
      onKeyDown={isStartEnd ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      style={{
        background: isStartEnd
          ? 'var(--cs-bg-sunken)'
          : 'var(--cs-bg-elevated)',
        border: `2px solid ${isStartEnd ? 'var(--cs-border)' : statusColor}`,
        borderRadius: isStartEnd ? 'var(--cs-radius-full, 9999px)' : 'var(--cs-radius-md)',
        padding: isStartEnd ? '10px 20px' : '14px 16px',
        minWidth: isStartEnd ? 80 : 140,
        maxWidth: 200,
        cursor: isStartEnd ? 'default' : 'pointer',
        boxShadow: expanded
          ? `0 0 0 3px ${statusColor}33, var(--cs-shadow-md, 0 4px 12px rgba(0,0,0,0.1))`
          : 'var(--cs-shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
        textAlign: isStartEnd ? 'center' : 'left',
      }}
    >
      {/* Status indicator dot */}
      {!isStartEnd && (
        <div
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: statusColor,
            border: '2px solid var(--cs-bg-elevated)',
          }}
        />
      )}

      {/* Node name */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span
          style={{
            fontSize: isStartEnd ? 'var(--cs-text-xs)' : 'var(--cs-text-sm)',
            fontWeight: 600,
            color: 'var(--cs-fg-primary)',
            lineHeight: 1.2,
          }}
        >
          {node.label}
        </span>
        {!isStartEnd && (
          expanded ? <ChevronUp size={12} style={{ color: 'var(--cs-fg-muted)', flexShrink: 0 }} /> : <ChevronDown size={12} style={{ color: 'var(--cs-fg-muted)', flexShrink: 0 }} />
        )}
      </div>

      {/* Quick metrics row (always visible for non-terminal) */}
      {!isStartEnd && metric && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span
            className="cs-mono"
            style={{ fontSize: 10, color: 'var(--cs-fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 2 }}
          >
            <Clock size={8} /> {metric.avgLatencyMs > 0 ? `${(metric.avgLatencyMs / 1000).toFixed(1)}s` : '-'}
          </span>
          <span
            className="cs-mono"
            style={{ fontSize: 10, color: 'var(--cs-fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 2 }}
          >
            <DollarSign size={8} /> {metric.avgCostCents > 0 ? `${(metric.avgCostCents / 100).toFixed(2)}` : '-'}
          </span>
          {metric.errorRate > 0 && (
            <span
              className="cs-mono"
              style={{ fontSize: 10, color: 'var(--cs-danger, #ef4444)', display: 'inline-flex', alignItems: 'center', gap: 2 }}
            >
              <AlertCircle size={8} /> {metric.errorRate.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Expanded details */}
      {expanded && !isStartEnd && metric && (
        <div
          style={{
            borderTop: '1px solid var(--cs-border-hair)',
            paddingTop: 10,
            marginTop: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 'var(--cs-text-xs)',
          }}
        >
          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Badge tone={getStatusTone(metric.status)} size="sm">{getStatusLabel(metric.status)}</Badge>
          </div>

          {/* Provider */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cs-fg-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Cpu size={10} /> Fournisseur
            </span>
            <span className="cs-mono" style={{ fontWeight: 500, textTransform: 'capitalize' }}>
              {metric.provider || '-'}
            </span>
          </div>

          {/* Avg latency */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cs-fg-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} /> Latence moy.
            </span>
            <span className="cs-mono" style={{ fontWeight: 500 }}>
              {metric.avgLatencyMs > 0 ? `${(metric.avgLatencyMs / 1000).toFixed(2)}s` : '-'}
            </span>
          </div>

          {/* Avg cost */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cs-fg-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <DollarSign size={10} /> Cout moy.
            </span>
            <span className="cs-mono" style={{ fontWeight: 500 }}>
              {metric.avgCostCents > 0 ? `${(metric.avgCostCents / 100).toFixed(3)} MAD` : '-'}
            </span>
          </div>

          {/* Total invocations */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cs-fg-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Zap size={10} /> Invocations
            </span>
            <span className="cs-mono" style={{ fontWeight: 500 }}>
              {metric.totalInvocations}
            </span>
          </div>

          {/* Error count */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cs-fg-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={10} /> Erreurs
            </span>
            <span className="cs-mono" style={{ fontWeight: 500, color: metric.errorCount > 0 ? 'var(--cs-danger, #ef4444)' : undefined }}>
              {metric.errorCount} ({metric.errorRate.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Edge arrow component (CSS-based)
   ================================================================ */

function EdgeArrow({ label, conditional }: { label?: string; conditional?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        minWidth: 32,
        position: 'relative',
      }}
    >
      {/* Line */}
      <div
        style={{
          flex: 1,
          height: conditional ? 2 : 2,
          background: conditional
            ? `repeating-linear-gradient(90deg, var(--cs-accent) 0, var(--cs-accent) 4px, transparent 4px, transparent 8px)`
            : 'var(--cs-border)',
          minWidth: 20,
        }}
      />
      {/* Arrow head */}
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: `6px solid ${conditional ? 'var(--cs-accent)' : 'var(--cs-border)'}`,
          flexShrink: 0,
        }}
      />
      {/* Label */}
      {label && (
        <span
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 9,
            color: conditional ? 'var(--cs-accent)' : 'var(--cs-fg-muted)',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--cs-font-mono)',
            letterSpacing: '0.02em',
            background: 'var(--cs-bg-base)',
            padding: '0 4px',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ================================================================
   Vertical connector
   ================================================================ */

function VerticalConnector({ label, direction }: { label?: string; direction: 'down' | 'up' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0', position: 'relative' }}>
      {direction === 'down' && (
        <>
          <div style={{ width: 2, height: 16, background: 'var(--cs-border)' }} />
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '6px solid var(--cs-border)',
            }}
          />
        </>
      )}
      {direction === 'up' && (
        <>
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '6px solid var(--cs-border)',
            }}
          />
          <div style={{ width: 2, height: 16, background: 'var(--cs-border)' }} />
        </>
      )}
      {label && (
        <span
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 9,
            color: 'var(--cs-accent)',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--cs-font-mono)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ================================================================
   Branch label component
   ================================================================ */

function BranchLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'var(--cs-accent-bg, rgba(99, 102, 241, 0.08))',
        borderRadius: 'var(--cs-radius-full, 9999px)',
        fontSize: 10,
        color: 'var(--cs-accent)',
        fontFamily: 'var(--cs-font-mono)',
        fontWeight: 500,
        letterSpacing: '0.04em',
      }}
    >
      <GitBranch size={10} />
      {label}
    </div>
  );
}

/* ================================================================
   Row section component
   ================================================================ */

function RowSection({
  row,
  metricsMap,
  nodesMap,
  expandedNode,
  onToggle,
}: {
  row: LayoutRow;
  metricsMap: Map<string, NodeMetric>;
  nodesMap: Map<string, NodePosition>;
  expandedNode: string | null;
  onToggle: (nodeId: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Row label */}
      <div
        style={{
          fontSize: 'var(--cs-text-xs)',
          color: 'var(--cs-fg-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontFamily: 'var(--cs-font-mono)',
          fontWeight: 500,
          paddingLeft: 4,
        }}
      >
        {row.label}
      </div>
      {/* Nodes row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          padding: '8px 0',
        }}
      >
        {row.nodes.map((nodeId, idx) => {
          const node = nodesMap.get(nodeId);
          if (!node) return null;
          const metric = metricsMap.get(nodeId);
          const isTerminal = nodeId === 'START' || nodeId === 'END';

          return (
            <div key={nodeId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <NodeCard
                node={node}
                metric={metric}
                expanded={expandedNode === nodeId}
                onToggle={() => onToggle(nodeId)}
                isTerminal={isTerminal}
              />
              {idx < row.nodes.length - 1 && <EdgeArrow />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   Conditional edges legend section
   ================================================================ */

function ConditionalEdgesLegend() {
  const conditionalGroups = [
    {
      from: 'Generation script',
      routes: [
        { label: 'reel / story', to: 'Generation video' },
        { label: 'carousel / image', to: 'Generation images' },
        { label: 'texte', to: 'Generation caption' },
      ],
    },
    {
      from: 'Controle qualite',
      routes: [
        { label: 'passe', to: 'Moderation' },
        { label: 'reessai', to: 'Generation script' },
        { label: 'echec', to: 'Fin' },
      ],
    },
    {
      from: 'Moderation',
      routes: [
        { label: 'valide', to: 'Revue humaine' },
        { label: 'signale', to: 'Generation script' },
        { label: 'bloque', to: 'Fin' },
      ],
    },
    {
      from: 'Revue humaine',
      routes: [
        { label: 'approuve', to: 'Generation variantes' },
        { label: 'approuve direct', to: 'Fin' },
        { label: 'rejete', to: 'Generation script' },
      ],
    },
  ];

  return (
    <section
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '20px 24px',
        boxShadow: 'var(--cs-shadow-sm)',
      }}
    >
      <h3
        className="cs-display"
        style={{
          margin: '0 0 16px 0',
          fontSize: 'var(--cs-text-sm)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <GitBranch size={14} style={{ color: 'var(--cs-accent)' }} />
        Routages conditionnels
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {conditionalGroups.map((group) => (
          <div
            key={group.from}
            style={{
              padding: '12px 14px',
              background: 'var(--cs-bg-sunken)',
              borderRadius: 'var(--cs-radius)',
              fontSize: 'var(--cs-text-xs)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--cs-fg-primary)' }}>
              {group.from}
            </div>
            {group.routes.map((route) => (
              <div
                key={route.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '3px 0',
                  color: 'var(--cs-fg-secondary)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--cs-accent)',
                    flexShrink: 0,
                  }}
                />
                <span className="cs-mono" style={{ color: 'var(--cs-accent)', fontWeight: 500, minWidth: 90 }}>
                  {route.label}
                </span>
                <span style={{ color: 'var(--cs-fg-muted)' }}>→</span>
                <span>{route.to}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ================================================================
   Summary stats bar
   ================================================================ */

function SummaryBar({ metrics }: { metrics: NodeMetric[] }) {
  const totalNodes = metrics.filter((m) => m.nodeId !== 'START' && m.nodeId !== 'END').length;
  const healthyNodes = metrics.filter((m) => m.status === 'healthy').length;
  const degradedNodes = metrics.filter((m) => m.status === 'degraded').length;
  const errorNodes = metrics.filter((m) => m.status === 'error').length;
  const totalInvocations = metrics.reduce((sum, m) => sum + m.totalInvocations, 0);
  const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        padding: '12px 20px',
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        boxShadow: 'var(--cs-shadow-sm)',
        fontSize: 'var(--cs-text-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--cs-fg-muted)' }}>Noeuds:</span>
        <span className="cs-mono" style={{ fontWeight: 600 }}>{totalNodes}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cs-success, #22c55e)' }} />
        <span style={{ color: 'var(--cs-fg-muted)' }}>Sains:</span>
        <span className="cs-mono" style={{ fontWeight: 600 }}>{healthyNodes}</span>
      </div>
      {degradedNodes > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cs-warning, #f59e0b)' }} />
          <span style={{ color: 'var(--cs-fg-muted)' }}>Degrades:</span>
          <span className="cs-mono" style={{ fontWeight: 600 }}>{degradedNodes}</span>
        </div>
      )}
      {errorNodes > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cs-danger, #ef4444)' }} />
          <span style={{ color: 'var(--cs-fg-muted)' }}>Erreurs:</span>
          <span className="cs-mono" style={{ fontWeight: 600 }}>{errorNodes}</span>
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--cs-fg-muted)' }}>Total invocations:</span>
        <span className="cs-mono" style={{ fontWeight: 600 }}>{totalInvocations}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--cs-fg-muted)' }}>Total erreurs:</span>
        <span className="cs-mono" style={{ fontWeight: 600, color: totalErrors > 0 ? 'var(--cs-danger, #ef4444)' : undefined }}>
          {totalErrors}
        </span>
      </div>
    </div>
  );
}

/* ================================================================
   Main Page
   ================================================================ */

export default function GraphViewerPage() {
  const [data, setData] = useState<AnalyticsWithNodes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai-engine/analytics?includeNodeMetrics=true');
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
    fetchData();
  }, [fetchData]);

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNode((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  // Build lookup maps
  const nodesMap = new Map(NODES.map((n) => [n.id, n]));
  const metricsMap = new Map((data?.nodeMetrics ?? []).map((m) => [m.nodeId, m]));

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[60, 500, 200].map((h, i) => (
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
            Impossible de charger la vue du graphe
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

  if (!data) return null;

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
              Visualisation du graphe LangGraph
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw size={12} />}>
            Actualiser
          </Button>
          <Link href="/admin/content-studio-v2/ai-engine/analytics" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="sm">Analytiques</Button>
          </Link>
          <Link href="/admin/content-studio-v2/ai-engine/config" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="sm">Configuration</Button>
          </Link>
        </div>
      </header>

      {/* Summary bar */}
      <SummaryBar metrics={data.nodeMetrics} />

      {/* Graph visualization */}
      <section
        style={{
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border-hair)',
          borderRadius: 'var(--cs-radius-md)',
          padding: '28px 32px',
          boxShadow: 'var(--cs-shadow-sm)',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Opening sequence */}
          <RowSection
            row={LAYOUT_ROWS[0]!}
            metricsMap={metricsMap}
            nodesMap={nodesMap}
            expandedNode={expandedNode}
            onToggle={handleToggle}
          />

          {/* Branch indicator */}
          <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 32 }}>
            <VerticalConnector direction="down" />

            {/* Video branch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BranchLabel label="reel / story" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {LAYOUT_ROWS[1]!.nodes.map((nodeId, idx) => {
                  const node = nodesMap.get(nodeId);
                  if (!node) return null;
                  return (
                    <div key={nodeId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <NodeCard
                        node={node}
                        metric={metricsMap.get(nodeId)}
                        expanded={expandedNode === nodeId}
                        onToggle={() => handleToggle(nodeId)}
                        isTerminal={false}
                      />
                      {idx < LAYOUT_ROWS[1]!.nodes.length - 1 && <EdgeArrow />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Image/carousel branch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BranchLabel label="carousel / image" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {LAYOUT_ROWS[2]!.nodes.map((nodeId) => {
                  const node = nodesMap.get(nodeId);
                  if (!node) return null;
                  return (
                    <NodeCard
                      key={nodeId}
                      node={node}
                      metric={metricsMap.get(nodeId)}
                      expanded={expandedNode === nodeId}
                      onToggle={() => handleToggle(nodeId)}
                      isTerminal={false}
                    />
                  );
                })}
              </div>
            </div>

            {/* Text branch label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BranchLabel label="texte" />
              <span style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', fontStyle: 'italic' }}>
                → directement vers Generation caption
              </span>
            </div>

            <VerticalConnector direction="down" />
          </div>

          {/* Post-composition */}
          <RowSection
            row={LAYOUT_ROWS[3]!}
            metricsMap={metricsMap}
            nodesMap={nodesMap}
            expandedNode={expandedNode}
            onToggle={handleToggle}
          />

          <div style={{ marginLeft: 32 }}>
            <VerticalConnector direction="down" />
          </div>

          {/* Quality gates */}
          <RowSection
            row={LAYOUT_ROWS[4]!}
            metricsMap={metricsMap}
            nodesMap={nodesMap}
            expandedNode={expandedNode}
            onToggle={handleToggle}
          />

          <div style={{ marginLeft: 32 }}>
            <VerticalConnector direction="down" />
          </div>

          {/* Terminal */}
          <RowSection
            row={LAYOUT_ROWS[5]!}
            metricsMap={metricsMap}
            nodesMap={nodesMap}
            expandedNode={expandedNode}
            onToggle={handleToggle}
          />
        </div>
      </section>

      {/* Conditional edges legend */}
      <ConditionalEdgesLegend />

      {/* Legend */}
      <section
        style={{
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border-hair)',
          borderRadius: 'var(--cs-radius-md)',
          padding: '16px 20px',
          boxShadow: 'var(--cs-shadow-sm)',
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          fontSize: 'var(--cs-text-xs)',
          color: 'var(--cs-fg-muted)',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--cs-fg-secondary)' }}>Legende :</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cs-success, #22c55e)' }} />
          Sain
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cs-warning, #f59e0b)' }} />
          Degrade
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cs-danger, #ef4444)' }} />
          Erreur
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 2, background: 'var(--cs-border)' }} />
          Lien direct
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 2,
              background: `repeating-linear-gradient(90deg, var(--cs-accent) 0, var(--cs-accent) 4px, transparent 4px, transparent 8px)`,
            }}
          />
          Lien conditionnel
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Cliquer un noeud pour voir les details
        </div>
      </section>
    </div>
  );
}
