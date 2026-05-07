import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface StackProps {
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20;
  align?: 'start' | 'center' | 'end' | 'stretch';
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

const gapClasses: Record<NonNullable<StackProps['gap']>, string> = {
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
  10: 'gap-10',
  12: 'gap-12',
  16: 'gap-16',
  20: 'gap-20',
};

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function Stack({
  gap = 4,
  align = 'stretch',
  as: Tag = 'div',
  className,
  children,
}: StackProps) {
  return (
    <Tag className={cn('flex flex-col', gapClasses[gap], alignClasses[align], className)}>
      {children}
    </Tag>
  );
}
