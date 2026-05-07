import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InterviewQR } from './InterviewQR';
import { mockRituel } from '@/data/mock/rituel';
import { expectNoAxeViolations } from '@/test/axe';

describe('InterviewQR', () => {
  it('rend un h2 d\u2019introduction et toutes les questions/réponses', () => {
    const { container } = render(<InterviewQR data={mockRituel.interview} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      mockRituel.interview.introduction,
    );
    mockRituel.interview.questions.forEach((qa) => {
      const qSnippet = qa.question.split(' ').slice(0, 2).join(' ');
      const rSnippet = qa.reponse.split(' ').slice(0, 3).join(' ');
      expect(container.textContent).toContain(qSnippet);
      expect(container.textContent).toContain(rSnippet);
    });
  });

  it('rend un <dl> par paire question/réponse', () => {
    const { container } = render(<InterviewQR data={mockRituel.interview} />);
    expect(container.querySelectorAll('dl')).toHaveLength(
      mockRituel.interview.questions.length,
    );
  });

  it('insère un exergue au milieu de la conversation', () => {
    const { container } = render(<InterviewQR data={mockRituel.interview} />);
    expect(container.querySelectorAll('blockquote').length).toBeGreaterThanOrEqual(1);
  });

  it('respecte axe', async () => {
    const { container } = render(<InterviewQR data={mockRituel.interview} />);
    await expectNoAxeViolations(container);
  });
});
