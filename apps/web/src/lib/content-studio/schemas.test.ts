import { describe, expect, it } from 'vitest';
import {
  contentIdeaCreateSchema,
  draftUpdateSchema,
  postizDraftSchema,
  visualGenerationSchema,
  briefUpdateSchema,
  learningNoteSchema,
  draftRejectSchema,
  postCancelSchema,
  campaignCreateSchema,
  campaignUpdateSchema,
  campaignQuerySchema,
  ideaQuerySchema,
  draftQuerySchema,
  postQuerySchema,
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

  describe('briefUpdateSchema', () => {
    it('valide une mise à jour angle', () => {
      const result = briefUpdateSchema.safeParse({ angle: 'Nouvel angle' });
      expect(result.success).toBe(true);
    });

    it('accepte des constraints', () => {
      const result = briefUpdateSchema.safeParse({ constraints: { maxHashtags: 10 } });
      expect(result.success).toBe(true);
    });

    it('rejette les champs inconnus', () => {
      const result = briefUpdateSchema.safeParse({ unknown: true });
      expect(result.success).toBe(false);
    });
  });

  describe('learningNoteSchema', () => {
    it('valide une note correcte', () => {
      const result = learningNoteSchema.safeParse({ note: 'Le hook question génère plus d\'engagement' });
      expect(result.success).toBe(true);
    });

    it('rejette une note vide', () => {
      const result = learningNoteSchema.safeParse({ note: '' });
      expect(result.success).toBe(false);
    });

    it('rejette plus de 5 tags', () => {
      const result = learningNoteSchema.safeParse({ note: 'Test', tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
      expect(result.success).toBe(false);
    });
  });

  describe('draftRejectSchema', () => {
    it('valide sans raison', () => {
      expect(draftRejectSchema.safeParse({}).success).toBe(true);
    });

    it('valide avec raison', () => {
      expect(draftRejectSchema.safeParse({ reason: 'Pas assez convaincant' }).success).toBe(true);
    });

    it('rejette une raison trop longue', () => {
      expect(draftRejectSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
    });
  });

  describe('postCancelSchema', () => {
    it('valide sans raison', () => {
      expect(postCancelSchema.safeParse({}).success).toBe(true);
    });

    it('rejette une raison trop longue', () => {
      expect(postCancelSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
    });
  });

  describe('query schemas (pagination)', () => {
    it('ideaQuerySchema accepte un objet vide (partial)', () => {
      const result = ideaQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('ideaQuerySchema accepte limit + offset', () => {
      const result = ideaQuerySchema.safeParse({ limit: 50, offset: 0 });
      expect(result.success).toBe(true);
    });

    it('draftQuerySchema accepte status + platform', () => {
      const result = draftQuerySchema.safeParse({ status: 'generated', platform: 'instagram' });
      expect(result.success).toBe(true);
    });

    it('postQuerySchema accepte scheduledAfter + scheduledBefore', () => {
      const result = postQuerySchema.safeParse({ scheduledAfter: '2026-01-01', scheduledBefore: '2026-12-31' });
      expect(result.success).toBe(true);
    });

    it('ideaQuerySchema rejette limit > 100', () => {
      const result = ideaQuerySchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe('campaignCreateSchema', () => {
    it('valide une campagne correcte', () => {
      const result = campaignCreateSchema.safeParse({
        name: 'Lancement été',
        objective: 'notoriete',
      });
      expect(result.success).toBe(true);
    });

    it('rejette un nom vide', () => {
      const result = campaignCreateSchema.safeParse({
        name: '',
        objective: 'notoriete',
      });
      expect(result.success).toBe(false);
    });

    it('accepte des dates optionnelles', () => {
      const result = campaignCreateSchema.safeParse({
        name: 'Campagne avec dates',
        objective: 'conversion',
        startsAt: '2026-06-01T00:00:00.000Z',
        endsAt: '2026-08-31T23:59:59.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejette les champs inconnus', () => {
      const result = campaignCreateSchema.safeParse({
        name: 'Test',
        objective: 'conversion',
        extra: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('campaignUpdateSchema', () => {
    it('valide une mise à jour partielle', () => {
      const result = campaignUpdateSchema.safeParse({ name: 'Nouveau nom' });
      expect(result.success).toBe(true);
    });

    it('rejette un nom vide', () => {
      const result = campaignUpdateSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('campaignQuerySchema', () => {
    it('accepte un status valide', () => {
      const result = campaignQuerySchema.safeParse({ status: 'active' });
      expect(result.success).toBe(true);
    });

    it('rejette un status invalide', () => {
      const result = campaignQuerySchema.safeParse({ status: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('accepte un objet vide', () => {
      const result = campaignQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});