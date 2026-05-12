'use client';

/**
 * YouTubeEmbed — iframe `youtube-nocookie.com/embed/<id>` privacy-friendly.
 *
 * Stratégie :
 *   1. L'URL est parsée côté serveur ou client → `{ id, isShort }`.
 *   2. L'iframe pointe sur `www.youtube-nocookie.com` avec params
 *      `rel=0&modestbranding=1&iv_load_policy=3&playsinline=1` pour minimiser
 *      le détournement d'attention (vidéos suggérées, branding YouTube).
 *   3. Le ratio s'adapte au contexte :
 *        - `isShort=true`  → ratio 9:16 (Short vertical)
 *        - `isShort=false` → ratio 16:9 (player landscape standard)
 *      Le composant parent peut surcharger via la prop `aspectRatio`.
 *   4. `referrerPolicy="strict-origin-when-cross-origin"` empêche la fuite
 *      du chemin d'origine vers Google. `loading="lazy"` reporte le chargement
 *      tant que l'iframe n'est pas dans le viewport (perf + RGPD).
 *
 * NB : YouTube ne permet pas de masquer 100 % le lien « Watch on YouTube »
 * qui apparaît dans le coin du player — c'est le standard de l'industrie
 * (et c'est par design côté Google). Les options ci-dessus minimisent la
 * fuite d'attention au maximum techniquement possible.
 */

import { useId, useMemo } from 'react';
import { parseYouTubeUrl, buildYouTubeEmbedUrl } from '@/lib/video/youtube-url';
import { useTracking } from '@/lib/tracking/use-tracking';

export interface YouTubeEmbedProps {
  /** URL YouTube quelconque (watch?v=, youtu.be, /shorts/, /embed/) ou ID brut 11 chars. */
  url: string;
  /** Titre accessible (visible des lecteurs d'écran + attribut `title` de l'iframe). */
  title: string;
  /** Identifiant d'event tracking (slug stable type `kit-hero-video`). Défaut: id YouTube. */
  videoId?: string;
  /** Surcharge le ratio. Si non fourni → `9-16` pour Short, `16-9` sinon. */
  aspectRatio?: '9-16' | '16-9';
  /** Locale UI YouTube. Défaut `fr`. */
  hl?: string;
  /** Démarrage à N secondes. */
  startSeconds?: number;
  /** Classes Tailwind additionnelles sur le wrapper. */
  className?: string;
}

/**
 * Construit la classe CSS responsable du ratio. Tailwind ne supporte pas les
 * ratios arbitraires en sécurité (purge-friendly) donc on map sur des classes
 * fixes.
 */
function aspectClass(ratio: '9-16' | '16-9'): string {
  return ratio === '9-16' ? 'aspect-[9/16] mx-auto max-w-md' : 'aspect-video w-full';
}

/**
 * Émet un event `video_user_play` au clic sur l'iframe. NB : on ne peut pas
 * tracker un "play" depuis l'iframe YouTube sans IFrame API (postMessage) ;
 * on se contente du focus/click comme proxy de l'intention utilisateur.
 *
 * Pour un tracking plus précis (autoplay vs user-play, % progression), il
 * faudrait :
 *   - Charger https://www.youtube.com/iframe_api côté client
 *   - Wrapper l'iframe dans un YT.Player + écouter `onStateChange`
 * Coût : ~50 kB JS + cookies tiers (annule l'intérêt du domaine nocookie).
 * Tradeoff : on garde le tracking minimal (proxy click).
 */
export function YouTubeEmbed({
  url,
  title,
  videoId,
  aspectRatio,
  hl,
  startSeconds,
  className,
}: YouTubeEmbedProps): JSX.Element | null {
  const reactId = useId();
  const { emit } = useTracking();

  const parsed = useMemo(() => parseYouTubeUrl(url), [url]);

  const embedUrl = useMemo(() => {
    if (!parsed) return null;
    return buildYouTubeEmbedUrl(parsed.id, {
      hl,
      startSeconds,
    });
  }, [parsed, hl, startSeconds]);

  if (!parsed || !embedUrl) {
    if (process.env.NODE_ENV !== 'production') {
      // En dev/test on log mais on n'explose pas le rendu.
      // eslint-disable-next-line no-console
      console.warn(`[YouTubeEmbed] URL invalide ou non reconnue: "${url}"`);
    }
    return null;
  }

  const ratio = aspectRatio ?? (parsed.isShort ? '9-16' : '16-9');
  const slug = videoId ?? parsed.id;

  return (
    <div
      className={`relative ${aspectClass(ratio)} ${className ?? ''}`.trim()}
      data-testid="youtube-embed"
      data-video-id={parsed.id}
      data-is-short={parsed.isShort ? 'true' : 'false'}
      onClick={() => {
        emit('video_user_play', {
          video_id: slug,
          video_title: title,
          video_provider: 'youtube',
        });
      }}
    >
      <iframe
        id={reactId}
        src={embedUrl}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        // `fullscreen` (modern Permissions Policy) + `allowFullScreen` legacy attribute :
        // les deux sont nécessaires pour couvrir tous les navigateurs (Safari < 16.5
        // n'accepte que le legacy ; Chrome/Firefox modernes préfèrent `allow="fullscreen"`).
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full rounded-md border-0"
      />
    </div>
  );
}
