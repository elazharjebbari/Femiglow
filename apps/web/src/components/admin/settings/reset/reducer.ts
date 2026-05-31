import type {
  ResetMode, ResetDomain, PreservableTable, ResetEvent, ResetPlan, PhaseName,
} from '@/lib/reset/types';
import type { WizardState, WizardStep, FinalReport } from './types';
import { DEFAULT_PRESERVE } from './types';

export type WizardAction =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GOTO'; step: WizardStep }
  | { type: 'SET_MODE'; mode: ResetMode }
  | { type: 'TOGGLE_DOMAIN'; domain: ResetDomain }
  | { type: 'TOGGLE_PRESERVE'; table: PreservableTable }
  | { type: 'SET_WIPE_MEDIA'; v: boolean }
  | { type: 'SET_WIPE_CACHE'; v: boolean }
  | { type: 'SET_BACKUP'; v: boolean }
  | { type: 'SET_KEEP_BACKUPS'; v: number }
  | { type: 'SET_DRY_RUN'; v: boolean }
  | { type: 'SET_CONFIRM'; v: string }
  | { type: 'PREFLIGHT_LOADING'; v: boolean }
  | { type: 'PREFLIGHT_OK'; plan: ResetPlan; rowCounts: Record<string, number> }
  | { type: 'PREFLIGHT_ERROR'; error: { code: string; message: string } }
  | { type: 'START_JOB'; jobId: string; plan: ResetPlan }
  | { type: 'EVENT'; event: ResetEvent }
  | { type: 'RESET_WIZARD' };

export function initialState(): WizardState {
  const phases: Record<string, never> = {};
  return {
    step: 'welcome',
    mode: null,
    domains: [],
    preserve: [...DEFAULT_PRESERVE],
    wipeMedia: false,
    wipeNextCache: false,
    withBackup: true,
    keepBackups: 5,
    dryRun: false,
    confirm: '',
    jobId: null,
    jobStatus: null,
    plan: null,
    rowCounts: {},
    events: [],
    phases: phases as unknown as WizardState['phases'],
    finalReport: null,
    error: null,
    preflightLoading: false,
    rollback: null,
  };
}

const ORDER: WizardStep[] = ['welcome', 'mode', 'custom', 'preservation', 'preview', 'confirm', 'execute', 'report'];

function nextStep(s: WizardState): WizardStep {
  const idx = ORDER.indexOf(s.step);
  let target = ORDER[idx + 1] ?? s.step;
  // skip 'custom' when mode != 'custom'
  if (target === 'custom' && s.mode !== 'custom') target = 'preservation';
  return target;
}

function prevStep(s: WizardState): WizardStep {
  const idx = ORDER.indexOf(s.step);
  let target = ORDER[idx - 1] ?? s.step;
  if (target === 'custom' && s.mode !== 'custom') target = 'mode';
  return target;
}

