import type { ArticleAuthor } from '@/lib/schemas';
import { Image } from '@/components/ui/Image';
import { formatArticleDate } from '@/lib/utils/format-date';

interface ArticleMetaProps {
  author: ArticleAuthor;
  publishedAt: Date;
  readingTimeMinutes: number;
  /**
   * Phase 7 wiring — durée de lecture déjà interpolée et localisée
   * (`marketing.journal.article.reading_time`). Défaut FR si absent.
   */
  readingTimeLabel?: string;
  /**
   * Phase 9 i18n — locale active pour formater la date (mois arabes sur
   * /ar). Défaut FR si absent.
   */
  locale?: string;
}

export function ArticleMeta({
  author,
  publishedAt,
  readingTimeMinutes,
  readingTimeLabel,
  locale,
}: ArticleMetaProps) {
  const readingTime =
    readingTimeLabel ?? `${readingTimeMinutes} min de lecture`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-body text-xs uppercase tracking-[0.1em] text-encre/50">
      {author.avatar ? (
        <Image
          src={author.avatar.src}
          alt=""
          width={author.avatar.width}
          height={author.avatar.height}
          ratio="1:1"
          className="h-8 w-8 rounded-full"
        />
      ) : null}
      <span>{author.name}</span>
      <span aria-hidden="true" className="text-encre/30">·</span>
      <time dateTime={publishedAt.toISOString()}>{formatArticleDate(publishedAt, locale)}</time>
      <span aria-hidden="true" className="text-encre/30">·</span>
      <span>{readingTime}</span>
    </div>
  );
}
