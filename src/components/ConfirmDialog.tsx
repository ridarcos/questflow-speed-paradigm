"use client";

import { useEffect, useId, useRef } from "react";
import { buttonClass, Spinner } from "./ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo modal accesible basado en <dialog> nativo: showModal() aporta el foco
 * atrapado, Escape para cerrar y el fondo inerte. El foco inicial va a "Cancelar".
 * Comprueba dialog.open antes de showModal(): en StrictMode el efecto corre dos veces.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  pendingLabel = "Eliminando…",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-desc`}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-container border border-ink/10 bg-surface p-6 text-ink backdrop:bg-ink/40"
    >
      <h2 id={`${id}-title`} className="font-display text-title font-bold tracking-tight">
        {title}
      </h2>
      <p id={`${id}-desc`} className="mt-2 text-body text-ink-soft wrap-anywhere">
        {message}
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button ref={cancelRef} type="button" onClick={onCancel} disabled={pending} className={buttonClass("secondary")}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          aria-busy={pending || undefined}
          className={buttonClass("danger")}
        >
          {pending && <Spinner className="size-4" />}
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
