/**
 * Vague 4 — FONDATION — StatusBadge canonique (UX-TRANSVERSE-005).
 *
 * Oracle UX4-FONDATION-004 : rend le libellé FR pour les 11 statuts outbox
 * (dlq → 'DLQ', bounced_permanent → 'Bounce permanent') et JAMAIS le slug brut
 * anglais. Un statut inconnu rend 'Inconnu' (pas la chaîne technique).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, STATUS_META, statusLabel, type OutboxStatus } from '../StatusBadge';

const ALL_STATUSES: Array<[OutboxStatus, string]> = [
  ['pending', 'En attente'],
  ['sending', 'Envoi…'],
  ['sent', 'Envoyé'],
  ['delivered', 'Livré'],
  ['opened', 'Ouvert'],
  ['clicked', 'Cliqué'],
  ['failed', 'Échec'],
  ['bounced_soft', 'Bounce soft'],
  ['bounced_permanent', 'Bounce permanent'],
  ['suppressed', 'Supprimé'],
  ['dlq', 'DLQ'],
];

describe('StatusBadge — UX4-FONDATION-004 (11 statuts FR)', () => {
  it('UX4-FONDATION-004 : couvre les 11 statuts de l’enum (mapping complet)', () => {
    expect(Object.keys(STATUS_META)).toHaveLength(11);
    expect(ALL_STATUSES).toHaveLength(11);
  });

  it.each(ALL_STATUSES)(
    'UX4-FONDATION-004 : %s rend le libellé FR "%s" et jamais le slug brut',
    (status, label) => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent(label);
      // Le slug brut anglais ne doit PAS apparaître (sauf 'dlq' dont le libellé
      // FR est volontairement 'DLQ' — on vérifie alors l'absence du slug à
      // double underscore ou des variantes anglaises).
      if (status.includes('_')) {
        expect(badge.textContent).not.toContain(status);
      }
      unmount();
    },
  );

  it('UX4-FONDATION-004b : bounced_permanent → "Bounce permanent" (pas le slug)', () => {
    render(<StatusBadge status="bounced_permanent" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Bounce permanent');
    expect(badge.textContent).not.toContain('bounced_permanent');
  });

  it('UX4-FONDATION-004c : dlq → "DLQ"', () => {
    render(<StatusBadge status="dlq" />);
    expect(screen.getByRole('status')).toHaveTextContent('DLQ');
  });

  it('UX4-FONDATION-004d : statut inconnu → "Inconnu" (jamais la chaîne technique)', () => {
    render(<StatusBadge status="weird_unknown_slug" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Inconnu');
    expect(badge.textContent).not.toContain('weird_unknown_slug');
    // data-status conserve la valeur brute pour le ciblage CSS/test, mais le
    // TEXTE visible reste FR.
    expect(badge).toHaveAttribute('data-status', 'weird_unknown_slug');
  });

  it('UX4-FONDATION-004e : statusLabel() expose le libellé FR sans rendu', () => {
    expect(statusLabel('dlq')).toBe('DLQ');
    expect(statusLabel('bounced_permanent')).toBe('Bounce permanent');
    expect(statusLabel('nope')).toBe('Inconnu');
  });
});
