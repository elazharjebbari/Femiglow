/**
 * LMK — Mapping statuts campagne Listmonk → FemiGlow (table de vérité COMPLÈTE)
 * + légalité des transitions (anti-régression d'état terminal). Fonctions pures
 * du moteur de sync de statut (cron email-campaign-sync).
 *
 * Oracles : chaque statut Listmonk a une image FemiGlow déterministe ; un statut
 * inconnu est un no-op défensif (null) ; un état terminal (sent/cancelled/failed)
 * ne régresse JAMAIS (un poll rejoué obsolète ne doit pas « dé-finir » une
 * campagne envoyée).
 */
import { describe, expect, it } from 'vitest';
import {
  mapListmonkStatus,
  isLegalTransition,
  type FemiGlowCampaignStatus,
} from '@/lib/mail/campaigns/listmonk-status-sync';

describe('mapListmonkStatus — table de vérité Listmonk → FemiGlow', () => {
  // Table de vérité EXHAUSTIVE des statuts Listmonk documentés.
  const cases: Array<[string, FemiGlowCampaignStatus | null]> = [
    ['finished', 'sent'],
    ['cancelled', 'cancelled'],
    ['running', 'sending'],
    ['scheduled', 'scheduled'],
    ['paused', null], // pas d'équivalent métier → ne touche pas le statut
    ['draft', null],
  ];

  it.each(cases)('LMK-MAP : "%s" Listmonk -> %s FemiGlow', (lm, expected) => {
    expect(mapListmonkStatus(lm)).toBe(expected);
  });

  it('LMK-MAP : statut Listmonk inconnu -> null (no-op défensif)', () => {
    expect(mapListmonkStatus('zombie')).toBeNull();
    expect(mapListmonkStatus('')).toBeNull();
    expect(mapListmonkStatus('FINISHED')).toBeNull(); // casse stricte, pas de coercition
  });
});

describe('isLegalTransition — machine d’états campagne', () => {
  it('autorise la progression normale draft -> scheduled -> sending -> sent', () => {
    expect(isLegalTransition('draft', 'scheduled')).toBe(true);
    expect(isLegalTransition('scheduled', 'sending')).toBe(true);
    expect(isLegalTransition('sending', 'sent')).toBe(true);
    expect(isLegalTransition('draft', 'sending')).toBe(true); // saut légal
  });

  it('autorise l’annulation depuis tout état non terminal', () => {
    expect(isLegalTransition('draft', 'cancelled')).toBe(true);
    expect(isLegalTransition('scheduled', 'cancelled')).toBe(true);
    expect(isLegalTransition('sending', 'cancelled')).toBe(true);
  });

  it('REFUSE toute régression d’un état terminal (sent/cancelled/failed)', () => {
    const terminals: FemiGlowCampaignStatus[] = ['sent', 'cancelled', 'failed'];
    const others: FemiGlowCampaignStatus[] = [
      'draft',
      'scheduled',
      'sending',
      'paused',
    ];
    for (const from of terminals) {
      for (const to of others) {
        expect(
          isLegalTransition(from, to),
          `${from} -> ${to} doit être illégal (terminal figé)`,
        ).toBe(false);
      }
    }
  });

  it('REFUSE spécifiquement sent -> sending (poll rejoué obsolète)', () => {
    // Cas L-CMP critique : Listmonk renvoie encore `running` pour une campagne
    // déjà finie côté FemiGlow → ne doit PAS revenir à `sending`.
    expect(isLegalTransition('sent', 'sending')).toBe(false);
    expect(isLegalTransition('cancelled', 'sending')).toBe(false);
    expect(isLegalTransition('sent', 'scheduled')).toBe(false);
  });

  it('idempotence : une transition vers le même état est toujours légale', () => {
    const all: FemiGlowCampaignStatus[] = [
      'draft',
      'scheduled',
      'sending',
      'sent',
      'paused',
      'cancelled',
      'failed',
    ];
    for (const s of all) expect(isLegalTransition(s, s)).toBe(true);
  });
});
