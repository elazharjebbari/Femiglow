/**
 * Garde-fou catalogue — providers Google Ads par event (audit 2026-06-03).
 *
 * Évite la régression « label configuré mais event non câblé » : les 8
 * conversions doivent porter `google_ads` dans defaultProviders, et
 * `lead_capture` ne doit PAS le porter (anti-double-comptage : la conversion
 * `lead` est portée uniquement par `generate_lead`).
 */
import { describe, expect, it } from 'vitest';

import { findEventInCatalog } from './event-catalog';

const MUST_HAVE_GOOGLE_ADS = [
  'contact_submit',
  'chat_message_sent',
  'sign_up',
  'newsletter_submit',
  'video_complete',
  'file_download',
  'fg_journal_read_100',
  'chat_widget_open',
  'generate_lead',
];

describe('event-catalog — providers Google Ads', () => {
  it.each(MUST_HAVE_GOOGLE_ADS)('%s porte google_ads', (name) => {
    const entry = findEventInCatalog(name);
    expect(entry, `${name} doit exister au catalogue`).not.toBeNull();
    expect(entry!.defaultProviders).toContain('google_ads');
  });

  it('lead_capture NE porte PAS google_ads (anti-double-comptage)', () => {
    const entry = findEventInCatalog('lead_capture');
    expect(entry).not.toBeNull();
    expect(entry!.defaultProviders).not.toContain('google_ads');
  });
});
