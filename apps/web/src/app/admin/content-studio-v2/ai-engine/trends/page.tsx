'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  RefreshCw,
  Sparkles,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/admin/content-studio-v2/primitives';

interface ScoredTrend {
  id: string;
  source: string;
  category: string;
  title: string;
  description: string;
  originalUrl?: string;
  brandRelevance: number;
  viralPotential: number;
  timeSensitivity: number;
  contentFeasibility: number;
  compositeScore: number;
  suggestedFormats: string[];
  suggestedHooks: string[];
  opportunityWindow: string;
  riskAssessment: 'low' | 'medium' | 'high';
  detectedAt: string;
  status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  ingredient: 'Ingrédient',
  routine: 'Routine',
  aesthetic: 'Esthétique',
  cultural: 'Culturel',
  seasonal: 'Saisonnier',
  product: 'Produit',
  celebrity: 'Célébrité',
  meme: 'Mème',
  news: 'Actualité',
};

const CATEGORY_COLORS: Record<string, string> = {
  ingredient: '#8B5CF6',
  routine: '#3B82F6',
  aesthetic: '#EC4899',
  cultural: '#F59E0B',
  seasonal: '#10B981',
  product: '#6366F1',
  news: '#EF4444',
};

const SOURCE_LABELS: Record<string, string> = {
  seasonal: 'Saisonnier',
  evergreen: 'Permanent',
  reddit: 'Reddit',
  google_trends: 'Google Trends',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  manual: 'Manuel',
};

