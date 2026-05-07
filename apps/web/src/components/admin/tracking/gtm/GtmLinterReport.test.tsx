import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GtmLinterReport } from './GtmLinterReport';
import type { LintReport } from '@/lib/tracking/gtm/linter';

function makeReport(over: Partial<LintReport> = {}): LintReport {
  return {
    errors: over.errors ?? [],
    warnings: over.warnings ?? [],
    infos: over.infos ?? [],
    ok: (over.errors ?? []).length === 0,
  };
}

describe('GtmLinterReport — empty state', () => {
  it('affiche un message OK si tout est vide', () => {
    render(<GtmLinterReport report={makeReport()} />);
    expect(screen.getByText(/aucun problème détecté/i)).toBeInTheDocument();
  });
});

describe('GtmLinterReport — avec issues', () => {
  it('affiche le summary avec les counts', () => {
    render(
      <GtmLinterReport
        report={makeReport({
          errors: [
            {
              code: 'tag_no_trigger',
              severity: 'error',
              message: 'Tag X sans trigger',
              refType: 'tag',
              refName: 'TagX',
            },
          ],
          warnings: [
            {
              code: 'orphan_trigger',
              severity: 'warning',
              message: 'Trigger Y orphelin',
              refType: 'trigger',
              refName: 'TriggerY',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/1 erreur\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 avertissement\(s\)/)).toBeInTheDocument();
  });

  it("liste chaque issue avec son code et message", () => {
    render(
      <GtmLinterReport
        report={makeReport({
          errors: [
            {
              code: 'tag_no_trigger',
              severity: 'error',
              message: 'Tag X sans trigger.',
              refType: 'tag',
              refName: 'X',
              hint: 'Ajoute un trigger.',
            },
          ],
        })}
        defaultOpen
      />,
    );
    expect(screen.getByText('tag_no_trigger')).toBeInTheDocument();
    expect(screen.getByText(/Tag X sans trigger/)).toBeInTheDocument();
    expect(screen.getByText('Ajoute un trigger.')).toBeInTheDocument();
  });

  it("ouvre par défaut si errors > 0", () => {
    const { container } = render(
      <GtmLinterReport
        report={makeReport({
          errors: [
            {
              code: 'duplicate_name',
              severity: 'error',
              message: 'collision',
              refType: 'tag',
              refName: 'X',
            },
          ],
        })}
      />,
    );
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(true);
  });

  it("reste plié par défaut si seulement warnings/infos", () => {
    const { container } = render(
      <GtmLinterReport
        report={makeReport({
          warnings: [
            {
              code: 'orphan_trigger',
              severity: 'warning',
              message: 'orphan',
              refType: 'trigger',
              refName: 'X',
            },
          ],
        })}
      />,
    );
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(false);
  });
});
