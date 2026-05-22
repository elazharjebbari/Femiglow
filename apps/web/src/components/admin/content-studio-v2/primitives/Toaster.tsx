'use client';

import { Toaster as SonnerToaster } from 'sonner';

/**
 * Sonner toaster, themed with v2 CSS variables.
 *
 * Drop once in the v2 layout so any descendant can call
 * `import { toast } from 'sonner'; toast.success('Saved')`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors={false}
      closeButton
      toastOptions={{
        style: {
          background: 'var(--cs-bg-elevated)',
          color: 'var(--cs-fg-primary)',
          border: '1px solid var(--cs-border)',
          borderRadius: 'var(--cs-radius-md)',
          fontFamily: 'var(--cs-font-body)',
          fontSize: 'var(--cs-text-sm)',
          boxShadow: 'var(--cs-shadow-md)',
        },
        classNames: {
          success: 'cs-toast-success',
          error: 'cs-toast-error',
          warning: 'cs-toast-warning',
        },
      }}
    />
  );
}
