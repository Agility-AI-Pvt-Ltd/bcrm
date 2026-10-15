"use client";

import { useEffect, useRef } from "react";

/**
 * The one irreversible button in the product, behind a dialog that behaves like one.
 *
 * It was a bare `fixed` div: no Escape, no backdrop dismiss, and focus left
 * wherever it happened to be — so a keyboard user tabbed straight past the
 * warning into the page behind it, and could land on "Delete permanently"
 * without ever having read the paragraph above it.
 *
 * Cancel takes focus on open, which is the right default for a destructive
 * dialog: the safe choice is the one already under your finger.
 */
export default function ConfirmDeleteDialog({
  phone,
  busy,
  onCancel,
  onConfirm,
}: {
  phone: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    cancel.current?.focus();
    const previous = opener.current;
    return () => {
      // Back where they were, so dismissing does not dump focus at the top of
      // the document and make them tab through the whole page again.
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      // Keep Tab inside the dialog. Without this the next stop is the page
      // behind the overlay, which is still fully interactive.
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        // Only a press that both starts and ends on the backdrop closes it, so a
        // drag that happens to finish outside the panel does not dismiss a dialog
        // somebody is reading.
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
      >
        <h3
          id="confirm-delete-title"
          className="text-base font-semibold text-gray-800 dark:text-white/90"
        >
          Delete this customer&apos;s data?
        </h3>
        {phone ? (
          <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            {phone}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This cannot be undone. Their contact, conversation, visits and calls are
          removed. Commission registrations and billing lines are kept with their name
          and number taken out, because deleting those would change what you can claim
          and what you were charged.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancel}
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium dark:border-gray-700 dark:text-white/90"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="h-10 rounded-lg bg-error-500 px-4 text-sm font-medium text-white hover:bg-error-600 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
