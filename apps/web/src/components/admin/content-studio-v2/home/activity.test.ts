import { describe, it, expect } from 'vitest';
import {
  computeRecentActivity,
  formatActivityRow,
  formatRelativeTime,
  type ActivityRow,
} from './activity';
import type { AuditEvent } from '@/lib/db/types';

function event(partial: Partial<AuditEvent>): AuditEvent {
  return {
    id: partial.id ?? 'ae_1',
    action: partial.action ?? 'unknown.action',
    actorId: partial.actorId ?? null,
    resourceType: partial.resourceType ?? null,
    resourceId: partial.resourceId ?? null,
    meta: partial.meta ?? {},
    createdAt: partial.createdAt ?? new Date('2026-05-22T10:00:00Z'),
  };
}

describe('computeRecentActivity', () => {
  it('maps a known action to its human label + icon', () => {
    const now = new Date('2026-05-22T10:30:00Z');
    const rows = computeRecentActivity(
      [
        event({
          id: 'ae_1',
          action: 'content_studio.draft.approved',
          resourceType: 'content_draft',
          resourceId: 'draft_abc',
          createdAt: new Date('2026-05-22T10:20:00Z'),
        }),
      ],
      now,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.icon).toBe('check');
    expect(rows[0]?.label).toBe('Brouillon approuvé');
    expect(rows[0]?.detail).toBe('content_draft · draft_abc');
    expect(rows[0]?.relativeTime).toBe('il y a 10min');
  });

  it('falls back to a humanized label for unknown action names', () => {
    const row = formatActivityRow(
      event({ action: 'foo.bar.baz', createdAt: new Date('2026-05-22T10:00:00Z') }),
      new Date('2026-05-22T10:00:30Z'),
    );
    expect(row.icon).toBe('dot');
    expect(row.label).toBe('Foo · bar · baz');
    expect(row.relativeTime).toBe("à l'instant");
  });

  it('sorts events descending by createdAt regardless of input order', () => {
    const now = new Date('2026-05-22T12:00:00Z');
    const rows = computeRecentActivity(
      [
        event({ id: 'old', createdAt: new Date('2026-05-22T08:00:00Z') }),
        event({ id: 'newest', createdAt: new Date('2026-05-22T11:55:00Z') }),
        event({ id: 'middle', createdAt: new Date('2026-05-22T10:00:00Z') }),
      ],
      now,
    );
    expect(rows.map((r: ActivityRow) => r.id)).toEqual(['newest', 'middle', 'old']);
  });

  it('returns a stable iso timestamp + tooltip-friendly metadata', () => {
    const createdAt = new Date('2026-05-22T08:15:00Z');
    const row = formatActivityRow(
      event({ id: 'ae_x', action: 'content_studio.post.published', createdAt }),
      new Date('2026-05-22T08:15:30Z'),
    );
    expect(row.isoTime).toBe(createdAt.toISOString());
    expect(row.icon).toBe('send');
  });

  it('omits the detail line when no resource is associated', () => {
    const row = formatActivityRow(
      event({ action: 'admin.login', resourceType: null, resourceId: null }),
      new Date('2026-05-22T10:00:00Z'),
    );
    expect(row.detail).toBeNull();
  });
});

describe('formatRelativeTime', () => {
  const base = new Date('2026-05-22T12:00:00Z');

  it('returns "à l\'instant" for events under a minute old', () => {
    expect(formatRelativeTime(new Date(base.getTime() - 15_000), base)).toBe("à l'instant");
  });

  it('returns minutes for events under an hour old', () => {
    expect(formatRelativeTime(new Date(base.getTime() - 30 * 60_000), base)).toBe('il y a 30min');
  });

  it('returns hours for events under a day old', () => {
    expect(formatRelativeTime(new Date(base.getTime() - 5 * 3600_000), base)).toBe('il y a 5h');
  });

  it('returns days for events under a week old', () => {
    expect(formatRelativeTime(new Date(base.getTime() - 3 * 24 * 3600_000), base)).toBe('il y a 3j');
  });

  it('returns a short date for events older than a week', () => {
    expect(formatRelativeTime(new Date('2026-04-10T00:00:00Z'), base)).toBe('10/04');
  });
});
