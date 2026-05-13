'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

interface PendingConfirm {
  props: Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel'>;
  resolve: (value: boolean) => void;
}

/**
 * Hook ergonomique : `const confirm = useConfirm(); const ok = await confirm({...});`
 * Retourne un composant à monter dans le tree (juste un seul ConfirmDialog rendu).
 */
export function useConfirm(): {
  confirm: (props: Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel'>) => Promise<boolean>;
  ConfirmHost: () => ReactNode;
} {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (props: Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel'>) => {
      return new Promise<boolean>((resolve) => {
        setPending({ props, resolve });
      });
    },
    [],
  );

  const ConfirmHost = useCallback(() => {
    if (!pending) return null;
    return (
      <ConfirmDialog
        {...pending.props}
        open={true}
        onConfirm={() => {
          pending.resolve(true);
          setPending(null);
        }}
        onCancel={() => {
          pending.resolve(false);
          setPending(null);
        }}
      />
    );
  }, [pending]);

  return { confirm, ConfirmHost };
}
