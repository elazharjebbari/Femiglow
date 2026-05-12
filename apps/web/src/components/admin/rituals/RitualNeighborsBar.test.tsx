import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RitualNeighborsBar } from './RitualNeighborsBar';

afterEach(() => cleanup());

describe('RitualNeighborsBar', () => {
  it('affiche les deux liens quand previous et next existent', () => {
    render(
      <RitualNeighborsBar
        previousId="r_prev"
        nextId="r_next"
        position={2}
        total={3}
        status="PENDING"
        statusParam="PENDING"
      />,
    );
    expect(screen.getByTestId('ritual-neighbors-prev').getAttribute('href')).toContain(
      '/admin/rituals/r_prev',
    );
    expect(screen.getByTestId('ritual-neighbors-next').getAttribute('href')).toContain(
      '/admin/rituals/r_next',
    );
    expect(screen.getByText(/2 sur 3/)).toBeTruthy();
  });

  it('désactive previous quand premier élément', () => {
    render(
      <RitualNeighborsBar
        previousId={null}
        nextId="r_next"
        position={1}
        total={3}
        status="PENDING"
        statusParam="PENDING"
      />,
    );
    expect(screen.getByTestId('ritual-neighbors-prev-disabled')).toBeTruthy();
    expect(screen.queryByTestId('ritual-neighbors-prev')).toBeNull();
  });

  it('désactive next quand dernier élément', () => {
    render(
      <RitualNeighborsBar
        previousId="r_prev"
        nextId={null}
        position={3}
        total={3}
        status="PENDING"
        statusParam="PENDING"
      />,
    );
    expect(screen.getByTestId('ritual-neighbors-next-disabled')).toBeTruthy();
  });

  it('préserve statusParam dans les href', () => {
    render(
      <RitualNeighborsBar
        previousId="r_prev"
        nextId="r_next"
        position={2}
        total={3}
        status="REJECTED"
        statusParam="REJECTED,HIDDEN"
      />,
    );
    const prev = screen.getByTestId('ritual-neighbors-prev').getAttribute('href');
    expect(prev).toContain('status=REJECTED%2CHIDDEN');
  });

  it('lien back varie selon le statusParam', () => {
    const { rerender } = render(
      <RitualNeighborsBar
        previousId={null}
        nextId={null}
        position={1}
        total={1}
        status="APPROVED"
        statusParam="APPROVED"
      />,
    );
    // Le centre est un Link vers la liste correspondante
    expect(document.body.textContent).toContain('publiés');

    rerender(
      <RitualNeighborsBar
        previousId={null}
        nextId={null}
        position={1}
        total={1}
        status="HIDDEN"
        statusParam="REJECTED,HIDDEN"
      />,
    );
    expect(document.body.textContent).toContain('masqués');
  });

  it('total à 0 → "Aucun"', () => {
    render(
      <RitualNeighborsBar
        previousId={null}
        nextId={null}
        position={0}
        total={0}
        status="PENDING"
        statusParam="PENDING"
      />,
    );
    expect(document.body.textContent).toContain('Aucun');
  });
});
