/**
 * Animations registry — profils livrés en V1 du système Component-Media.
 *
 * Sept profils couvrent ~95 % des cas du site :
 *   - `none`           : aucune animation, sortie statique.
 *   - `fade-in`        : opacity 0→1 sur viewport.
 *   - `reveal-up`      : translateY+opacity au scroll (whileInView).
 *   - `scale-hover`    : zoom sur hover (utilisé sur les packshots Kit).
 *   - `parallax-soft`  : parallax léger sur le hero éditorial.
 *   - `schema-svg`     : animations SMIL/CSS sur les SVG narratifs.
 *   - `cross-link`     : combinaison fade-in + scale-hover pour les
 *                        cards de cross-link (Maison/Rituel/Kit/Journal).
 *
 * IMPORTANT :
 *   - Tous les profils respectent `prefers-reduced-motion: reduce` quand
 *     `respectsReducedMotion=true` (par défaut on respecte).
 *   - Les configs framer-motion sont volontairement minimales :
 *     `LazyMotion` + `domAnimation` est chargé une seule fois à la racine
 *     du layout pour partager le bundle.
 */
import type { AnimationKind } from '@/lib/db/types';

export interface AnimationProfileSeed {
  key: string;
  name: string;
  kind: AnimationKind;
  description: string;
  config: Record<string, unknown>;
  respectsReducedMotion: boolean;
  previewSnippet: string | null;
}

export const ANIMATION_REGISTRY: AnimationProfileSeed[] = [
  {
    key: 'none',
    name: 'Aucune',
    kind: 'none',
    description: 'Pas d’animation. À utiliser pour les médias above-the-fold critiques.',
    config: {},
    respectsReducedMotion: true,
    previewSnippet: null,
  },
  {
    key: 'fade-in',
    name: 'Fade-in',
    kind: 'framer-motion',
    description: 'Apparition douce en opacity. Idéal pour les bandeaux et galeries secondaires.',
    config: {
      initial: { opacity: 0 },
      whileInView: { opacity: 1 },
      viewport: { once: true, margin: '-10% 0px' },
      transition: { duration: 0.6, ease: 'easeOut' },
    },
    respectsReducedMotion: true,
    previewSnippet: '<m.div initial={{opacity:0}} whileInView={{opacity:1}} />',
  },
  {
    key: 'reveal-up',
    name: 'Reveal-up',
    kind: 'framer-motion',
    description: 'Translation + opacity vers le haut à l’apparition. Profil par défaut éditorial.',
    config: {
      initial: { opacity: 0, y: 24 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-15% 0px' },
      transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
    },
    respectsReducedMotion: true,
    previewSnippet:
      '<m.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true}} />',
  },
  {
    key: 'scale-hover',
    name: 'Scale-hover',
    kind: 'framer-motion',
    description: 'Zoom doux au hover (1 → 1.04). Privilégié sur les packshots produits.',
    config: {
      whileHover: { scale: 1.04 },
      transition: { type: 'spring', stiffness: 280, damping: 22 },
    },
    respectsReducedMotion: true,
    previewSnippet: '<m.div whileHover={{scale:1.04}} />',
  },
  {
    key: 'parallax-soft',
    name: 'Parallax doux',
    kind: 'framer-motion',
    description:
      'Translation Y proportionnelle au scroll (0.15× viewport). Réservé aux heros narratifs.',
    config: {
      strength: 0.15,
      anchor: 'top',
      maxOffsetPx: 120,
    },
    respectsReducedMotion: true,
    previewSnippet: 'useScroll() + useTransform(scrollYProgress, [0,1], [0, 120])',
  },
  {
    key: 'schema-svg',
    name: 'Schéma SVG',
    kind: 'svg',
    description:
      'Animation SMIL/CSS sur SVG narratifs (origine, fondatrice, atelier). Fallback statique en reduced-motion.',
    config: {
      trigger: 'inView',
      durationMs: 1200,
      easing: 'ease-out',
    },
    respectsReducedMotion: true,
    previewSnippet: '<animate attributeName="opacity" from="0" to="1" dur="1.2s" />',
  },
  {
    key: 'cross-link',
    name: 'Cross-link card',
    kind: 'framer-motion',
    description:
      'Combinaison fade-in (apparition) + scale-hover (interaction) pour les cards de cross-link.',
    config: {
      initial: { opacity: 0, y: 12 },
      whileInView: { opacity: 1, y: 0 },
      whileHover: { scale: 1.02 },
      viewport: { once: true, margin: '-10% 0px' },
      transition: { duration: 0.5, ease: 'easeOut' },
    },
    respectsReducedMotion: true,
    previewSnippet: '<m.div initial whileInView whileHover />',
  },
];

export function findAnimationProfile(key: string): AnimationProfileSeed | undefined {
  return ANIMATION_REGISTRY.find((a) => a.key === key);
}

export function listAnimationKeys(): string[] {
  return ANIMATION_REGISTRY.map((a) => a.key);
}
