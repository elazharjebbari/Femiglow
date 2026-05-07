import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Width = 'prose' | 'content' | 'wide' | 'page';

interface ContainerProps {
  width?: Width;
  as?: ElementType;
  padded?: boolean;
  className?: string;
  children: ReactNode;
}

const widthClasses: Record<Width, string> = {
  prose: 'max-w-prose',
  content: 'max-w-content',
  wide: 'max-w-wide',
  page: 'max-w-page',
};

export function Container({
  width = 'wide',
  as: Tag = 'div',
  padded = true,
  className,
  children,
}: ContainerProps) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full',
        widthClasses[width],
        padded && 'px-5 sm:px-8 lg:px-12',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
