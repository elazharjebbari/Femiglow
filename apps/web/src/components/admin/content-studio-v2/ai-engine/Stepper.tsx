'use client';

import { Check } from 'lucide-react';

export type Phase = 'brief' | 'generating' | 'review' | 'reviewing' | 'result' | 'error';

export type StepperStatus = 'pending' | 'active' | 'completed';

export type StepDef = { label: string; status: StepperStatus };

export type StepperProps = { steps: StepDef[]; mockMode?: boolean };

const STEP_LABELS = ['Brief', 'Génération', 'Review', 'Publication'];

export function mapPhaseToSteps(phase: Phase): StepDef[] {
  const makeSteps = (activeIndex: number): StepDef[] =>
    STEP_LABELS.map((label, i) => ({
      label,
      status: i < activeIndex ? 'completed' : i === activeIndex ? 'active' : 'pending',
    }));

  switch (phase) {
    case 'brief':
      return makeSteps(0);
    case 'generating':
      return makeSteps(1);
    case 'review':
    case 'reviewing':
      return makeSteps(2);
    case 'result':
      return makeSteps(3);
    case 'error':
      return makeSteps(1);
  }
}

export function Stepper({ steps, mockMode }: StepperProps) {
  return (
    <div data-stepper style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;

        return (
          <div
            key={step.label}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              flex: isLast ? '0 0 auto' : '1 1 0',
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--cs-text-sm)',
                  fontWeight: step.status === 'active' ? 700 : 500,
                  transition: 'all 0.3s ease',
                  ...(step.status === 'pending'
                    ? {
                        border: '2px solid var(--cs-border)',
                        background: 'transparent',
                        color: 'var(--cs-fg-muted)',
                      }
                    : step.status === 'active'
                      ? {
                          border: 'none',
                          background: 'var(--cs-accent)',
                          color: '#fff',
                          animation: 'stepper-pulse 2s ease-in-out infinite',
                        }
                      : {
                          border: 'none',
                          background: 'var(--cs-success)',
                          color: '#fff',
                        }),
                }}
              >
                {step.status === 'completed' ? <Check size={16} strokeWidth={2.5} /> : idx + 1}
              </div>

              <span
                style={{
                  marginTop: 6,
                  fontSize: 'var(--cs-text-xs)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.3s ease',
                  ...(step.status === 'active'
                    ? { color: 'var(--cs-fg-primary)', fontWeight: 700 }
                    : step.status === 'completed'
                      ? { color: 'var(--cs-fg-secondary)', fontWeight: 400 }
                      : { color: 'var(--cs-fg-muted)', fontWeight: 400 }),
                }}
              >
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 15,
                  marginLeft: 8,
                  marginRight: 8,
                  borderRadius: 1,
                  transition: 'background 0.3s ease',
                  background:
                    step.status === 'completed' ? 'var(--cs-success)' : 'var(--cs-border)',
                }}
              />
            )}
          </div>
        );
      })}

      {mockMode && (
        <div
          style={{
            marginLeft: 16,
            marginTop: 4,
            padding: '2px 8px',
            borderRadius: 'var(--cs-radius-sm)',
            background: 'color-mix(in srgb, var(--cs-warning) 18%, transparent)',
            color: 'var(--cs-warning)',
            fontSize: 'var(--cs-text-xs)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            alignSelf: 'flex-start',
          }}
        >
          Mode Mock
        </div>
      )}

      <style>{`
        @keyframes stepper-pulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cs-accent) 40%, transparent); }
          50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--cs-accent) 0%, transparent); }
        }
        @media (max-width: 480px) {
          [data-stepper] span { font-size: 10px !important; }
        }
      `}</style>
    </div>
  );
}
