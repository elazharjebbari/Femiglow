/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('lucide-react', () => {
  const R = require('react');
  return {
    Check: (props: Record<string, any>) =>
      R.createElement('span', { 'data-testid': 'icon-Check', ...props }, '✓'),
  };
});

import { Stepper, mapPhaseToSteps } from '../Stepper';
import type { Phase, StepDef } from '../Stepper';

describe('mapPhaseToSteps', () => {
  it('brief phase → step 0 active, rest pending', () => {
    const steps = mapPhaseToSteps('brief');
    expect(steps[0].status).toBe('active');
    expect(steps[1].status).toBe('pending');
    expect(steps[2].status).toBe('pending');
    expect(steps[3].status).toBe('pending');
  });

  it('generating phase → step 0 completed, step 1 active, rest pending', () => {
    const steps = mapPhaseToSteps('generating');
    expect(steps[0].status).toBe('completed');
    expect(steps[1].status).toBe('active');
    expect(steps[2].status).toBe('pending');
    expect(steps[3].status).toBe('pending');
  });

  it('review phase → steps 0-1 completed, step 2 active, step 3 pending', () => {
    const steps = mapPhaseToSteps('review');
    expect(steps[0].status).toBe('completed');
    expect(steps[1].status).toBe('completed');
    expect(steps[2].status).toBe('active');
    expect(steps[3].status).toBe('pending');
  });

  it('reviewing phase → same as review', () => {
    const reviewing = mapPhaseToSteps('reviewing');
    const review = mapPhaseToSteps('review');
    expect(reviewing).toEqual(review);
  });

  it('result phase → steps 0-2 completed, step 3 active', () => {
    const steps = mapPhaseToSteps('result');
    expect(steps[0].status).toBe('completed');
    expect(steps[1].status).toBe('completed');
    expect(steps[2].status).toBe('completed');
    expect(steps[3].status).toBe('active');
  });

  it('error phase → step 0 completed, step 1 active (fallback)', () => {
    const steps = mapPhaseToSteps('error');
    expect(steps[0].status).toBe('completed');
    expect(steps[1].status).toBe('active');
    expect(steps[2].status).toBe('pending');
    expect(steps[3].status).toBe('pending');
  });

  it('returns exactly 4 steps', () => {
    const phases: Phase[] = ['brief', 'generating', 'review', 'reviewing', 'result', 'error'];
    for (const phase of phases) {
      expect(mapPhaseToSteps(phase)).toHaveLength(4);
    }
  });

  it('step labels are Brief, Génération, Review, Publication', () => {
    const steps = mapPhaseToSteps('brief');
    expect(steps.map((s) => s.label)).toEqual(['Brief', 'Génération', 'Review', 'Publication']);
  });
});

describe('Stepper component', () => {
  function makeSteps(activeIndex: number): StepDef[] {
    const labels = ['Brief', 'Génération', 'Review', 'Publication'];
    return labels.map((label, i) => ({
      label,
      status: (i < activeIndex ? 'completed' : i === activeIndex ? 'active' : 'pending') as StepDef['status'],
    }));
  }

  it('renders all 4 step labels', () => {
    render(<Stepper steps={makeSteps(0)} />);
    expect(screen.getByText('Brief')).toBeInTheDocument();
    expect(screen.getByText('Génération')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Publication')).toBeInTheDocument();
  });

  it('renders step numbers for pending and active steps', () => {
    render(<Stepper steps={makeSteps(1)} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders checkmark for completed steps', () => {
    render(<Stepper steps={makeSteps(2)} />);
    const checks = screen.getAllByTestId('icon-Check');
    expect(checks).toHaveLength(2);
  });

  it('active step has accent background color', () => {
    const { container } = render(<Stepper steps={makeSteps(1)} />);
    const circles = container.querySelectorAll('div[style*="border-radius: 50%"]');
    const activeCircle = circles[1] as HTMLElement;
    expect(activeCircle.style.background).toBe('var(--cs-accent)');
  });

  it('completed step has success background color', () => {
    const { container } = render(<Stepper steps={makeSteps(2)} />);
    const circles = container.querySelectorAll('div[style*="border-radius: 50%"]');
    const completedCircle = circles[0] as HTMLElement;
    expect(completedCircle.style.background).toBe('var(--cs-success)');
  });

  it('pending step has border style', () => {
    const { container } = render(<Stepper steps={makeSteps(0)} />);
    const circles = container.querySelectorAll('div[style*="border-radius: 50%"]');
    const pendingCircle = circles[1] as HTMLElement;
    expect(pendingCircle.style.border).toBe('2px solid var(--cs-border)');
    expect(pendingCircle.style.background).toBe('transparent');
  });

  it('shows "Mode Mock" badge when mockMode is true', () => {
    render(<Stepper steps={makeSteps(0)} mockMode={true} />);
    expect(screen.getByText('Mode Mock')).toBeInTheDocument();
  });

  it('does NOT show "Mode Mock" badge when mockMode is false', () => {
    render(<Stepper steps={makeSteps(0)} mockMode={false} />);
    expect(screen.queryByText('Mode Mock')).not.toBeInTheDocument();
  });

  it('connecting lines between steps exist (3 lines for 4 steps)', () => {
    const { container } = render(<Stepper steps={makeSteps(0)} />);
    const lines = container.querySelectorAll('div[style*="height: 2px"]');
    expect(lines).toHaveLength(3);
  });

  it('completed step connecting line has success color', () => {
    const { container } = render(<Stepper steps={makeSteps(2)} />);
    const lines = container.querySelectorAll('div[style*="height: 2px"]');
    const firstLine = lines[0] as HTMLElement;
    expect(firstLine.style.background).toBe('var(--cs-success)');
  });

  it('contains pulse animation keyframes in style tag', () => {
    const { container } = render(<Stepper steps={makeSteps(0)} />);
    const styleTag = container.querySelector('style');
    expect(styleTag).not.toBeNull();
    expect(styleTag!.textContent).toContain('@keyframes stepper-pulse');
  });
});
