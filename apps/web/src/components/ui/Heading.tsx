import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Level = 1 | 2 | 3 | 4;
type Size =
  | 'display-2xl'
  | 'display-xl'
  | 'display-lg'
  | 'display-md'
  | 'display-sm'
  | 'lg'
  | 'md'
  | 'sm';
type Tone = 'default' | 'soft' | 'on-dark';
type Italic = 'never' | 'auto' | 'always';

interface HeadingProps {
  as?: `h${Level}`;
  size?: Size;
  tone?: Tone;
  italic?: Italic;
  balance?: boolean;
  className?: string;
  children: ReactNode;
  id?: string;
  tabIndex?: number;
}

const sizeClasses: Record<Size, string> = {
  'display-2xl': 'text-display-2xl',
  'display-xl': 'text-display-xl',
  'display-lg': 'text-display-lg',
  'display-md': 'text-display-md',
  'display-sm': 'text-display-sm',
  lg: 'text-3xl sm:text-4xl leading-[1.1]',
  md: 'text-2xl sm:text-3xl leading-[1.15]',
  sm: 'text-xl sm:text-2xl leading-[1.2]',
};

const toneClasses: Record<Tone, string> = {
  default: 'text-encre',
  soft: 'text-encre/70',
  'on-dark': 'text-creme',
};

export function Heading({
  as: Tag = 'h2',
  size = 'md',
  tone = 'default',
  italic = 'never',
  balance = true,
  className,
  children,
  id,
  tabIndex,
}: HeadingProps) {
  return (
    <Tag
      id={id}
      tabIndex={tabIndex}
      className={cn(
        'font-display font-medium',
        sizeClasses[size],
        toneClasses[tone],
        italic === 'always' && 'italic',
        balance && '[text-wrap:balance]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
