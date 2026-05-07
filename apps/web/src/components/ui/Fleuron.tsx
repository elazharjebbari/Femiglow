import { cn } from '@/lib/utils/cn';

type Size = 'sm' | 'md' | 'lg';
type Tone = 'encre' | 'champagne' | 'sauge';

interface FleuronProps {
  size?: Size;
  tone?: Tone;
  className?: string;
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-4 w-12',
  md: 'h-5 w-16',
  lg: 'h-6 w-20',
};

const toneClasses: Record<Tone, string> = {
  encre: 'text-encre/40',
  champagne: 'text-champagne-dark/60',
  sauge: 'text-sauge-dark/50',
};

export function Fleuron({ size = 'md', tone = 'encre', className }: FleuronProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn('mx-auto flex items-center justify-center', sizeClasses[size], toneClasses[tone], className)}
    >
      <svg
        viewBox="0 0 80 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <line x1="0" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="0.75" />
        <line x1="52" y1="12" x2="80" y2="12" stroke="currentColor" strokeWidth="0.75" />
        <circle cx="40" cy="12" r="2.5" stroke="currentColor" strokeWidth="0.75" fill="none" />
        <path
          d="M40 4 C 36 7, 36 9, 40 12 C 44 9, 44 7, 40 4 Z"
          stroke="currentColor"
          strokeWidth="0.75"
          fill="none"
        />
        <path
          d="M40 20 C 36 17, 36 15, 40 12 C 44 15, 44 17, 40 20 Z"
          stroke="currentColor"
          strokeWidth="0.75"
          fill="none"
        />
      </svg>
    </div>
  );
}
