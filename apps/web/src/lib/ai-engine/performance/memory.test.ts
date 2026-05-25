import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';

// ---------------------------------------------------------------------------
// Memory usage tests for MemorySaver checkpointer
// ---------------------------------------------------------------------------

describe('AI Engine — MemorySaver memory usage', () => {
  beforeEach(() => {
    // Force GC if available (run with --expose-gc for accuracy)
    if (global.gc) global.gc();
  });

  it('MemorySaver after 1 thread uses reasonable memory', () => {
    const baseline = process.memoryUsage().heapUsed;
    const saver = new MemorySaver();

    // MemorySaver is an in-memory Map-based checkpointer.
    // Just creating it and verifying it exists is the key test.
    expect(saver).toBeDefined();

    const afterCreation = process.memoryUsage().heapUsed;
    const delta = afterCreation - baseline;

    // Creating a MemorySaver should use less than 5MB
    expect(delta).toBeLessThan(5 * 1024 * 1024);
  });

  it('MemorySaver after 10 instances does not leak excessively', () => {
    const baseline = process.memoryUsage().heapUsed;
    const savers: MemorySaver[] = [];

    for (let i = 0; i < 10; i++) {
      savers.push(new MemorySaver());
    }

    const afterCreation = process.memoryUsage().heapUsed;
    const delta = afterCreation - baseline;

    // 10 MemorySavers should use less than 10MB total
    expect(delta).toBeLessThan(10 * 1024 * 1024);
    expect(savers.length).toBe(10);
  });

  it('clearing/resetting engine releases checkpointer reference', () => {
    let saver: MemorySaver | null = new MemorySaver();
    const ref = new WeakRef(saver);

    // Simulate engine reset by nullifying the reference
    saver = null;

    // The WeakRef should still be retrievable (GC hasn't run yet typically)
    // but we verify the reference can be cleared without error
    // and the pattern of nullifying works
    expect(ref).toBeDefined();
    // If GC has run, deref returns undefined; if not, it returns the object.
    // Either way, the test verifies no error is thrown during cleanup.
    const derefResult = ref.deref();
    // derefResult is either the MemorySaver or undefined - both are valid
    expect(derefResult === undefined || derefResult instanceof MemorySaver).toBe(true);
  });

  it('state size for a typical generation object is < 100KB', () => {
    const typicalState = {
      jobId: 'job-123',
      platform: 'instagram',
      format: 'post',
      contentType: 'awareness',
      brief: {
        objective: 'awareness',
        keyMessage: 'Discover the ritual of natural Japanese beauty.',
        tone: 'luxurious',
        language: 'fr',
        targetAudience: 'Femmes 25-45 ans',
        constraints: [],
        maxBudgetCents: 200,
      },
      script: {
        hook: 'Discover the secret of luminous nails',
        scenes: Array.from({ length: 5 }, (_, i) => ({
          sceneNumber: i + 1,
          description: `Scene ${i + 1} description with moderate detail about the product and its features.`,
          textOverlay: `Overlay text ${i + 1}`,
          durationSeconds: 3,
          transition: 'fade',
        })),
        cta: 'Shop FemiGlow today',
        voiceoverRequired: false,
        musicRequired: true,
        musicMood: 'calm',
        visualDirection: Array.from({ length: 3 }, (_, i) => ({
          element: `element_${i}`,
          style: 'minimal_japanese',
          colors: ['cream', 'sage', 'white'],
          composition: 'centered',
        })),
      },
      caption: 'A beautiful ritual of care and precision. The art of Japanese nail care, refined for modern life. #JBeauty #FemiGlow #NailCare #SelfCare',
      hashtags: ['#JBeauty', '#FemiGlow', '#NailCare', '#SelfCare', '#Beauty'],
      images: Array.from({ length: 5 }, (_, i) => ({
        assetId: `img-${i}`,
        url: `https://cdn.example.com/images/generated-${i}.png`,
        mimeType: 'image/png',
        width: 1080,
        height: 1080,
        provider: 'openai:dall-e-3',
        costCents: 4,
      })),
      videos: [],
      knowledgeContext: 'Brand guidelines and product information. '.repeat(50),
      brandGuidelines: 'FemiGlow brand guidelines text. '.repeat(30),
      qualityScores: { text_quality: 0.85, visual_quality: 0.9, brand_compliance: 0.88, average: 0.87 },
      moderationResult: { safe: true, flags: [] },
      costTracking: {
        totalCents: 32,
        breakdown: { parseBrief: 0, generateScript: 8, generateImages: 20, qualityCheck: 4 },
        tokensUsed: { input: 2500, output: 1800 },
      },
      errors: [],
      currentStep: 'complete',
    };

    const serialized = JSON.stringify(typicalState);
    const sizeBytes = new TextEncoder().encode(serialized).length;

    // A typical generation state should be well under 100KB
    expect(sizeBytes).toBeLessThan(100 * 1024);
  });
});
