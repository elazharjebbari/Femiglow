/**
 * Tests YouTube URL parser + embed builder.
 *
 * Couverture :
 *   - watch?v=<id>
 *   - youtu.be/<id>
 *   - /shorts/<id> (axe CHA-243 : Shorts doivent être détectés)
 *   - /embed/<id>
 *   - youtube-nocookie.com/embed/<id>
 *   - ID brut 11 chars
 *   - URLs invalides (vimeo, http://localhost, etc.)
 *   - Édge : query strings, fragments, https vs http, www/m. subdomain
 *   - buildYouTubeEmbedUrl : params de confidentialité, options optionnelles
 */
import { describe, expect, it } from 'vitest';
import {
  buildYouTubeEmbedUrl,
  isYouTubeId,
  parseYouTubeUrl,
  youTubeUrlToEmbed,
} from './youtube-url';

describe('isYouTubeId', () => {
  it('reconnaît les ID 11 chars valides', () => {
    expect(isYouTubeId('dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeId('N2pDuciP4uQ')).toBe(true);
    expect(isYouTubeId('aA_-12345bC')).toBe(true);
  });

  it('rejette les longueurs non-11', () => {
    expect(isYouTubeId('short')).toBe(false);
    expect(isYouTubeId('dQw4w9WgXcQX')).toBe(false); // 12 chars
    expect(isYouTubeId('')).toBe(false);
  });

  it('rejette les caractères interdits', () => {
    expect(isYouTubeId('dQw4w9WgXc!')).toBe(false);
    expect(isYouTubeId('aaa.bbb.ccc')).toBe(false);
    expect(isYouTubeId('aaa bbb cccc')).toBe(false);
  });
});

describe('parseYouTubeUrl — formats classiques', () => {
  it('parse watch?v=<id> (https + www)', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      id: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });

  it('parse watch?v=<id> avec params additionnels', () => {
    expect(
      parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&feature=share'),
    ).toEqual({
      id: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });

  it('parse youtu.be/<id>', () => {
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      id: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });

  it('parse youtu.be/<id>?t=30 (query)', () => {
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=30')).toEqual({
      id: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });

  it('parse /embed/<id>', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual({
      id: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });

  it('parse youtube-nocookie.com/embed/<id>', () => {
    expect(parseYouTubeUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toEqual({
      id: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });

  it('parse m.youtube.com (mobile)', () => {
    expect(parseYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      id: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });

  it('parse music.youtube.com', () => {
    expect(parseYouTubeUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      id: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });
});

describe('parseYouTubeUrl — Shorts (axe CHA-243)', () => {
  it('parse youtube.com/shorts/<id>', () => {
    expect(parseYouTubeUrl('https://youtube.com/shorts/N2pDuciP4uQ')).toEqual({
      id: 'N2pDuciP4uQ',
      isShort: true,
    });
  });

  it('parse www.youtube.com/shorts/<id>?si=xxx (URL fournie par utilisateur)', () => {
    expect(
      parseYouTubeUrl('https://youtube.com/shorts/N2pDuciP4uQ?si=h9_ROBIt-N7Oq7jb'),
    ).toEqual({
      id: 'N2pDuciP4uQ',
      isShort: true,
    });
  });

  it('parse m.youtube.com/shorts/<id>', () => {
    expect(parseYouTubeUrl('https://m.youtube.com/shorts/N2pDuciP4uQ')).toEqual({
      id: 'N2pDuciP4uQ',
      isShort: true,
    });
  });
});

describe('parseYouTubeUrl — ID brut', () => {
  it('accepte un ID brut', () => {
    expect(parseYouTubeUrl('N2pDuciP4uQ')).toEqual({
      id: 'N2pDuciP4uQ',
      isShort: false,
    });
  });

  it('trim avant de parser', () => {
    expect(parseYouTubeUrl('   N2pDuciP4uQ   ')).toEqual({
      id: 'N2pDuciP4uQ',
      isShort: false,
    });
  });
});

describe('parseYouTubeUrl — invalides', () => {
  it('retourne null pour autre host', () => {
    expect(parseYouTubeUrl('https://vimeo.com/12345678')).toBeNull();
    expect(parseYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('retourne null pour URL malformée', () => {
    expect(parseYouTubeUrl('not a url')).toBeNull();
    expect(parseYouTubeUrl('')).toBeNull();
    expect(parseYouTubeUrl('http://')).toBeNull();
  });

  it('retourne null pour ID YouTube manquant', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch')).toBeNull();
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=tooshort')).toBeNull();
    expect(parseYouTubeUrl('https://youtu.be/')).toBeNull();
  });

  it('retourne null pour path non reconnu', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/channel/UCsomechannel')).toBeNull();
    expect(parseYouTubeUrl('https://www.youtube.com/playlist?list=PLxxx')).toBeNull();
  });

  it('retourne null pour types non-string', () => {
    // @ts-expect-error — test runtime guard
    expect(parseYouTubeUrl(null)).toBeNull();
    // @ts-expect-error
    expect(parseYouTubeUrl(undefined)).toBeNull();
    // @ts-expect-error
    expect(parseYouTubeUrl(123)).toBeNull();
  });
});

describe('buildYouTubeEmbedUrl', () => {
  it('utilise toujours youtube-nocookie.com (privacy-enhanced)', () => {
    const url = buildYouTubeEmbedUrl('dQw4w9WgXcQ');
    expect(url).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  });

  it('inclut les params privacy/branding minimal par défaut', () => {
    const url = buildYouTubeEmbedUrl('dQw4w9WgXcQ');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('rel')).toBe('0');
    expect(parsed.searchParams.get('modestbranding')).toBe('1');
    expect(parsed.searchParams.get('iv_load_policy')).toBe('3');
    expect(parsed.searchParams.get('playsinline')).toBe('1');
    expect(parsed.searchParams.get('controls')).toBe('1');
    expect(parsed.searchParams.get('hl')).toBe('fr');
  });

  it('peut activer autoplay+mute', () => {
    const url = buildYouTubeEmbedUrl('dQw4w9WgXcQ', { autoplay: true, mute: true });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('autoplay')).toBe('1');
    expect(parsed.searchParams.get('mute')).toBe('1');
  });

  it('peut surcharger la locale', () => {
    const url = buildYouTubeEmbedUrl('dQw4w9WgXcQ', { hl: 'ar' });
    expect(new URL(url).searchParams.get('hl')).toBe('ar');
  });

  it('peut spécifier un startSeconds (floor)', () => {
    const url = buildYouTubeEmbedUrl('dQw4w9WgXcQ', { startSeconds: 30.9 });
    expect(new URL(url).searchParams.get('start')).toBe('30');
  });

  it('peut spécifier un origin (pour IFrame API)', () => {
    const url = buildYouTubeEmbedUrl('dQw4w9WgXcQ', { origin: 'https://femiglow.com' });
    expect(new URL(url).searchParams.get('origin')).toBe('https://femiglow.com');
  });

  it('lève si ID invalide', () => {
    expect(() => buildYouTubeEmbedUrl('invalid!')).toThrow(/ID invalide/);
    expect(() => buildYouTubeEmbedUrl('')).toThrow(/ID invalide/);
  });
});

describe('youTubeUrlToEmbed — intégration', () => {
  it('Short de l’utilisateur → embed nocookie + isShort=true', () => {
    const r = youTubeUrlToEmbed('https://youtube.com/shorts/N2pDuciP4uQ?si=h9_ROBIt-N7Oq7jb');
    expect(r).not.toBeNull();
    expect(r!.id).toBe('N2pDuciP4uQ');
    expect(r!.isShort).toBe(true);
    expect(r!.embedUrl).toContain('youtube-nocookie.com');
    expect(r!.embedUrl).toContain('N2pDuciP4uQ');
  });

  it('URL classique → isShort=false', () => {
    const r = youTubeUrlToEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(r!.isShort).toBe(false);
  });

  it('URL invalide → null', () => {
    expect(youTubeUrlToEmbed('https://vimeo.com/12345')).toBeNull();
  });
});
