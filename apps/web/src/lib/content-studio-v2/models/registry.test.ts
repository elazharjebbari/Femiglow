import { describe, expect, it } from 'vitest';
import {
  MODELS,
  listChatModels,
  listImageModels,
  listVideoModels,
  listModels,
  listProviders,
  suggestForFormat,
  findModelById,
} from './registry';

describe('content-studio-v2/models/registry', () => {
  describe('listModels', () => {
    it('returns >= 3 chat models', () => {
      expect(listChatModels().length).toBeGreaterThanOrEqual(3);
    });

    it('returns >= 3 image models', () => {
      expect(listImageModels().length).toBeGreaterThanOrEqual(3);
    });

    it('returns >= 1 video model', () => {
      expect(listVideoModels().length).toBeGreaterThanOrEqual(1);
    });

    it('each model has required fields', () => {
      for (const m of MODELS) {
        expect(m.id).toBeTruthy();
        expect(m.provider).toBeTruthy();
        expect(['chat', 'image', 'video']).toContain(m.role);
        expect(m.label).toBeTruthy();
        expect(['fast', 'balanced', 'premium']).toContain(m.tier);
        expect(Array.isArray(m.capabilities)).toBe(true);
        expect(Array.isArray(m.recommendedFor)).toBe(true);
      }
    });

    it('listModels(role) filters by role', () => {
      const imgs = listModels('image');
      expect(imgs.every((m) => m.role === 'image')).toBe(true);
    });
  });

  describe('suggestForFormat', () => {
    it('suggestForFormat(post).chat is gpt-4o-mini (fast tier, recommendedFor post)', () => {
      const s = suggestForFormat('post');
      expect(s.chat?.id).toBe('gpt-4o-mini');
    });

    it('suggestForFormat(reel).chat is gpt-4o (balanced tier, recommendedFor reel)', () => {
      const s = suggestForFormat('reel');
      expect(s.chat?.id).toBe('gpt-4o');
    });

    it('suggestForFormat(carousel).chat is gpt-4o (lowest tier among matching)', () => {
      const s = suggestForFormat('carousel');
      // gpt-4o (balanced) is sorted before claude-sonnet-4-6 (premium)
      expect(s.chat?.id).toBe('gpt-4o');
    });

    it('suggestForFormat(story).image is gpt-image-1-mini', () => {
      const s = suggestForFormat('story');
      expect(s.image?.id).toBe('gpt-image-1-mini');
    });

    it('suggestForFormat(reel).video is mock-video-1.0', () => {
      const s = suggestForFormat('reel');
      expect(s.video?.id).toBe('mock-video-1.0');
    });

    it('suggestForFormat(post).video falls back to default video (mock) since no post-recommended video exists', () => {
      const s = suggestForFormat('post');
      expect(s.video?.id).toBe('mock-video-1.0');
    });
  });

  describe('findModelById', () => {
    it('returns the model for known id', () => {
      expect(findModelById('gpt-4o-mini')?.label).toBe('GPT-4o mini');
    });

    it('returns null for unknown id', () => {
      expect(findModelById('nonexistent-model-xyz')).toBeNull();
    });
  });

  describe('listProviders', () => {
    it('returns deduped providers', () => {
      const providers = listProviders();
      const ids = providers.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('marks mock provider as status=mock', () => {
      const mock = listProviders().find((p) => p.id === 'mock');
      expect(mock?.status).toBe('mock');
    });

    it('marks openai provider as status=healthy', () => {
      const openai = listProviders().find((p) => p.id === 'openai');
      expect(openai?.status).toBe('healthy');
    });

    it('includes Higgsfield as a provider', () => {
      const hf = listProviders().find((p) => p.id === 'higgsfield');
      expect(hf).toBeDefined();
      expect(hf?.label).toBe('Higgsfield');
      expect(hf?.status).toBe('healthy');
    });
  });

  describe('Higgsfield models', () => {
    it('exposes 3 Higgsfield image models (Flux line)', () => {
      const hfImages = listImageModels().filter((m) => m.provider === 'higgsfield');
      expect(hfImages.length).toBe(3);
      const ids = hfImages.map((m) => m.id).sort();
      expect(ids).toEqual(['hf-flux-1', 'hf-flux-pro', 'hf-flux-schnell']);
    });

    it('exposes 4 Higgsfield video models', () => {
      const hfVideos = listVideoModels().filter((m) => m.provider === 'higgsfield');
      expect(hfVideos.length).toBe(4);
      const ids = hfVideos.map((m) => m.id).sort();
      expect(ids).toEqual(['hf-video-lite', 'hf-video-mini', 'hf-video-standard', 'hf-video-turbo']);
    });

    it('all Higgsfield video models support vertical-9x16', () => {
      const hfVideos = listVideoModels().filter((m) => m.provider === 'higgsfield');
      for (const m of hfVideos) {
        expect(m.capabilities).toContain('vertical-9x16');
      }
    });

    it('every Higgsfield model has a pricing.perCall > 0', () => {
      const hfModels = MODELS.filter((m) => m.provider === 'higgsfield');
      for (const m of hfModels) {
        expect(m.pricing.perCall).toBeGreaterThan(0);
      }
    });
  });
});
