import { z } from 'zod';
import { imageSchema, ctaSchema } from './common';
import {
  productSchema,
  subProductSchema,
  subProductAccentColorSchema,
  comparatifRowSchema,
  handsTestimonialSchema,
  reassuranceSchema,
} from './product';

export const heroVariantSchema = z.enum(['editorial', 'produit', 'lettre']);

export const heroSchema = z.object({
  variant: heroVariantSchema,
  kicker: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  cta: ctaSchema.optional(),
  ctaSecondary: ctaSchema.optional(),
  image: imageSchema.optional(),
});
export type Hero = z.infer<typeof heroSchema>;

export const gesteEtapeSchema = z.object({
  ordre: z.number().int().positive(),
  titre: z.string(),
  duree: z.string(),
  description: z.string(),
  image: imageSchema.optional(),
});
export type GesteEtape = z.infer<typeof gesteEtapeSchema>;

export const manifesteSchema = z.object({
  kicker: z.string().optional(),
  title: z.string(),
  paragraphs: z.array(z.string()).min(1),
  image: imageSchema.optional(),
});
export type Manifeste = z.infer<typeof manifesteSchema>;

export const testimonialSchema = z.object({
  id: z.string(),
  authorFirstName: z.string(),
  authorContext: z.string().optional(),
  quote: z.string(),
  handImage: imageSchema.optional(),
  initieeDepuis: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});
export type Testimonial = z.infer<typeof testimonialSchema>;

export const faqItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
});
export type FAQItem = z.infer<typeof faqItemSchema>;

export const homepageContentSchema = z.object({
  hero: heroSchema,
  gestes: z.array(gesteEtapeSchema).length(5),
  manifeste: manifesteSchema,
  avis: z.array(testimonialSchema).max(3),
  journalExtraitsSlugs: z.array(z.string()).max(3),
});
export type HomepageContent = z.infer<typeof homepageContentSchema>;

export const microEssaiSchema = z.object({
  id: z.string(),
  titre: z.string(),
  paragraphe: z.string(),
  sourceRef: z.string().optional(),
});
export type MicroEssai = z.infer<typeof microEssaiSchema>;

export const qaItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  reponse: z.string(),
});
export type QAItem = z.infer<typeof qaItemSchema>;

export const rituelOrigineSchema = z.object({
  kicker: z.string(),
  titre: z.string(),
  paragraphes: z.array(z.string()).min(2).max(4),
  photoSepia: imageSchema,
});
export type RituelOrigine = z.infer<typeof rituelOrigineSchema>;

/**
 * Schéma vidéo Rituel — supporte deux backends de player :
 *   1. Self-hosted (legacy) : `sources.mp4` + `sources.webm`
 *   2. YouTube (CHA-243) : `youtubeUrl` (toutes variantes acceptées :
 *      `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, ID brut)
 *
 * Si `youtubeUrl` est défini, le composant `VideoPlayer4Gestes` route vers
 * `<YouTubeEmbed>` (iframe `youtube-nocookie.com`). Sinon il utilise les
 * sources locales. `sources` reste requis pour compat historique mais peut
 * pointer vers un fichier inexistant si `youtubeUrl` prend le relais.
 */
/**
 * Chapitre temporel d'une vidéo — Kolenda §4.4 « mini-timeline cliquable ».
 *
 * Contraintes :
 *  - `key` slug kebab-case, unique au sein du tableau parent.
 *  - `label` court (≤ 24 chars) — tient sur la timeline mobile 4-6 segments.
 *  - `startSeconds` borné [0, 600] — la vidéo cible 90 s, on prévoit
 *    10 min comme borne haute pour les futurs formats longs.
 *  - Le tableau parent garantit l'ordre croissant via `refine`.
 */
export const videoChapterSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/),
  label: z.string().min(1).max(24),
  startSeconds: z.number().int().min(0).max(600),
});
export type VideoChapter = z.infer<typeof videoChapterSchema>;

