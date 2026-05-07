import type { ArticleAuthor } from '@/lib/schemas';
import { Image } from '@/components/ui/Image';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';

interface AuthorCardProps {
  author: ArticleAuthor;
}

export function AuthorCard({ author }: AuthorCardProps) {
  if (!author.bio && !author.avatar) return null;
  return (
    <aside className="border-y border-encre/10 py-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {author.avatar ? (
          <Image
            src={author.avatar.src}
            alt=""
            width={author.avatar.width}
            height={author.avatar.height}
            ratio="1:1"
            className="h-20 w-20 shrink-0 rounded-full"
          />
        ) : null}
        <div className="space-y-1">
          <Heading as="h3" size="sm" italic="auto">
            {author.name}
          </Heading>
          {author.bio ? (
            <Text size="small" tone="secondary">
              {author.bio}
            </Text>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
