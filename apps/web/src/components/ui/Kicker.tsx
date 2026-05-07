import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Tone = 'default' | 'on-dark' | 'champagne' | 'sauge';

interface KickerProps {
  as?: ElementType;
  tone?: Tone;
  withRule?: boolean;
  className?: string;
  children: ReactNode;
}

const toneClasses: Record<Tone, string> = {
  default: 'text-encre/70',
  'on-dark': 'text-creme/80',
  champagne: 'text-champagne-dark',
  sauge: 'text-sauge-dark',
};

export function Kicker({
  as: Tag = 'span',
  tone = 'default',
  withRule = false,
  className,
  children,
}: KickerProps) {
  return (
    <Tag
      className={cn(
        'inline-flex items-center gap-3 uppercase font-medium font-body',
        'text-kicker',
        toneClasses[tone],
        className,
      )}
    >
      {withRule && (
        <span aria-hidden="true" className="h-px w-8 bg-current opacity-50" />
      )}
      <span>{children}</span>
    </Tag>
  );
}
