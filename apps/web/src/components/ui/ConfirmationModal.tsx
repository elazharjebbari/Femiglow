'use client';

import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';
import { Heading } from './Heading';
import { cn } from '@/lib/utils/cn';

export interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  onConfirm,
}: ConfirmationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => confirmRef.current?.focus());
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleCancel(event: Event) {
      event.preventDefault();
      onOpenChange(false);
    }
    function handleClose() {
      onOpenChange(false);
    }
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
    };
  }, [onOpenChange]);

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      onOpenChange(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={handleBackdropClick}
      className={cn(
        'w-full max-w-md rounded-none border border-encre/15 bg-creme p-0',
        'text-encre shadow-[0_24px_60px_-30px_rgba(31,29,26,0.45)]',
        'backdrop:bg-encre/40',
        'open:animate-[fade-in_180ms_ease-out]',
        'motion-reduce:open:animate-none',
      )}
    >
      <div className="space-y-4 px-8 py-8">
        <Heading as="h2" size="sm" id={titleId}>
          {title}
        </Heading>
        {description && (
          <p id={descId} className="text-base leading-[1.7] text-encre/70">
            {description}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant="primary"
            size="sm"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            type="button"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