export function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT': {
      if (state.step === 'execute' || state.step === 'report') return state;
      return { ...state, step: nextStep(state), error: null };
    }
    case 'BACK': {
      if (state.step === 'execute' || state.step === 'report') return state;
      return { ...state, step: prevStep(state), error: null };
    }
    case 'GOTO': return { ...state, step: action.step };
    case 'SET_MODE': {
      const wipeMedia = action.mode === 'hard';
      const wipeNextCache = action.mode === 'hard';
      return { ...state, mode: action.mode, wipeMedia, wipeNextCache, confirm: '' };
    }
    case 'TOGGLE_DOMAIN': {
      const set = new Set(state.domains);
      if (set.has(action.domain)) set.delete(action.domain);
      else set.add(action.domain);
      return { ...state, domains: Array.from(set) };
    }
    case 'TOGGLE_PRESERVE': {
      if (action.table === 'admin_users' || action.table === 'audit_events') return state;
      const set = new Set(state.preserve);
      if (set.has(action.table)) set.delete(action.table);
      else set.add(action.table);
      return { ...state, preserve: Array.from(set) };
    }
    case 'SET_WIPE_MEDIA': return { ...state, wipeMedia: action.v };
    case 'SET_WIPE_CACHE': return { ...state, wipeNextCache: action.v };
    case 'SET_BACKUP': return { ...state, withBackup: action.v };
    case 'SET_KEEP_BACKUPS': return { ...state, keepBackups: action.v };
    case 'SET_DRY_RUN': return { ...state, dryRun: action.v };
    case 'SET_CONFIRM': return { ...state, confirm: action.v };
    case 'PREFLIGHT_LOADING': return { ...state, preflightLoading: action.v, error: null };
    case 'PREFLIGHT_OK': return {
      ...state, preflightLoading: false, plan: action.plan, rowCounts: action.rowCounts,
    };
    case 'PREFLIGHT_ERROR': return { ...state, preflightLoading: false, error: action.error };
    case 'START_JOB': return {
      ...state, jobId: action.jobId, plan: action.plan, jobStatus: 'running',
      step: 'execute', events: [], phases: makeInitialPhases(action.plan.phases.map((p) => p.name)),
    };
    case 'EVENT': return applyEvent(state, action.event);
    case 'RESET_WIZARD': return initialState();
    default: return state;
  }
}

function makeInitialPhases(names: PhaseName[]): WizardState['phases'] {
  const out = {} as WizardState['phases'];
  for (const n of names) out[n] = { status: 'pending' };
  return out;
}

function applyEvent(state: WizardState, ev: ResetEvent): WizardState {
  const events = [...state.events, ev];
  if (events.length > 500) events.splice(0, events.length - 500);
  const phases = { ...state.phases };
  let finalReport: FinalReport | null = state.finalReport;
  let jobStatus = state.jobStatus;
  let rollback = state.rollback;

  switch (ev.type) {
    case 'phase.start': {
      phases[ev.phase] = { ...phases[ev.phase], status: 'running', startedAt: ev.ts };
      break;
    }
    case 'phase.progress': {
      const cur = phases[ev.phase] ?? { status: 'pending' as const };
      phases[ev.phase] = { ...cur, fraction: ev.fraction, summary: ev.label };
      break;
    }
    case 'phase.complete': {
      phases[ev.phase] = {
        ...phases[ev.phase], status: 'done',
        durationMs: ev.durationMs, summary: ev.summary,
      };
      break;
    }
    case 'phase.error': {
      phases[ev.phase] = {
        ...phases[ev.phase], status: 'error',
        durationMs: ev.durationMs, errorMessage: ev.error.message,
      };
      break;
    }
    case 'rollback.start':
      rollback = { active: true, progress: 0, done: false };
      break;
    case 'rollback.progress':
      rollback = { active: true, progress: ev.fraction, done: false };
      break;
    case 'rollback.complete':
      rollback = { active: false, progress: 1, done: true };
      break;
    case 'rollback.failed':
      rollback = { active: false, progress: 1, done: true, failed: true };
      break;
    case 'job.complete': {
      jobStatus = 'completed';
      finalReport = {
        status: 'completed',
        durationMs: ev.durationMs,
        backupId: ev.summary.backupId,
        verify: ev.summary.verify,
        seedersReport: ev.summary.seedersReport,
      };
      break;
    }
    case 'job.failed': {
      jobStatus = 'failed';
      finalReport = {
        status: 'failed',
        durationMs: ev.durationMs,
        errorCode: ev.errorCode,
        errorMessage: ev.message,
        rolledBack: ev.rolledBack,
      };
      break;
    }
    case 'job.cancelled':
      jobStatus = 'cancelled';
      finalReport = { status: 'cancelled', durationMs: Date.now() - (state.events[0]?.ts ?? Date.now()) };
      break;
    default:
      break;
  }
  const newStep = (ev.type === 'job.complete' || ev.type === 'job.failed' || ev.type === 'job.cancelled')
    ? 'report' : state.step;
  return { ...state, events, phases, finalReport, jobStatus, rollback, step: newStep };
}
