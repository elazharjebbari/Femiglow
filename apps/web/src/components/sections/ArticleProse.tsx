import { cn } from '@/lib/utils/cn';

interface ArticleProseProps {
  html: string;
  dropCap?: boolean;
}

export function ArticleProse({ html, dropCap = true }: ArticleProseProps) {
  return (
    <div
      id="article-body"
      className={cn('prose-femiglow', !dropCap && 'no-drop-cap')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
