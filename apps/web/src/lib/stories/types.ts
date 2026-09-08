/**
 * Contrat runtime du feed Stories vidéo (voir docs/stories-video-2026-08-21/).
 * Forme COMPACTE et déjà LOCALISÉE : le wrapper RSC (`StoriesVideoBound`)
 * résout l'i18n et passe ces objets au client. Les URLs vidéo sont de simples
 * chaînes → aucun coût de payload tant qu'un `<source>` n'est pas monté.
 */

export interface StorySource {
  url: string;
  mime: 'video/mp4' | 'video/webm';
}

export interface StorySegmentCta {
  label: string;
  /** Ancre interne (ex. `#commander-femiglow`) ou URL. */
  target: string;
}

export interface StorySegment {
  id: string;
  /** webm avant mp4 (le navigateur prend le 1ᵉʳ supporté). */
  sources: StorySource[];
  poster: string;
  durationMs: number;
  width?: number;
  height?: number;
  caption?: string;
  cta?: StorySegmentCta;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  bubblePoster: string;
  /** Token d'accent optionnel (anneau de bulle). */
  accent?: string;
  segments: StorySegment[];
}

export interface StoryFeed {
  stories: Story[];
}

/** Libellés UI localisés du rail + viewer (résolus côté serveur). */
export interface StoriesStrings {
  /** aria-label du rail. */
  sectionLabel: string;
  /** Titre visible optionnel au-dessus du rail. */
  heading?: string;
  /** Gabarit du compteur de vidéos (« {count} vidéos ») — signale qu'il y en a plusieurs. */
  countLabel: string;
  /** Gabarit `Ouvrir la story : {title}`. */
  openAria: string;
  /** Affordance de défilement (« Faites glisser pour voir plus »). */
  scrollHint: string;
  /** aria-label du bouton flèche du rail (« Voir plus de stories »). */
  scrollMore: string;
  prevSegment: string;
  nextSegment: string;
  close: string;
  mute: string;
  unmute: string;
  pause: string;
  play: string;
  /** Gabarit `Segment {index} sur {total}`. */
  segmentProgress: string;
  /** CTA par défaut si un segment n'en définit pas. */
  defaultCta: string;
}
