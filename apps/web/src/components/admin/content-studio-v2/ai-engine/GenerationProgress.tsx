'use client';

import { useEffect, useRef, useState } from 'react';
import { Circle, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export type StepStatus = 'pending' | 'running' | 'done' | 'error';

export interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  durationMs?: number;
}

export const PIPELINE_STEPS: { id: string; label: string }[] = [
  { id: 'parse_brief', label: 'Analyse du brief' },
  { id: 'enrich_knowledge', label: 'Enrichissement contextuel' },
  { id: 'generate_script', label: 'Rédaction du script' },
  { id: 'generate_images', label: 'Génération des visuels' },
  { id: 'quality_check', label: 'Contrôle qualité' },
  { id: 'done', label: 'Terminé' },
];

interface GenerationProgressProps {
  steps: PipelineStep[];
  totalCost?: number;
}

const statusIcon: Record<StepStatus, React.ReactNode> = {
  pending: <Circle size={16} />,
  running: <Loader2 size={16} className="cs-spin" />,
  done: <CheckCircle2 size={16} />,
  error: <XCircle size={16} />,
};

const statusColor: Record<StepStatus, string> = {
  pending: 'var(--cs-fg-muted)',
  running: 'var(--cs-accent)',
  done: 'var(--cs-success)',
  error: 'var(--cs-danger)',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function GenerationProgress({ steps, totalCost }: GenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  const isRunning = steps.some((s) => s.status === 'running');

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    return () => clearInterval(id);
  }, [isRunning]);

  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '24px 28px',
        boxShadow: 'var(--cs-shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3
          className="cs-display"
          style={{
            fontSize: 'var(--cs-text-lg)',
            fontWeight: 500,
            margin: 0,
          }}
        >
          Pipeline de génération
        </h3>
        {isRunning && (
          <span
            className="cs-mono"
            style={{
              fontSize: 'var(--cs-text-xs)',
              color: 'var(--cs-fg-muted)',
            }}
          >
            {formatDuration(elapsed)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <div key={step.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ color: statusColor[step.status], display: 'flex' }}>
                  {statusIcon[step.status]}
                </span>
                {!isLast && (
                  <div
                    style={{
                      width: 1.5,
                      flex: 1,
                      minHeight: 20,
                      background: step.status === 'done' ? 'var(--cs-success)' : 'var(--cs-border)',
                      transition: 'background var(--cs-motion-base) var(--cs-easing)',
                    }}
                  />
                )}
              </div>
              <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 'var(--cs-text-sm)',
                      fontWeight: step.status === 'running' ? 600 : 400,
                      color: step.status === 'pending' ? 'var(--cs-fg-muted)' : 'var(--cs-fg-primary)',
                      transition: 'color var(--cs-motion-fast) var(--cs-easing)',
                    }}
                  >
                    {step.label}
                  </span>
                  {step.durationMs != null && (
                    <span
                      className="cs-mono"
                      style={{
                        fontSize: 'var(--cs-text-xs)',
                        color: 'var(--cs-fg-muted)',
                      }}
                    >
                      {formatDuration(step.durationMs)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalCost != null && (
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--cs-border-hair)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>
            Coût estimé
          </span>
          <span
            className="cs-mono"
            style={{
              fontSize: 'var(--cs-text-sm)',
              fontWeight: 600,
              color: 'var(--cs-fg-primary)',
            }}
          >
            {(totalCost / 100).toFixed(2)} MAD
          </span>
        </div>
      )}

      <style>{`
        @keyframes cs-spin { to { transform: rotate(360deg); } }
        .cs-spin { animation: cs-spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}
