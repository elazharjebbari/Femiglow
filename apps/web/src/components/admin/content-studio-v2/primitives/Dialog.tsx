'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  trigger?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 420,
  md: 540,
  lg: 720,
};

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--cs-bg-overlay)',
            zIndex: 'var(--cs-z-modal)' as unknown as number,
            animation: 'cs-fade-in 200ms var(--cs-easing)',
          }}
        />
        <RadixDialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `min(${sizeMap[size]}px, calc(100vw - 32px))`,
            maxHeight: 'calc(100vh - 64px)',
            overflowY: 'auto',
            background: 'var(--cs-bg-elevated)',
            color: 'var(--cs-fg-primary)',
            borderRadius: 'var(--cs-radius-md)',
            border: '1px solid var(--cs-border)',
            boxShadow: 'var(--cs-shadow-lg)',
            zIndex: 'var(--cs-z-modal)' as unknown as number,
            animation: 'cs-fade-in 220ms var(--cs-easing)',
          }}
        >
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--cs-border-hair)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <RadixDialog.Title
                className="cs-display"
                style={{ fontFamily: 'var(--cs-font-display)', fontSize: 'var(--cs-text-xl)', fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description
                  style={{ color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)', marginTop: 4 }}
                >
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--cs-radius-full)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--cs-fg-secondary)',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </RadixDialog.Close>
          </div>
          <div style={{ padding: '20px 24px' }}>{children}</div>
          {footer ? (
            <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--cs-border-hair)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('cs-dialog-keyframes')) {
  const style = document.createElement('style');
  style.id = 'cs-dialog-keyframes';
  style.textContent = '@keyframes cs-fade-in { from { opacity: 0; } to { opacity: 1; } }';
  document.head.appendChild(style);
}
