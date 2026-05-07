import type { ArticleAuthor } from '@/lib/schemas';
import { Image } from '@/components/ui/Image';
import { formatArticleDate } from '@/lib/utils/format-date';

interface ArticleMetaProps {
  author: ArticleAuthor;
  publishedAt: Date;
  readingTimeMinutes: number;
}

export function ArticleMeta({ author, publishedAt, readingTimeMinutes }: ArticleMetaProps) {
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
      <time dateTime={publishedAt.toISOString()}>{formatArticleDate(publishedAt)}</time>
      <span aria-hidden="true" className="text-encre/30">·</span>
      <span>{readingTimeMinutes}&nbsp;min de lecture</span>
    </div>
  );
}
