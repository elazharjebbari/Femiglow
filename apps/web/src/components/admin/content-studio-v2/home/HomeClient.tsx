'use client';

import { CheckCircle2, Coins } from 'lucide-react';
import type { DashboardSnapshot } from '@/lib/content-studio/dashboard';
import { MetricCard } from './MetricCard';
import { PostsThisWeekCard } from './PostsThisWeekCard';
import { DraftsAwaitingCard } from './DraftsAwaitingCard';
import { TopPerformersCard } from './TopPerformersCard';
import { AccountHealthCard } from './AccountHealthCard';
import { BrandHealthCard } from './BrandHealthCard';
import { ActivityFeed } from './ActivityFeed';
import type { ActivityRow } from './activity';
import type { BrandHealthSummary } from './brand-health';

interface HomeClientProps {
  snapshot: DashboardSnapshot;
  activity: ActivityRow[];
  brandHealth: BrandHealthSummary;
}

/**
 * Orchestrates the /home dashboard layout. Responsive 12-col-ish grid :
 *  - mobile (≤ 640px)   → 1 col
 *  - tablet (≤ 1024px)  → 2 cols
 *  - desktop (> 1024px) → 3 cols + hero spans 2 cols
 *
 * Implemented with CSS Grid + auto-fill so we don't drag-in a layout
 * library just for this page.
 */
export function HomeClient({ snapshot, activity, brandHealth }: HomeClientProps) {
  const { postsThisWeek, jobSuccessRate, monthlyAiCost, draftsAwaitingReview, accountHealth, topPerformers } = snapshot;

  return (
    <div className="cs-home" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p className="cs-eyebrow">Accueil</p>
        <h1
          className="cs-display"
          style={{
            margin: 0,
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-3xl)',
            fontWeight: 500,
            letterSpacing: '-0.015em',
            color: 'var(--cs-fg-primary)',
          }}
        >
          Tableau de bord
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--cs-text-base)',
            color: 'var(--cs-fg-secondary)',
            maxWidth: 640,
          }}
        >
          Vue synthétique : publications hebdo, brouillons en attente, comptes sociaux, santé brand et activité admin.
        </p>
      </header>

      {/* Hero row : posts this week (span 2) + small KPIs stacked. */}
      <section
        className="cs-home-hero"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        <div style={{ gridColumn: 'span 2', minWidth: 0 }} className="cs-home-hero-main">
          <PostsThisWeekCard data={postsThisWeek} />
        </div>
        <DraftsAwaitingCard data={draftsAwaitingReview} />
        <MetricCard
          label="Taux de succès jobs"
          value={`${jobSuccessRate.rate}%`}
          subline={`${jobSuccessRate.published} OK / ${jobSuccessRate.failed} KO · drafts exclus`}
          tone={successTone(jobSuccessRate.rate, jobSuccessRate.total)}
          icon={<CheckCircle2 size={16} />}
          href="/admin/content-studio-v2/library?postiz_state=draft"
          ariaLabel={`Taux de succès jobs : ${jobSuccessRate.rate} pourcent`}
        />
        <MetricCard
          label={`Coût IA — ${monthlyAiCost.monthLabel}`}
          value={`${(monthlyAiCost.cents / 100).toFixed(2)} €`}
          subline={`${monthlyAiCost.runs} runs ce mois-ci`}
          tone="saffron"
          icon={<Coins size={16} />}
        />
      </section>

      {/* Secondary row : performance + health cards. */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        <TopPerformersCard rows={topPerformers} />
        <BrandHealthCard data={brandHealth} />
        <AccountHealthCard rows={accountHealth} />
      </section>

      {/* Activity feed at the bottom. */}
      <section>
        <ActivityFeed rows={activity} />
      </section>

      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: 'var(--cs-fg-muted)',
          fontFamily: 'var(--cs-font-mono)',
        }}
      >
        Snapshot généré à {snapshot.generatedAt.toISOString()}.
      </p>

      <style>{`
        @media (max-width: 1024px) {
          .cs-home-hero-main { grid-column: span 1 !important; }
        }
      `}</style>
    </div>
  );
}

function successTone(rate: number, total: number): 'neutral' | 'sage' | 'saffron' | 'danger' {
  if (total === 0) return 'neutral';
  if (rate >= 90) return 'sage';
  if (rate >= 70) return 'saffron';
  return 'danger';
}
