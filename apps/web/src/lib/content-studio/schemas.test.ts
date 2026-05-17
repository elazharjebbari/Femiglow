import { describe, expect, it } from 'vitest';
import {
  contentIdeaCreateSchema,
  draftUpdateSchema,
  postizDraftSchema,
  visualGenerationSchema,
} from './schemas';

describe('content studio schemas', () => {
  describe('contentIdeaCreateSchema', () => {
    it('valide une idée complète', () => {
      const result = contentIdeaCreateSchema.safeParse({
        pillar: 'rituel',
        objective: 'consideration',
        platform: 'instagram',
        format: 'post',
        prompt: 'Présenter le rituel FemiGlow comme un geste lent du soir',
      });
      expect(result.success).toBe(true);
    });

    it('rejette un prompt trop court', () => {
      const result = contentIdeaCreateSchema.safeParse({
        pillar: 'rituel',
        objective: 'consideration',
        platform: 'instagram',
        format: 'post',
        prompt: 'court',
      });
      expect(result.success).toBe(false);
    });

    it('rejette un pilier invalide', () => {
      const result = contentIdeaCreateSchema.safeParse({
        pillar: 'invalide',
        objective: 'consideration',
        platform: 'instagram',
        format: 'post',
        prompt: 'Un rituel simple et efficace pour le soir.',
      });
      expect(result.success).toBe(false);
    });

    it('accepte campaignId nullable', () => {
      const result = contentIdeaCreateSchema.safeParse({
        campaignId: null,
        pillar: 'rituel',
        objective: 'consideration',
        platform: 'instagram',
        format: 'post',
        prompt: 'Un rituel simple et efficace pour le soir.',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('draftUpdateSchema', () => {
    it('valide une mise à jour caption', () => {
      const result = draftUpdateSchema.safeParse({
        caption: 'Nouvelle caption sobre.',
      });
      expect(result.success).toBe(true);
    });

    it('valide mediaId nullable', () => {
      const result = draftUpdateSchema.safeParse({
        mediaId: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejette une caption vide', () => {
      const result = draftUpdateSchema.safeParse({
        caption: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejette plus de 30 hashtags', () => {
      const result = draftUpdateSchema.safeParse({
        hashtags: Array.from({ length: 35 }, (_, i) => `tag${i}`),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('postizDraftSchema', () => {
    it('valide un payload Postiz minimal', () => {
      const result = postizDraftSchema.safeParse({
        integrationId: 'ig_1',
      });
      expect(result.success).toBe(true);
    });

    it('valide avec scheduledAt', () => {
      const result = postizDraftSchema.safeParse({
        integrationId: 'ig_1',
        scheduledAt: '2026-05-16T10:30:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejette un integrationId vide', () => {
      const result = postizDraftSchema.safeParse({
        integrationId: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('visualGenerationSchema', () => {
    it('valide un prompt de génération visuelle', () => {
      const result = visualGenerationSchema.safeParse({
        prompt: 'Visuel beauté naturel FemiGlow, rituel ongles et mains.',
        size: '1024x1024',
        quality: 'low',
      });
      expect(result.success).toBe(true);
    });

    it('rejette un prompt trop court', () => {
      const result = visualGenerationSchema.safeParse({
        prompt: 'court',
      });
      expect(result.success).toBe(false);
    });

    it('applique les valeurs par défaut', () => {
      const result = visualGenerationSchema.safeParse({
        prompt: 'Un visuel naturel et apaisant pour ongles.',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.size).toBe('1024x1536');
        expect(result.data.quality).toBe('low');
      }
    });
  });
});