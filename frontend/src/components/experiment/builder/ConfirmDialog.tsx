"use client";
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * In-page confirmation for destructive actions. When `dontAskLabel` is given, a checkbox
 * lets the user skip this confirmation in future; its value is passed to `onConfirm`.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  dontAskLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  dontAskLabel?: string;
  onConfirm: (dontAskAgain: boolean) => void;
  onCancel: () => void;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  // The safe choice gets focus (once) so an accidental Enter does not delete anything.
  useEffect(() => cancelRef.current?.focus(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-5 flex gap-3">
          <div className="w-9 h-9 shrink-0 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-2 min-w-0">
            <h2 id="confirm-title" className="font-semibold text-slate-900">
              {title}
            </h2>
            <p id="confirm-message" className="text-sm text-slate-600 break-words">
              {message}
            </p>
            {dontAskLabel && (
              <label className="flex items-center gap-2 text-sm text-slate-600 pt-1">
                <input type="checkbox" className="accent-blue-600" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
                {dontAskLabel}
              </label>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t bg-slate-50 rounded-b-xl flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="px-4 py-2 rounded-md border bg-white text-sm">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(dontAsk)} className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
