import { describe, expect, it } from 'vitest';

import { aggregateStoryFunnel } from './stories';

const ev = (eventName: string, payload: Record<string, unknown>) => ({ eventName, payload });

describe('aggregateStoryFunnel', () => {
  it('agrège le funnel par story_id', () => {
    const res = aggregateStoryFunnel([
      ev('story_open', { story_id: 'sty_a' }),
      ev('story_open', { story_id: 'sty_a' }),
      ev('story_open', { story_id: 'sty_a' }),
      ev('story_view', { story_id: 'sty_a', segment_id: 's1' }),
      ev('story_complete', { story_id: 'sty_a' }),
      ev('cta_click', { story_id: 'sty_a', _src_event: 'story_cta_click' }), // CTA story
      ev('cta_click', { _src_event: 'pack_cta_click' }), // pack — ignoré (pas de story_id)
      ev('story_open', { story_id: 'sty_b' }),
    ]);

    const a = res.rows.find((r) => r.storyId === 'sty_a')!;
    expect(a.opens).toBe(3);
    expect(a.views).toBe(1);
    expect(a.completes).toBe(1);
    expect(a.ctaClicks).toBe(1);
    expect(a.completionRate).toBeCloseTo(1 / 3);
    expect(a.ctr).toBeCloseTo(1 / 3);

    const b = res.rows.find((r) => r.storyId === 'sty_b')!;
    expect(b.opens).toBe(1);
    expect(b.completionRate).toBe(0); // 1 ouverture, 0 complétion → 0 %

    // le cta_click sans story_id (pack) n'est pas compté
    expect(res.totals.opens).toBe(4);
    expect(res.totals.ctaClicks).toBe(1);
    // rows triées par opens desc
    expect(res.rows[0]!.storyId).toBe('sty_a');
  });

  it('renvoie un funnel vide sans events', () => {
    const res = aggregateStoryFunnel([]);
    expect(res.rows).toHaveLength(0);
    expect(res.totals.opens).toBe(0);
    expect(res.totals.completionRate).toBeNull();
  });
});
