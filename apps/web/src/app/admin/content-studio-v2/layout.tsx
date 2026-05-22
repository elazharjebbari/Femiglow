import type { ReactNode } from 'react';
import { studioV2Fonts } from '@/styles/content-studio-v2/fonts';
import { ThemeProvider } from '@/components/admin/content-studio-v2/shell/ThemeProvider';
import { StudioShellProviders } from '@/components/admin/content-studio-v2/shell/StudioShellProviders';
import '@/styles/content-studio-v2/tokens.css';

/**
 * Content Studio v2 shell layout.
 *
 * The v2 module lives under /admin/content-studio-v2/* behind the
 * CONTENT_STUDIO_V2_ENABLED flag while the refactor is in progress. The
 * legacy module at /admin/content-studio remains the default until the
 * sunset phase (cf. plan-content-studio-v2-2026-05-22.md).
 */
export default function ContentStudioV2Layout({ children }: { children: ReactNode }) {
  const fontVars = `${studioV2Fonts.display.variable} ${studioV2Fonts.body.variable} ${studioV2Fonts.mono.variable}`;
  return (
    <ThemeProvider>
      <div className={`${fontVars} cs-v2-shell`} data-content-studio-version="2">
        <StudioShellProviders>
          {children}
        </StudioShellProviders>
      </div>
    </ThemeProvider>
  );
}

export const metadata = {
  title: 'Content Studio · v2',
};
