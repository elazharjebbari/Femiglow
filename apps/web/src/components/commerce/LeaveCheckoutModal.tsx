'use client';

import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { cn } from '@/lib/utils/cn';

interface LeaveCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResumeLater: () => void;
  onQuit: () => void;
}

export function LeaveCheckoutModal({
  open,
  onOpenChange,
  onResumeLater,
  onQuit,
}: LeaveCheckoutModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => resumeRef.current?.focus());
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
      aria-describedby={descId}
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
          Quitter la commande&nbsp;?
        </Heading>
        <p id={descId} className="text-base leading-[1.7] text-encre/70">
          Vos informations peuvent être conservées le temps de votre prochaine
          visite, ou supprimées maintenant.
        </p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              onQuit();
              onOpenChange(false);
            }}
          >
            Quitter
          </Button>
          <Button
            ref={resumeRef}
            variant="primary"
            size="sm"
            type="button"
            onClick={() => {
              onResumeLater();
              onOpenChange(false);
            }}
          >
            Reprendre plus tard
          </Button>
        </div>
      </div>
    </dialog>
  );
}
