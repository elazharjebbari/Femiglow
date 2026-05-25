'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Brain,
  Sparkles,
  Settings,
  Activity,
  Type,
  Image as ImageIcon,
  Video,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { Badge } from '@/components/admin/content-studio-v2/primitives';

interface ProviderStatus {
  name: string;
  provider: string;
  model: string;
  status: 'active' | 'inactive' | 'error';
}

interface HealthData {
  enabled: boolean;
  providers: {
    text?: ProviderStatus;
    image?: ProviderStatus;
    video?: ProviderStatus;
    tts?: ProviderStatus;
  };
  budget: {
    dailyUsedCents: number;
    dailyLimitCents: number;
    monthlyUsedCents: number;
    monthlyLimitCents: number;
  };
}

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  text: <Type size={18} />,
  image: <ImageIcon size={18} />,
  video: <Video size={18} />,
  tts: <Volume2 size={18} />,
};

const PROVIDER_LABELS: Record<string, string> = {
  text: 'Texte / LLM',
  image: 'Images',
  video: 'Vidéo',
  tts: 'Voix / TTS',
};

const STATUS_CONFIG: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger'; icon: React.ReactNode }> = {
  active: { label: 'Actif', tone: 'success', icon: <CheckCircle2 size={12} /> },
  inactive: { label: 'Inactif', tone: 'neutral', icon: <XCircle size={12} /> },
  error: { label: 'Erreur', tone: 'danger', icon: <AlertTriangle size={12} /> },
};

function BudgetBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color =
    pct >= 90
      ? 'var(--cs-danger)'
      : pct >= 70
        ? 'var(--cs-warning)'
        : 'var(--cs-success)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>{label}</span>
        <span className="cs-mono" style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
          {(used / 100).toFixed(2)} / {(limit / 100).toFixed(2)} MAD
        </span>
      </div>
      <div
        style={{
          height: 6,
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
}

function DisabledState() {
  return (
    <section
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-lg)',
        padding: '64px 48px',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        minHeight: 420,
        boxShadow: 'var(--cs-shadow-sm)',
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <div
          style={{
            marginBottom: 24,
            display: 'inline-grid',
            placeItems: 'center',
            width: 72,
            height: 72,
            borderRadius: 'var(--cs-radius-full)',
            background: 'var(--cs-bg-sunken)',
            color: 'var(--cs-accent)',
          }}
        >
          <Brain size={28} />
        </div>
        <p className="cs-eyebrow" style={{ marginBottom: 8 }}>
          AI Engine
        </p>
        <h2
          className="cs-display"
          style={{
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-3xl)',
            fontWeight: 500,
            letterSpacing: '-0.015em',
            color: 'var(--cs-fg-primary)',
          }}
        >
          Module désactivé
        </h2>
        <p
          style={{
            marginTop: 12,
            fontSize: 'var(--cs-text-base)',
            color: 'var(--cs-fg-secondary)',
            lineHeight: 1.6,
          }}
        >
          Activez <code style={{ fontFamily: 'var(--cs-font-mono)' }}>AI_ENGINE_ENABLED=true</code> et
          configurez au moins une clé API pour utiliser le moteur IA.
        </p>
      </div>
    </section>
  );
}

