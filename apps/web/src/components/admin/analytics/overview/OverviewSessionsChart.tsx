/**
 * OverviewSessionsChart — courbe sessions/page_views dans le temps.
 * cf. docs/analytics/05-onglets-specs.md §1.3
 *
 * Recharts AreaChart (sessions) + Line (page_views) bucketé par
 * `granularity` (hour/day/week). Tooltip custom (`AnalyticsTooltip`).
 */
'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { OverviewBucketPoint } from '@/lib/analytics/queries/overview';
import { formatBucket, formatNumber } from '@/lib/analytics/format';

import { AnalyticsTooltip } from '../primitives/AnalyticsTooltip';
import { ChartFrame } from '../primitives/ChartFrame';

interface OverviewSessionsChartProps {
  series: OverviewBucketPoint[];
  granularity: 'hour' | 'day' | 'week';
  loading?: boolean;
  error?: string | null;
}

export function OverviewSessionsChart({
  series,
  granularity,
  loading,
  error,
}: OverviewSessionsChartProps) {
  return (
    <ChartFrame
      title="Sessions et pages vues"
      description="Trafic agrégé sur la période sélectionnée."
      loading={loading}
      error={error}
      isEmpty={!loading && !error && series.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={series}
          margin={{ top: 8, right: 12, bottom: 4, left: -12 }}
          aria-label="Sessions et pages vues dans le temps"
          role="img"
        >
          <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={(v: string) => formatBucket(new Date(v), granularity)}
            stroke="#a8a29e"
            fontSize={11}
            tickMargin={8}
          />
          <YAxis
            stroke="#a8a29e"
            fontSize={11}
            tickFormatter={(v: number) => formatNumber(v)}
            allowDecimals={false}
          />
          <Tooltip
            content={
              <AnalyticsTooltip
                labelFormatter={(label) =>
                  formatBucket(new Date(String(label)), granularity)
                }
                formatter={(value) =>
                  typeof value === 'number' ? formatNumber(value) : value
                }
              />
            }
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#57534e' }}
          />
          <Area
            type="monotone"
            dataKey="sessions"
            name="Sessions"
            stroke="#7c8b76"
            fill="#7c8b76"
            fillOpacity={0.18}
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="pageViews"
            name="Pages vues"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
