/**
 * Barrel des primitives analytics partagées.
 * cf. docs/analytics/04-ui-design.md §3
 */
export { AnalyticsTabs, ANALYTICS_TABS } from './AnalyticsTabs';
export type { AnalyticsTab } from './AnalyticsTabs';
export { AnalyticsTooltip } from './AnalyticsTooltip';
export { ChartFrame } from './ChartFrame';
export { DataTable } from './DataTable';
export type { DataTableColumn } from './DataTable';
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
export { ExportCsvButton, buildCsv } from './ExportCsvButton';
export type { CsvColumn } from './ExportCsvButton';
export { FilterBar } from './FilterBar';
export { KpiCard } from './KpiCard';
export type { KpiDelta, KpiFormat } from './KpiCard';
export { Skeleton } from './Skeleton';
