import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'on-dark';
  asLink?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'text-2xl',
  md: 'text-3xl sm:text-4xl',
  lg: 'text-4xl sm:text-5xl',
};

export function Logo({ size = 'md', tone = 'default', asLink = true, className }: LogoProps) {
  const wordmark = (
    <span
      className={cn(
        'font-script leading-none tracking-tight',
        sizeClasses[size],
        tone === 'default' ? 'text-encre' : 'text-creme',
        className,
      )}
      aria-label="FemiGlow"
    >
      FemiGlow
    </span>
  );
  if (!asLink) return wordmark;
  return (
    <Link href="/" className="inline-flex items-center" aria-label="FemiGlow — Accueil">
      {wordmark}
    </Link>
  );
}
