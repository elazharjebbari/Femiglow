/**
 * Templates OG — props communes.
 */
export interface OgTemplateProps {
  title: string;
  description: string;
  siteName: string;
  /** Image hero (ex: hero, packshot) - URL ou data:. */
  imageUrl?: string;
  kicker?: string;
  price?: string;
}
