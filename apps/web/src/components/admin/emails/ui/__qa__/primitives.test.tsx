// @vitest-environment jsdom
/**
 * F01 — primitives socle v2 (charte 09 §A.2, P3.0-b) : Button, IconButton,
 * Field, Card, Skeleton, Banner. Couleurs dérivées d'ui/tokens.ts ; a11y et
 * contrats vérifiés ; axe smoke (gate G10/G6).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import {
  Button,
  IconButton,
  Field,
  Card,
  Skeleton,
  SkeletonTable,
  Banner,
  BUTTON,
  TONE,
} from '../index';

describe('F01 — Button (primitive socle v2)', () => {
  it('F01-C-090 — variant → classes issues de tokens (data-variant exposé)', () => {
    render(<Button variant="danger">Supprimer</Button>);
    const btn = screen.getByRole('button', { name: 'Supprimer' });
    expect(btn).toHaveAttribute('data-variant', 'danger');
    // La classe vient de la source unique tokens.BUTTON.danger.
    for (const cls of BUTTON.danger.split(' ')) expect(btn.className).toContain(cls);
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('F01-C-091 — busy : aria-busy + busyLabel + désactivé (1 seule action)', () => {
    const onClick = vi.fn();
    render(
      <Button busy busyLabel="Envoi…" onClick={onClick}>
        Envoyer
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Envoi…');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled(); // disabled → pas d'action
  });

  it('F01-C-092 — état nominal : clic transmis une fois', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>OK</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('F01 — IconButton (primitive socle v2)', () => {
  it('F01-C-093 — aria-label rend un nom accessible', () => {
    render(
      <IconButton aria-label="Fermer">
        <span aria-hidden="true">✕</span>
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });
});

describe('F01 — Field (primitive socle v2)', () => {
  it('F01-C-094 — label lié au contrôle + aide via aria-describedby', () => {
    render(
      <Field label="Email" hint="On ne spamme pas.">
        {(aria) => <input type="email" {...aria} />}
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!.split(' ')[0]!)).toHaveTextContent(
      'On ne spamme pas.',
    );
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('F01-C-095 — erreur : role=alert + aria-invalid, l’aide s’efface', () => {
    render(
      <Field label="Email" hint="aide" error="Adresse invalide">
        {(aria) => <input type="email" {...aria} />}
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Adresse invalide');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
    expect(screen.queryByText('aide')).not.toBeInTheDocument();
  });
});

describe('F01 — Card (primitive socle v2)', () => {
  it('F01-C-096 — titre + action en tête', () => {
    render(
      <Card title="Critères" action={<a href="/x">Modifier</a>}>
        <p>contenu</p>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Critères' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Modifier' })).toBeInTheDocument();
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });
});

describe('F01 — Skeleton (primitive socle v2)', () => {
  it('F01-C-097 — role=status + libellé sr-only + visuel aria-hidden (pas un spinner)', () => {
    render(<SkeletonTable rows={3} cols={4} label="Chargement de la file…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Chargement de la file…');
    // Le visuel fantôme est masqué aux lecteurs d'écran.
    expect(status.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('F01-C-098 — Skeleton générique enveloppe son contenu en aria-hidden', () => {
    render(
      <Skeleton label="…">
        <div data-testid="ghost" />
      </Skeleton>,
    );
    expect(screen.getByTestId('ghost').closest('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

describe('F01 — Banner (primitive socle v2)', () => {
  it('F01-C-099 — danger → role=alert ; info → role=status ; data-tone exposé', () => {
    const { rerender } = render(<Banner tone="danger">échec</Banner>);
    let banner = screen.getByRole('alert');
    expect(banner).toHaveAttribute('data-tone', 'danger');
    for (const cls of TONE.danger.subtle.split(' ')) expect(banner.className).toContain(cls);

    rerender(<Banner tone="info">info</Banner>);
    banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('data-tone', 'info');
  });

  it('F01-C-100 — slot action rendu (reprise)', () => {
    render(
      <Banner tone="warning" action={<button type="button">Réessayer</button>}>
        figé
      </Banner>,
    );
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

describe('F01 — axe primitives (G10/G6)', () => {
  it('F01-A-101 — 0 violation serious/critical sur l’ensemble des primitives', async () => {
    const { container } = render(
      <main>
        <Button variant="primary">Action</Button>
        <IconButton aria-label="Fermer">
          <span aria-hidden="true">✕</span>
        </IconButton>
        <Field label="Nom" hint="aide">
          {(aria) => <input {...aria} />}
        </Field>
        <Card title="Bloc">
          <p>x</p>
        </Card>
        <SkeletonTable />
        <Banner tone="danger">souci</Banner>
        <Banner tone="success">ok</Banner>
      </main>,
    );
    await expectNoAxeViolations(container);
  });
});
