import { describe, expect, it } from 'vitest';
import {
  briefInputSchema,
  scriptOutputSchema,
  captionOutputSchema,
  qualityScoreSchema,
  moderationResultSchema,
  humanReviewSchema,
  contentGenerationInputSchema,
} from './schemas';

// ---------------------------------------------------------------------------
// briefInputSchema
// ---------------------------------------------------------------------------

describe('briefInputSchema', () => {
  it('accepts valid input', () => {
    const input = {
      objective: 'notoriete',
      tone: 'elegant',
      targetAudience: 'Femmes 28-45 ans',
      keyMessage: 'Eclat naturel des ongles',
      language: 'fr',
    };
    const result = briefInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects invalid objective', () => {
    const input = {
      objective: 'invalid_objective',
      tone: 'elegant',
      targetAudience: 'Femmes 28-45 ans',
      keyMessage: 'Eclat naturel',
    };
    const result = briefInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('applies defaults for language', () => {
    const input = {
      objective: 'conversion',
      tone: 'sensoriel',
      targetAudience: 'Femmes 28-45 ans',
      keyMessage: 'Rituel de soin japonais',
    };
    const result = briefInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe('fr');
    }
  });

  it('rejects empty tone', () => {
    const input = {
      objective: 'notoriete',
      tone: '',
      targetAudience: 'Femmes 28-45 ans',
      keyMessage: 'Eclat naturel',
    };
    const result = briefInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const input = {
      objective: 'fidelisation',
      tone: 'chaleureux',
      targetAudience: 'Clientes existantes',
      keyMessage: 'Merci de votre fidelite',
      productFocus: 'Kit complet',
      seasonalContext: 'printemps',
      trendReference: 'J-Beauty revival',
      maxBudgetCents: 500,
      constraints: { maxLength: 300 },
    };
    const result = briefInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scriptOutputSchema
// ---------------------------------------------------------------------------

describe('scriptOutputSchema', () => {
  const validScript = {
    hook: 'Decouvrez le secret des ongles japonais',
    scenes: [
      {
        sceneNumber: 1,
        durationSeconds: 5,
        narration: 'Le geste ancestral',
        visualNote: { description: 'Gros plan sur les mains' },
      },
    ],
    cta: 'Decouvrez le rituel FemiGlow',
    voiceoverRequired: true,
    musicRequired: true,
    musicMood: 'calm ambient',
    visualDirection: ['close-up', 'warm lighting'],
    estimatedDurationSeconds: 30,
  };

  it('accepts valid script', () => {
    const result = scriptOutputSchema.safeParse(validScript);
    expect(result.success).toBe(true);
  });

  it('requires hook', () => {
    const { hook: _, ...noHook } = validScript;
    const result = scriptOutputSchema.safeParse(noHook);
    expect(result.success).toBe(false);
  });

  it('requires scenes (non-empty)', () => {
    const emptyScenes = { ...validScript, scenes: [] };
    const result = scriptOutputSchema.safeParse(emptyScenes);
    expect(result.success).toBe(false);
  });

  it('requires cta', () => {
    const { cta: _, ...noCta } = validScript;
    const result = scriptOutputSchema.safeParse(noCta);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// captionOutputSchema
// ---------------------------------------------------------------------------

describe('captionOutputSchema', () => {
  it('accepts valid caption', () => {
    const result = captionOutputSchema.safeParse({
      caption: 'Le rituel de soin japonais qui revele l\'eclat naturel de vos ongles.',
      hashtags: ['#jbeauty', '#nailcare'],
      ctaText: 'Decouvrez FemiGlow',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty caption', () => {
    const result = captionOutputSchema.safeParse({
      caption: '',
      hashtags: [],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// qualityScoreSchema
// ---------------------------------------------------------------------------

describe('qualityScoreSchema', () => {
  it('validates 0-100 range', () => {
    const valid = { clarity: 85, engagement: 92, brandFit: 78 };
    const result = qualityScoreSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects scores above 100', () => {
    const result = qualityScoreSchema.safeParse({ clarity: 150 });
    expect(result.success).toBe(false);
  });

  it('rejects negative scores', () => {
    const result = qualityScoreSchema.safeParse({ clarity: -5 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// moderationResultSchema
// ---------------------------------------------------------------------------

describe('moderationResultSchema', () => {
  it('requires safe boolean', () => {
    const valid = { safe: true, flags: [], canRetry: false };
    expect(moderationResultSchema.safeParse(valid).success).toBe(true);

    const noSafe = { flags: [], canRetry: false };
    expect(moderationResultSchema.safeParse(noSafe).success).toBe(false);
  });

  it('requires flags array and canRetry', () => {
    const noFlags = { safe: true, canRetry: true };
    expect(moderationResultSchema.safeParse(noFlags).success).toBe(false);

    const noCanRetry = { safe: false, flags: ['nsfw'] };
    expect(moderationResultSchema.safeParse(noCanRetry).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// humanReviewSchema
// ---------------------------------------------------------------------------

describe('humanReviewSchema', () => {
  it('validates decision enum', () => {
    expect(humanReviewSchema.safeParse({ decision: 'approved' }).success).toBe(true);
    expect(humanReviewSchema.safeParse({ decision: 'approved_direct' }).success).toBe(true);
    expect(humanReviewSchema.safeParse({ decision: 'rejected' }).success).toBe(true);
    expect(humanReviewSchema.safeParse({ decision: 'edit_requested' }).success).toBe(true);
  });

  it('rejects invalid decision', () => {
    expect(humanReviewSchema.safeParse({ decision: 'unknown' }).success).toBe(false);
  });

  it('accepts optional feedback', () => {
    const result = humanReviewSchema.safeParse({
      decision: 'edit_requested',
      feedback: 'Please make the tone warmer',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// contentGenerationInputSchema
// ---------------------------------------------------------------------------

describe('contentGenerationInputSchema', () => {
  it('validates full input', () => {
    const input = {
      brief: {
        objective: 'notoriete',
        tone: 'elegant',
        targetAudience: 'Femmes 28-45 ans',
        keyMessage: 'Eclat naturel',
      },
      platform: 'instagram',
      format: 'reel',
      contentType: 'rituel',
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
    };
    const result = contentGenerationInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects invalid platform', () => {
    const input = {
      brief: {
        objective: 'notoriete',
        tone: 'elegant',
        targetAudience: 'Femmes 28-45 ans',
        keyMessage: 'Eclat naturel',
      },
      platform: 'twitter',
      format: 'reel',
      contentType: 'rituel',
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
    };
    const result = contentGenerationInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid tenantId', () => {
    const input = {
      brief: {
        objective: 'notoriete',
        tone: 'elegant',
        targetAudience: 'Femmes 28-45 ans',
        keyMessage: 'Eclat naturel',
      },
      platform: 'instagram',
      format: 'reel',
      contentType: 'rituel',
      tenantId: 'not-a-uuid',
    };
    const result = contentGenerationInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
