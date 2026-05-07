import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Size = 'lead' | 'body' | 'body-tabular' | 'small' | 'caption';
type Tone = 'default' | 'secondary' | 'tertiary' | 'on-dark';
type Family = 'body' | 'display';

interface TextProps {
  as?: ElementType;
  size?: Size;
  tone?: Tone;
  family?: Family;
  italic?: boolean;
  prose?: boolean;
  balance?: boolean;
  className?: string;
  children: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  lead: 'text-lead font-normal',
  body: 'text-base leading-[1.7]',
  'body-tabular': 'text-base leading-[1.6] [font-feature-settings:"tnum","lnum"]',
  small: 'text-sm leading-[1.6]',
  caption: 'text-xs leading-[1.5] uppercase tracking-[0.1em]',
};

const toneClasses: Record<Tone, string> = {
  default: 'text-encre',
  secondary: 'text-encre/70',
  tertiary: 'text-encre/50',
  'on-dark': 'text-creme',
};

const familyClasses: Record<Family, string> = {
  body: 'font-body',
  display: 'font-display',
};

export function Text({
  as: Tag = 'p',
  size = 'body',
  tone = 'default',
  family = 'body',
  italic = false,
  prose = false,
  balance = false,
  className,
  children,
}: TextProps) {
  return (
    <Tag
      className={cn(
        sizeClasses[size],
        toneClasses[tone],
        familyClasses[family],
        italic && 'italic',
        prose && 'max-w-prose',
        balance && '[text-wrap:balance]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