export default function AIEngineDashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchHealth() {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch('/api/admin/ai-engine/health', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const data = await res.json();
        if (!cancelled) setHealth(data);
      } catch (e: unknown) {
        clearTimeout(timeoutId);
        if (!cancelled) {
          if (e instanceof DOMException && e.name === 'AbortError') {
            setError('Délai d\'attente dépassé (5s). Le serveur met trop de temps à répondre.');
          } else {
            setError(e instanceof Error ? e.message : 'Erreur inconnue');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHealth();
    return () => { cancelled = true; };
  }, [retryCount]);

  const handleRetry = () => setRetryCount((c) => c + 1);

  if (loading && !health) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[220, 120, 120].map((h, i) => (
          <div
            key={i}
            style={{
              background: 'var(--cs-bg-elevated)',
              border: '1px solid var(--cs-border)',
              borderRadius: 'var(--cs-radius-md)',
              minHeight: h,
              padding: 16,
            }}
          />
        ))}
      </div>
    );
  }

  if (error && !health) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p className="cs-eyebrow" style={{ marginBottom: 6 }}>AI Engine</p>
            <h1
              className="cs-display"
              style={{
                margin: 0,
                fontSize: 'var(--cs-text-2xl)',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              Tableau de bord
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/admin/content-studio-v2/ai-engine/create" style={{ textDecoration: 'none' }}>
              <Button leftIcon={<Sparkles size={14} />}>Nouvelle génération IA</Button>
            </Link>
            <Link href="/admin/content-studio-v2/ai-engine/config" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" leftIcon={<Settings size={14} />}>Configuration</Button>
            </Link>
          </div>
        </header>

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
              Statut indisponible
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>
              {error}
            </p>
          </div>
          <Button variant="ghost" onClick={handleRetry} leftIcon={<Activity size={14} />}>
            Réessayer
          </Button>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          {['text', 'image', 'video', 'tts'].map((key) => (
            <div
              key={key}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--cs-radius)',
                      background: 'var(--cs-bg-sunken)',
                      color: 'var(--cs-accent)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {PROVIDER_ICONS[key]}
                  </span>
                  <span style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-sm)' }}>
                    {PROVIDER_LABELS[key] ?? key}
                  </span>
                </div>
                <Badge tone="neutral" size="sm">
                  <span style={{ marginLeft: 2 }}>Chargement...</span>
                </Badge>
              </div>
              <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
                <div>Fournisseur : <span style={{ color: 'var(--cs-fg-secondary)' }}>---</span></div>
                <div>Modèle : <span className="cs-mono" style={{ color: 'var(--cs-fg-secondary)' }}>---</span></div>
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (!health?.enabled) {
    return <DisabledState />;
  }

  const providerEntries = Object.entries(health.providers) as [string, ProviderStatus | undefined][];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p className="cs-eyebrow" style={{ marginBottom: 6 }}>AI Engine</p>
          <h1
            className="cs-display"
            style={{
              margin: 0,
              fontSize: 'var(--cs-text-2xl)',
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            Tableau de bord
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/content-studio-v2/ai-engine/create" style={{ textDecoration: 'none' }}>
            <Button leftIcon={<Sparkles size={14} />}>Nouvelle génération IA</Button>
          </Link>
          <Link href="/admin/content-studio-v2/ai-engine/config" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" leftIcon={<Settings size={14} />}>Configuration</Button>
          </Link>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        {providerEntries.map(([key, prov]) => {
          if (!prov) return null;
          const cfgEntry = STATUS_CONFIG[prov.status] ?? STATUS_CONFIG['inactive'];
          if (!cfgEntry) return null;
          return (
            <div
              key={key}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--cs-radius)',
                      background: 'var(--cs-bg-sunken)',
                      color: 'var(--cs-accent)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {PROVIDER_ICONS[key]}
                  </span>
                  <span style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-sm)' }}>
                    {PROVIDER_LABELS[key] ?? key}
                  </span>
                </div>
                <Badge tone={cfgEntry.tone} size="sm">
                  {cfgEntry.icon}
                  <span style={{ marginLeft: 2 }}>{cfgEntry.label}</span>
                </Badge>
              </div>
              <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
                <div>Fournisseur : <span style={{ color: 'var(--cs-fg-secondary)' }}>{prov.provider}</span></div>
                <div>Modèle : <span className="cs-mono" style={{ color: 'var(--cs-fg-secondary)' }}>{prov.model}</span></div>
              </div>
            </div>
          );
        })}
      </section>

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
          <h2
            className="cs-display"
            style={{ margin: 0, fontSize: 'var(--cs-text-lg)', fontWeight: 500 }}
          >
            Consommation budget
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <BudgetBar
            label="Budget journalier"
            used={health.budget.dailyUsedCents}
            limit={health.budget.dailyLimitCents}
          />
          <BudgetBar
            label="Budget mensuel"
            used={health.budget.monthlyUsedCents}
            limit={health.budget.monthlyLimitCents}
          />
        </div>
      </section>

      <section
        style={{
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border-hair)',
          borderRadius: 'var(--cs-radius-md)',
          padding: '20px 24px',
          boxShadow: 'var(--cs-shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--cs-radius)',
            background: 'var(--cs-accent-bg)',
            color: 'var(--cs-accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Activity size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 500, fontSize: 'var(--cs-text-sm)' }}>
            Moteur IA actif
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
            Toutes les fonctionnalités de génération automatique sont disponibles.
          </p>
        </div>
        <Badge tone="success" size="sm">
          <CheckCircle2 size={10} />
          <span style={{ marginLeft: 2 }}>Opérationnel</span>
        </Badge>
      </section>
    </div>
  );
}
