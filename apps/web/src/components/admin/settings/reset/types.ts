/**
 * Types front-end pour le wizard reset.
 */
import type {
  ResetMode, ResetDomain, PreservableTable, ResetEvent, PhaseName,
  JobStatus, ResetPlan, VerificationCheck,
} from '@/lib/reset/types';

export type WizardStep =
  | 'welcome' | 'mode' | 'custom' | 'preservation'
  | 'preview' | 'confirm' | 'execute' | 'report';

export interface WizardState {
  step: WizardStep;
  mode: ResetMode | null;
  domains: ResetDomain[];
  preserve: PreservableTable[];
  wipeMedia: boolean;
  wipeNextCache: boolean;
  withBackup: boolean;
  keepBackups: number;
  dryRun: boolean;
  confirm: string;
  // Runtime
  jobId: string | null;
  jobStatus: JobStatus | null;
  plan: ResetPlan | null;
  rowCounts: Record<string, number>;
  events: ResetEvent[];
  phases: Record<PhaseName, PhaseUiState>;
  finalReport: FinalReport | null;
  error: { code: string; message: string } | null;
  preflightLoading: boolean;
  rollback: { active: boolean; progress: number; done: boolean; failed?: boolean } | null;
}

export interface PhaseUiState {
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  startedAt?: number;
  durationMs?: number;
  summary?: string;
  errorMessage?: string;
  fraction?: number;
}

export interface FinalReport {
  status: 'completed' | 'failed' | 'cancelled';
  durationMs: number;
  backupId?: string;
  errorCode?: string;
  errorMessage?: string;
  rolledBack?: boolean;
  verify?: { passed: number; failed: number; warnings: number; checks: VerificationCheck[] };
  seedersReport?: { completed: number; failed: number };
}

export const DEFAULT_PRESERVE: PreservableTable[] = [
  'admin_users', 'audit_events', 'orders', 'order_items',
  'leads', 'lead_events', 'chat_lead', 'ritual_testimonials',
];

export const ALWAYS_PRESERVED: PreservableTable[] = ['admin_users', 'audit_events'];

export const DOMAIN_LABELS: Record<ResetDomain, string> = {
  commerce: 'Commerce (produits, formulaires, villes)',
  content: 'Contenu (composants, médias, SEO, témoignages)',
  tracking: 'Tracking & Analytics',
  chat: 'Chat (instructions, theme, providers)',
  system: 'System (app_config nav/flags/rbac/branding)',
};
