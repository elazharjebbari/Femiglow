/**
 * CHA-131 / CHA-132 — `<PipelineGraph>` SVG.
 *
 * 8 nœuds : Visiteur → Sanitize → Lang → Charter → RAG → Provider →
 * Stream → Response. Edges animés via `<animateMotion>` quand un
 * pulse arrive (cf. CHA-135 SSE visualisation/stream).
 *
 * Composant 100 % SVG inline, pas de dépendance lourde. Légère
 * animation CSS via classes.
 */
'use client';

import { useEffect, useState } from 'react';

interface PipelineGraphProps {
  /**
   * Optional async iterable de pulses ; chaque pulse {edge, sessionId}
   * déclenche une animation sur l'edge correspondant.
   */
  pulseStream?: AsyncIterable<{ edge: string; latencyMs?: number }>;
  /** Affiche les compteurs à côté de chaque nœud. */
  counters?: Record<string, number>;
}

interface NodeDef {
  id: string;
  label: string;
  cx: number;
  cy: number;
}

const NODES: NodeDef[] = [
  { id: 'visitor', label: 'Visiteur', cx: 80, cy: 100 },
  { id: 'sanitize', label: 'Sanitize', cx: 220, cy: 100 },
  { id: 'lang', label: 'Lang', cx: 360, cy: 100 },
  { id: 'charter', label: 'Charter', cx: 500, cy: 100 },
  { id: 'rag', label: 'RAG', cx: 640, cy: 60 },
  { id: 'provider', label: 'Provider', cx: 640, cy: 140 },
  { id: 'stream', label: 'Stream', cx: 780, cy: 100 },
  { id: 'response', label: 'Réponse', cx: 920, cy: 100 },
];

const EDGES: Array<{ id: string; from: string; to: string }> = [
  { id: 'visitor-sanitize', from: 'visitor', to: 'sanitize' },
  { id: 'sanitize-lang', from: 'sanitize', to: 'lang' },
  { id: 'lang-charter', from: 'lang', to: 'charter' },
  { id: 'charter-rag', from: 'charter', to: 'rag' },
  { id: 'charter-provider', from: 'charter', to: 'provider' },
  { id: 'rag-provider', from: 'rag', to: 'provider' },
  { id: 'provider-stream', from: 'provider', to: 'stream' },
  { id: 'stream-response', from: 'stream', to: 'response' },
];

export function PipelineGraph({ pulseStream, counters }: PipelineGraphProps) {
  const [activeEdge, setActiveEdge] = useState<string | null>(null);

  useEffect(() => {
    if (!pulseStream) return;
    let alive = true;
    (async () => {
      for await (const pulse of pulseStream) {
        if (!alive) break;
        setActiveEdge(pulse.edge);
        // Reset après 600 ms pour permettre le retour au repos.
        const t = setTimeout(() => alive && setActiveEdge(null), 600);
        await new Promise<void>((r) => setTimeout(r, 50));
        clearTimeout(t);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pulseStream]);

  return (
    <svg
      viewBox="0 0 1000 200"
      role="img"
      aria-label="Pipeline du chat"
      className="w-full max-w-4xl"
    >
      {/* Edges */}
      {EDGES.map((edge) => {
        const a = NODES.find((n) => n.id === edge.from)!;
        const b = NODES.find((n) => n.id === edge.to)!;
        const active = activeEdge === edge.id;
        return (
          <g key={edge.id}>
            <line
              x1={a.cx}
              y1={a.cy}
              x2={b.cx}
              y2={b.cy}
              stroke={active ? '#1c1917' : '#d6d3d1'}
              strokeWidth={active ? 2.5 : 1.5}
            />
            {active && (
              <circle r={4} fill="#1c1917">
                <animateMotion
                  dur="0.5s"
                  path={`M ${a.cx} ${a.cy} L ${b.cx} ${b.cy}`}
                  fill="freeze"
                />
              </circle>
            )}
          </g>
        );
      })}
      {/* Nodes */}
      {NODES.map((n) => (
        <g key={n.id}>
          <circle
            cx={n.cx}
            cy={n.cy}
            r={28}
            fill="white"
            stroke="#1c1917"
            strokeWidth={1.5}
          />
          <text
            x={n.cx}
            y={n.cy + 4}
            textAnchor="middle"
            fontSize={10}
            fill="#1c1917"
          >
            {n.label}
          </text>
          {counters?.[n.id] != null && (
            <text
              x={n.cx}
              y={n.cy + 48}
              textAnchor="middle"
              fontSize={10}
              fill="#78716c"
            >
              {counters[n.id]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
