/**
 * CHA-131 / CHA-132 — `<PipelineGraph>` SVG.
 *
 * MAJ CHA-230 — pipeline post-refactor LangChain :
 *
 *   visitor → sanitize → lang → intent → charter
 *                                          ↓
 *                                    rag (top)
 *                                          ↓
 *                                    provider  ← retry / breaker
 *                                          ↓
 *                                       stream → humanize → response → lead
 *
 * Soit 11 nœuds + 11 arêtes (vs. 8/8 avant). On a ajouté :
 *   - `intent` : classification regex pondérée + LLM tool-call (Phase 2),
 *     fallback sur regex si LLM panne (no-throw garanti).
 *   - `humanize` : post-traitement de la réponse (apostrophes typographiques,
 *     espaces fines, lissage darija — cf. services/humanize.ts).
 *   - `lead` : décision d'offrir le formulaire de capture (lead-decision.ts +
 *     phone-detect.ts) après chaque réponse.
 *   - sub-label "retry / breaker" sur `provider` pour rappeler que le runnable
 *     `respond-stream.runnable.ts` retry et bascule vers le fallback en cas
 *     de panne (CHA-229) — uniquement quand `CHAT_PROVIDER_FALLBACK_ENABLED=true`.
 *
 * Edges animés via `<animateMotion>` quand un pulse arrive sur le SSE
 * `/api/admin/chat/visualisation/stream` (cf. CHA-135). Compatible avec
 * l'export SVG/Mermaid (`/api/admin/chat/visualisation/export`).
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
  /** Petit texte sous le nœud (en italique, gris) pour adornement. */
  sub?: string;
}

/**
 * Layout : ligne principale y=110, RAG seul en y=55 au-dessus de Provider.
 *
 * Espacement horizontal ~110-120 px entre les nœuds — les cercles r=28 ne
 * se touchent pas, et les sub-labels (italique gris) tiennent dessous sans
 * empiéter sur le voisin.
 */
const NODES: NodeDef[] = [
  { id: 'visitor', label: 'Visiteur', cx: 50, cy: 110 },
  { id: 'sanitize', label: 'Sanitize', cx: 160, cy: 110 },
  { id: 'lang', label: 'Lang', cx: 260, cy: 110 },
  { id: 'intent', label: 'Intent', cx: 370, cy: 110, sub: 'regex / LLM' },
  { id: 'charter', label: 'Charte', cx: 480, cy: 110 },
  { id: 'rag', label: 'RAG', cx: 590, cy: 55 },
  { id: 'provider', label: 'Provider', cx: 590, cy: 110, sub: 'retry / breaker' },
  { id: 'stream', label: 'Stream', cx: 700, cy: 110 },
  { id: 'humanize', label: 'Humanize', cx: 820, cy: 110 },
  { id: 'response', label: 'Réponse', cx: 940, cy: 110 },
  { id: 'lead', label: 'Lead', cx: 1080, cy: 110, sub: 'décision form' },
];

/**
 * IMPORTANT : ces edge-IDs DOIVENT rester synchronisés avec
 * `pulsesForEvent()` dans
 * `src/app/api/admin/chat/visualisation/stream/route.ts` —
 * tout changement ici impose une mise à jour là-bas, sinon les pulses
 * SSE n'animeront plus rien.
 */
const EDGES: Array<{ id: string; from: string; to: string }> = [
  { id: 'visitor-sanitize', from: 'visitor', to: 'sanitize' },
  { id: 'sanitize-lang', from: 'sanitize', to: 'lang' },
  { id: 'lang-intent', from: 'lang', to: 'intent' },
  { id: 'intent-charter', from: 'intent', to: 'charter' },
  { id: 'charter-rag', from: 'charter', to: 'rag' },
  { id: 'charter-provider', from: 'charter', to: 'provider' },
  { id: 'rag-provider', from: 'rag', to: 'provider' },
  { id: 'provider-stream', from: 'provider', to: 'stream' },
  { id: 'stream-humanize', from: 'stream', to: 'humanize' },
  { id: 'humanize-response', from: 'humanize', to: 'response' },
  { id: 'response-lead', from: 'response', to: 'lead' },
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
      viewBox="0 0 1180 200"
      role="img"
      aria-label="Pipeline du chat — visiteur → sanitize → lang → intent → charte → rag → provider → stream → humanize → réponse → lead"
      className="w-full max-w-5xl"
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
          {n.sub && (
            <text
              x={n.cx}
              y={n.cy + 44}
              textAnchor="middle"
              fontSize={8}
              fontStyle="italic"
              fill="#a8a29e"
            >
              {n.sub}
            </text>
          )}
          {counters?.[n.id] != null && (
            <text
              x={n.cx}
              y={n.cy + (n.sub ? 56 : 48)}
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
