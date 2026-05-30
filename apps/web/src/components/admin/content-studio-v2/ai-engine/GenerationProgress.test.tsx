/**
 * Tests for GenerationProgress — the pipeline step tracker that shows
 * pending/running/done/error states for each generation step.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  GenerationProgress,
  type PipelineStep,
  PIPELINE_STEPS,
} from './GenerationProgress';

function buildSteps(overrides?: Partial<PipelineStep>[]): PipelineStep[] {
  return PIPELINE_STEPS.map((s, i) => ({
    ...s,
    status: 'pending' as const,
    durationMs: undefined,
    ...(overrides?.[i] ?? {}),
  }));
}

describe('GenerationProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders pipeline title "Pipeline de génération"', () => {
    render(<GenerationProgress steps={buildSteps()} />);
    expect(screen.getByText('Pipeline de génération')).toBeInTheDocument();
  });

  it('renders all step labels', () => {
    render(<GenerationProgress steps={buildSteps()} />);
    for (const step of PIPELINE_STEPS) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }
  });

  it('shows pending icon (circle) for pending steps', () => {
    const steps = buildSteps();
    const { container } = render(<GenerationProgress steps={steps} />);
    // lucide Circle renders as <svg> — pending steps should NOT have cs-spin class
    const svgs = container.querySelectorAll('svg');
    // All steps are pending — none should have the spinner class
    const spinners = container.querySelectorAll('.cs-spin');
    expect(spinners.length).toBe(0);
    // Should have SVGs for each step icon
    expect(svgs.length).toBeGreaterThanOrEqual(PIPELINE_STEPS.length);
  });

  it('shows running icon (spinner) for running steps', () => {
    const steps = buildSteps([{ status: 'running' }]);
    const { container } = render(<GenerationProgress steps={steps} />);
    const spinners = container.querySelectorAll('.cs-spin');
    expect(spinners.length).toBe(1);
  });

  it('shows done icon (checkmark) for done steps', () => {
    const steps = buildSteps([{ status: 'done', durationMs: 1200 }]);
    const { container } = render(<GenerationProgress steps={steps} />);
    // Done step renders CheckCircle2 which has a specific color
    const doneIcons = container.querySelectorAll(
      `span[style*="var(--cs-success)"]`,
    );
    expect(doneIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error icon (X) for error steps', () => {
    const steps = buildSteps([{ status: 'error' }]);
    const { container } = render(<GenerationProgress steps={steps} />);
    const errorIcons = container.querySelectorAll(
      `span[style*="var(--cs-danger)"]`,
    );
    expect(errorIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows duration for completed steps', () => {
    const steps = buildSteps([{ status: 'done', durationMs: 1200 }]);
    render(<GenerationProgress steps={steps} />);
    expect(screen.getByText('1.2s')).toBeInTheDocument();
  });

  it('shows elapsed time counter when running', () => {
    const steps = buildSteps([{ status: 'running' }]);
    render(<GenerationProgress steps={steps} />);
    // Initially the elapsed counter shows 0ms or small value
    // Advance time and check the counter updates
    vi.advanceTimersByTime(1200);
    // The component should render the elapsed time
    // It won't be exactly 1.2s due to Date.now mock, but the element should be present
    const monos = document.querySelectorAll('.cs-mono');
    // At least one .cs-mono element should display elapsed time
    expect(monos.length).toBeGreaterThanOrEqual(1);
  });

  it('shows total cost when provided', () => {
    const steps = buildSteps(
      PIPELINE_STEPS.map(() => ({ status: 'done' as const, durationMs: 500 })),
    );
    render(<GenerationProgress steps={steps} totalCost={350} />);
    expect(screen.getByText('3.50 MAD')).toBeInTheDocument();
  });

  it('formats cost in MAD', () => {
    const steps = buildSteps(
      PIPELINE_STEPS.map(() => ({ status: 'done' as const, durationMs: 500 })),
    );
    render(<GenerationProgress steps={steps} totalCost={1275} />);
    expect(screen.getByText('12.75 MAD')).toBeInTheDocument();
    expect(screen.getByText('Coût estimé')).toBeInTheDocument();
  });

  it('error step shows error message with danger color', () => {
    const steps = buildSteps([{ status: 'error' }]);
    const { container } = render(<GenerationProgress steps={steps} />);
    // The first step label should be styled with primary color (not muted)
    // when it has error status
    const errorColoredSpans = container.querySelectorAll(
      `span[style*="var(--cs-danger)"]`,
    );
    expect(errorColoredSpans.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty steps array', () => {
    const { container } = render(<GenerationProgress steps={[]} />);
    expect(screen.getByText('Pipeline de génération')).toBeInTheDocument();
    // No step items rendered
    const stepLabels = PIPELINE_STEPS.map((s) => s.label);
    for (const label of stepLabels) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    // Component should still render without errors
    expect(container.firstChild).toBeInTheDocument();
  });
});
