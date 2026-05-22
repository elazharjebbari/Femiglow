/**
 * Content Studio v2 — typography.
 *
 * Default option (Editorial elegant — Option A from the plan):
 *  - Display : Recoleta (proxied via Newsreader as Google-Fonts-only fallback
 *              because next/font does not support Fontshare directly without
 *              a local woff2 copy; the production version drops Recoleta woff2
 *              into ./_assets/ to swap)
 *  - Body    : Newsreader (Google Fonts, variable)
 *  - Mono    : JetBrains Mono (Google Fonts, variable)
 *
 * Switching to Option B (Cabinet Grotesk / DM Sans) or Option C (Garet /
 * Manrope) means swapping the imports here and the CSS variable mapping
 * — the rest of the v2 codebase consumes `var(--cs-font-display)` etc.
 */
import { Newsreader, JetBrains_Mono } from 'next/font/google';

const fontDisplay = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--cs-font-display',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

const fontBody = Newsreader({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--cs-font-body',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--cs-font-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
});

export const studioV2Fonts = {
  display: fontDisplay,
  body: fontBody,
  mono: fontMono,
};