export const rituelVideoSchema = z.object({
  sources: z.object({
    mp4: z.string().url().or(z.string().startsWith('/')),
    webm: z.string().url().or(z.string().startsWith('/')),
  }),
  /** URL YouTube (watch/youtu.be/shorts/embed) ou ID brut 11 chars. Priorité au runtime si défini. */
  youtubeUrl: z.string().optional(),
  poster: imageSchema,
  captions: z.object({
    fr: z.string(),
    ar: z.string(),
  }),
  transcript: z.string(),
  durationSeconds: z.number().int().positive(),

  // Extensions Kolenda §4.4 (phase 1) — tous optionnels (rétrocompat).
  /**
   * Poster custom maison (frame d'action) qui remplace `poster` dans le
   * click-to-play overlay (`VideoPosterCover`). Si absent, fallback `poster`.
   */
  posterCustom: imageSchema.optional(),

  /**
   * Chapitres ordonnés par `startSeconds` croissant. 2-6 entrées.
   */
  chapters: z
    .array(videoChapterSchema)
    .min(2)
    .max(6)
    .refine(
      (arr) => arr.every((c, i) => i === 0 || c.startSeconds >= (arr[i - 1]?.startSeconds ?? 0)),
      { message: 'chapters doivent être triés par startSeconds croissant' },
    )
    .optional(),

  /**
   * Mention de provenance italique sous le sous-titre (voix maison, sans
   * prénom nominal). Termine par une ponctuation finale.
   */
  provenance: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/[.!?»]$/, 'provenance doit se terminer par une ponctuation finale')
    .optional(),

  /** Badge durée affiché sur le poster (ex. « 90″ », « 1′30″ »). */
  durationDisplay: z.string().min(1).max(8).optional(),

  /** Couleur d'accent (réutilise l'enum SubProduct — Annexe A). */
  accentColor: subProductAccentColorSchema.optional(),

  /**
   * Cover SVG dynamique (Phase α-δ). Si défini, remplace `posterCustom` /
   * `poster` dans `VideoPosterCover`. Discriminé par `source` :
   *  - `inline` : SVG markup sanitized (DOMPurify côté serveur).
   *  - `file`   : référence media DB (SVG uploadé).
   *  - `url`    : URL HTTPS externe vers un SVG.
   */
  posterCoverSvg: z
    .object({
      source: z.enum(['inline', 'file', 'url']),
      inline: z.string().max(50_000).nullable().optional(),
      fileMediaId: z.string().max(64).nullable().optional(),
      url: z.string().url().max(500).nullable().optional(),
      meta: z
        .object({
          viewBox: z.string().max(64).optional(),
          ariaLabel: z.string().max(200).optional(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
});
export type RituelVideo = z.infer<typeof rituelVideoSchema>;

export const rituelSciencesSchema = z.object({
  titre: z.string(),
  essais: z.array(microEssaiSchema).length(3),
  sourcesAcademiques: z.array(z.string()).min(1),
});
export type RituelSciences = z.infer<typeof rituelSciencesSchema>;

export const rituelInterviewSchema = z.object({
  introduction: z.string(),
  portrait: imageSchema.optional(),
  nomInterviewee: z.string(),
  questions: z.array(qaItemSchema).min(3).max(6),
});
export type RituelInterview = z.infer<typeof rituelInterviewSchema>;

export const rituelPivotSchema = z.object({
  phrase: z.string(),
  cta: ctaSchema,
});
export type RituelPivot = z.infer<typeof rituelPivotSchema>;

export const rituelPageContentSchema = z.object({
  hero: heroSchema,
  origine: rituelOrigineSchema,
  videoGestes: rituelVideoSchema,
  sciences: rituelSciencesSchema,
  interview: rituelInterviewSchema,
  pivot: rituelPivotSchema,
  journalCrossSlugs: z.array(z.string()).length(3),
});
export type RituelPageContent = z.infer<typeof rituelPageContentSchema>;

export const matiereSchema = z.object({
  id: z.string(),
  nom: z.string(),
  origine: z.string(),
  pourquoi: z.string(),
  iconSlug: z.enum(['cire', 'jojoba', 'kaolin', 'mica']),
  ambiance: z.enum(['champagne', 'sauge', 'creme', 'petale']),
});
export type Matiere = z.infer<typeof matiereSchema>;

export const engagementSchema = z.object({
  ordre: z.number().int().min(1).max(4),
  titre: z.string(),
  description: z.string(),
});
export type Engagement = z.infer<typeof engagementSchema>;

export const crossLinkSchema = z.object({
  id: z.string(),
  href: z.string(),
  kicker: z.string(),
  titre: z.string(),
  image: imageSchema,
});
export type CrossLink = z.infer<typeof crossLinkSchema>;

export const atelierSchema = z.object({
  adresse: z.string(),
  quartier: z.string(),
  description: z.array(z.string()).min(1).max(3),
  gallerie: z.array(imageSchema).length(3),
});
export type Atelier = z.infer<typeof atelierSchema>;

export const narrativeSectionSchema = z.object({
  kicker: z.string(),
  titre: z.string(),
  paragraphs: z.array(z.string()).min(2).max(3),
  image: imageSchema,
  imagePosition: z.enum(['left', 'right']).default('right'),
});
export type NarrativeSection = z.infer<typeof narrativeSectionSchema>;

export const maisonPageContentSchema = z.object({
  hero: heroSchema,
  origine: narrativeSectionSchema,
  fondatrice: narrativeSectionSchema,
  atelier: atelierSchema,
  matieres: z.array(matiereSchema).length(4),
  engagements: z.array(engagementSchema).length(4),
  crossLinks: z.array(crossLinkSchema).length(3),
  signatureImage: imageSchema.optional(),
});
export type MaisonPageContent = z.infer<typeof maisonPageContentSchema>;

/**
 * Schéma vidéo Kit — voir `rituelVideoSchema` pour le détail du contrat.
 * Idem : `youtubeUrl` optionnel prend la priorité sur les `sources` locales.
 */
export const kitVideoSchema = z.object({
  sources: z.object({
    mp4: z.string().url().or(z.string().startsWith('/')),
    webm: z.string().url().or(z.string().startsWith('/')),
  }),
  /** URL YouTube (watch/youtu.be/shorts/embed) ou ID brut 11 chars. Priorité au runtime si défini. */
  youtubeUrl: z.string().optional(),
  poster: imageSchema,
  captions: z.object({
    fr: z.string(),
    ar: z.string(),
  }),
  transcript: z.string(),
  durationSeconds: z.number().int().positive(),

  // Extensions Kolenda §4.4 (phase 1) — alignées sur rituelVideoSchema.
  posterCustom: imageSchema.optional(),
  chapters: z
    .array(videoChapterSchema)
    .min(2)
    .max(6)
    .refine(
      (arr) => arr.every((c, i) => i === 0 || c.startSeconds >= (arr[i - 1]?.startSeconds ?? 0)),
      { message: 'chapters doivent être triés par startSeconds croissant' },
    )
    .optional(),
  provenance: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/[.!?»]$/, 'provenance doit se terminer par une ponctuation finale')
    .optional(),
  durationDisplay: z.string().min(1).max(8).optional(),
  accentColor: subProductAccentColorSchema.optional(),

  /** Cover SVG dynamique (Phase α-δ) — aligné sur rituelVideoSchema. */
  posterCoverSvg: z
    .object({
      source: z.enum(['inline', 'file', 'url']),
      inline: z.string().max(50_000).nullable().optional(),
      fileMediaId: z.string().max(64).nullable().optional(),
      url: z.string().url().max(500).nullable().optional(),
      meta: z
        .object({
          viewBox: z.string().max(64).optional(),
          ariaLabel: z.string().max(200).optional(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
});
export type KitVideo = z.infer<typeof kitVideoSchema>;

export const kitComparatifSchema = z.object({
  titreVernis: z.string(),
  titreRituel: z.string(),
  rows: z.array(comparatifRowSchema).min(4).max(8),
});
export type KitComparatif = z.infer<typeof kitComparatifSchema>;

/**
 * Vue éclatée du Kit FemiGlow — Kolenda §4.3.
 *
 * Image annotée des 3 sous-produits étalés à plat avec lignes fines
 * vers chaque label. Format isométrique doux, fond sable. Rendue en
 * tête de la section « La composition », avant la grille 3 cards.
 *
 * Optionnel : si absent du CMS / mock, le composant `CompositionReveal`
 * ne rend pas la `<figure>` (rétrocompat). À fournir par DA pour activer.
 */
export const kitExplodedViewSchema = imageSchema;
export type KitExplodedView = z.infer<typeof kitExplodedViewSchema>;

export const kitPageContentSchema = z.object({
  product: productSchema,
  composition: z.array(subProductSchema).min(3).max(4),
  /**
   * Vue éclatée annotée des 3 sous-produits, rendue en tête de la
   * section « La composition » avant la grille de cards (Kolenda §4.3).
   * Optionnelle — la section fonctionne sans.
   */
  compositionExplodedView: kitExplodedViewSchema.optional(),
  videoSrc: kitVideoSchema,
  comparatif: kitComparatifSchema,
  faq: z.array(faqItemSchema).min(8).max(10),
  handsTestimonials: z.array(handsTestimonialSchema).min(3).max(4),
  reassurances: z.array(reassuranceSchema).length(3),
  journalCrossSlugs: z.array(z.string()).length(3),
});
export type KitPageContent = z.infer<typeof kitPageContentSchema>;