const RISK_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Faible', color: 'var(--cs-success)' },
  medium: { label: 'Moyen', color: 'var(--cs-warning)' },
  high: { label: 'Élevé', color: 'var(--cs-danger)' },
};

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--cs-text-xs)' }}>
      <span style={{ width: 80, color: 'var(--cs-fg-muted)', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--cs-bg-sunken)', overflow: 'hidden' }}>
        <div style={{ width: `${value * 100}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.3s ease' }} />
      </div>
      <span className="cs-mono" style={{ width: 32, textAlign: 'right', color: 'var(--cs-fg-secondary)' }}>
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

export default function TrendsPage() {
  const [trends, setTrends] = useState<ScoredTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const fetchTrends = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ limit: '30', minScore: '0.3' });
      if (refresh) params.set('refresh', 'true');
      if (selectedCategory) params.set('categories', selectedCategory);

      const res = await fetch(`/api/admin/ai-engine/trends?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setTrends(data.trends ?? []);
    } catch {
      setTrends([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  const categories = [...new Set(trends.map((t) => t.category))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p className="cs-eyebrow" style={{ marginBottom: 6 }}>AI Engine</p>
          <h1 className="cs-display" style={{ margin: 0, fontSize: 'var(--cs-text-2xl)', fontWeight: 500, letterSpacing: '-0.01em' }}>
            Veille & Tendances
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" leftIcon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />} onClick={() => fetchTrends(true)} disabled={refreshing}>
            Actualiser
          </Button>
          <Link href="/admin/content-studio-v2/ai-engine" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" leftIcon={<TrendingUp size={14} />}>Dashboard</Button>
          </Link>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} style={{ color: 'var(--cs-fg-muted)' }} />
        <button
          onClick={() => setSelectedCategory('')}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--cs-radius-full)',
            border: `1px solid ${selectedCategory === '' ? 'var(--cs-accent)' : 'var(--cs-border)'}`,
            background: selectedCategory === '' ? 'var(--cs-accent)' : 'transparent',
            color: selectedCategory === '' ? '#fff' : 'var(--cs-fg-secondary)',
            fontSize: 'var(--cs-text-xs)',
            cursor: 'pointer',
          }}
        >
          Toutes
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--cs-radius-full)',
              border: `1px solid ${cat === selectedCategory ? (CATEGORY_COLORS[cat] ?? 'var(--cs-accent)') : 'var(--cs-border)'}`,
              background: cat === selectedCategory ? (CATEGORY_COLORS[cat] ?? 'var(--cs-accent)') : 'transparent',
              color: cat === selectedCategory ? '#fff' : 'var(--cs-fg-secondary)',
              fontSize: 'var(--cs-text-xs)',
              cursor: 'pointer',
            }}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ background: 'var(--cs-bg-elevated)', border: '1px solid var(--cs-border)', borderRadius: 'var(--cs-radius-md)', height: 160, padding: 16 }} />
          ))}
        </div>
      ) : trends.length === 0 ? (
        <div style={{ background: 'var(--cs-bg-elevated)', border: '1px solid var(--cs-border-hair)', borderRadius: 'var(--cs-radius-lg)', padding: '64px 32px', textAlign: 'center' }}>
          <TrendingUp size={32} style={{ color: 'var(--cs-fg-muted)', marginBottom: 12 }} />
          <p style={{ fontSize: 'var(--cs-text-base)', color: 'var(--cs-fg-secondary)' }}>Aucune tendance détectée pour le moment.</p>
          <Button variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => fetchTrends(true)} style={{ marginTop: 12 }}>
            Lancer une collecte
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {trends.map((trend) => {
            const risk = RISK_CONFIG[trend.riskAssessment] ?? RISK_CONFIG['low']!;
            const catColor = CATEGORY_COLORS[trend.category] ?? 'var(--cs-accent)';

            return (
              <article
                key={trend.id}
                style={{
                  background: 'var(--cs-bg-elevated)',
                  border: '1px solid var(--cs-border-hair)',
                  borderRadius: 'var(--cs-radius-md)',
                  padding: '20px 22px',
                  boxShadow: 'var(--cs-shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--cs-radius-full)',
                        background: `${catColor}20`,
                        color: catColor,
                        fontSize: 'var(--cs-text-xs)',
                        fontWeight: 500,
                      }}>
                        {CATEGORY_LABELS[trend.category] ?? trend.category}
                      </span>
                      <span style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
                        {SOURCE_LABELS[trend.source] ?? trend.source}
                      </span>
                      {trend.riskAssessment !== 'low' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 'var(--cs-text-xs)', color: risk.color }}>
                          <AlertTriangle size={10} /> {risk.label}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: 0, fontSize: 'var(--cs-text-base)', fontWeight: 500, fontFamily: 'var(--cs-font-display)' }}>
                      {trend.title}
                    </h3>
                    <p style={{ margin: '6px 0 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)', lineHeight: 1.5 }}>
                      {trend.description}
                    </p>
                  </div>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 'var(--cs-radius)',
                    background: `linear-gradient(135deg, ${catColor}15, ${catColor}30)`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}>
                    <span className="cs-mono" style={{ fontSize: 'var(--cs-text-lg)', fontWeight: 600, color: catColor }}>
                      {Math.round(trend.compositeScore * 100)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <ScoreBar label="Marque" value={trend.brandRelevance} color="var(--cs-accent)" />
                  <ScoreBar label="Viralité" value={trend.viralPotential} color="#EC4899" />
                  <ScoreBar label="Urgence" value={trend.timeSensitivity} color="#F59E0B" />
                  <ScoreBar label="Faisabilité" value={trend.contentFeasibility} color="#10B981" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--cs-border-hair)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {trend.suggestedFormats.map((fmt) => (
                      <span key={fmt} style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--cs-radius-sm)',
                        background: 'var(--cs-bg-sunken)',
                        fontSize: 'var(--cs-text-xs)',
                        color: 'var(--cs-fg-secondary)',
                      }}>
                        {fmt}
                      </span>
                    ))}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
                      <Clock size={10} /> {trend.opportunityWindow}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {trend.originalUrl && (
                      <a href={trend.originalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cs-fg-muted)' }}>
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <Link
                      href={`/admin/content-studio-v2/ai-engine/create?trend=${encodeURIComponent(trend.title)}&category=${trend.category}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <Button size="sm" leftIcon={<Sparkles size={12} />}>
                        Créer un contenu
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
