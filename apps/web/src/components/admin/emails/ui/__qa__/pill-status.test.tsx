// @vitest-environment jsdom
/**
 * F01 — Pill + STATUS_META unifié (SOC-F06 / TRV-07, DASH-07) :
 * batterie F01-U-054..059 + F01-C-057 + F01-A-060.
 *
 * F01-U-055 AMENDÉ : l'oracle d'origine (« Bounce perm. ») a été supersédé
 * par le correctif DASH-07 (P0.3) — libellé complet « Bounce permanent ».
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';

import { emailOutboxStatus } from '@/lib/db/schema-emails';
import {
  STATUS_META,
  StatusBadge as CommonStatusBadge,
  statusLabel,
} from '@/components/admin/emails/common/StatusBadge';
import { StatusBadge as KpiCardsStatusBadge } from '@/components/admin/emails/KpiCards';
import { Pill, TONE_CLS } from '@/components/admin/emails/ui/Pill';

describe('STATUS_META — source de vérité unique', () => {
  it('F01-U-054 — exhaustif vs enum email_outbox_status (TRV-07)', () => {
    // Tout statut DB doit avoir son entrée — un nouveau statut sans libellé
    // FR/tone casse ICI avant d'atteindre un écran.
    for (const status of emailOutboxStatus.enumValues) {
      expect(STATUS_META[status as keyof typeof STATUS_META], `statut ${status}`).toBeDefined();
    }
    expect(Object.keys(STATUS_META)).toHaveLength(emailOutboxStatus.enumValues.length);
  });

  it('F01-U-055 — libellé FR complet (amendé DASH-07) : « Bounce permanent »', () => {
    expect(STATUS_META.bounced_permanent.label).toBe('Bounce permanent');
  });

  it('F01-U-056 — statut inconnu → « Inconnu » (jamais le slug brut)', () => {
    expect(statusLabel('zzz')).toBe('Inconnu');
    expect(statusLabel('')).toBe('Inconnu');
  });

  it('F01-U-058 — tones sémantiques : dlq=danger, sent=success', () => {
    expect(STATUS_META.dlq.tone).toBe('danger');
    expect(STATUS_META.sent.tone).toBe('success');
    expect(STATUS_META.pending.tone).toBe('warning');
    expect(STATUS_META.opened.tone).toBe('info');
    expect(STATUS_META.suppressed.tone).toBe('neutral');
  });

  it('F01-U-059 — KpiCards ne porte PLUS de map locale (re-export du canonique)', () => {
    // Égalité de RÉFÉRENCE : toute réintroduction d'un composant local casse ici.
    expect(KpiCardsStatusBadge).toBe(CommonStatusBadge);
  });
});

describe('Rendu — cohérence inter-écrans', () => {
  it('F01-C-057 — même statut, mêmes libellé/tone dans deux contextes', () => {
    render(
      <div>
        <div data-testid="ctx-dashboard">
          <KpiCardsStatusBadge status="bounced_permanent" />
        </div>
        <div data-testid="ctx-cockpit">
          <CommonStatusBadge status="bounced_permanent" />
        </div>
      </div>,
    );
    const [a, b] = screen.getAllByRole('status');
    expect(a!.textContent).toBe(b!.textContent);
    expect(a!.className).toBe(b!.className);
    expect(a!).toHaveAttribute('data-status', 'bounced_permanent');
  });

  it('F01-A-060 — axe : 0 violation sur Pill (5 tons)', async () => {
    const { container } = render(
      <div>
        {(Object.keys(TONE_CLS) as Array<keyof typeof TONE_CLS>).map((tone) => (
          <Pill key={tone} tone={tone}>
            exemple {tone}
          </Pill>
        ))}
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
