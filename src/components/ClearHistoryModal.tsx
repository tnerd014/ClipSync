import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ClearHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemCount: number;
}

export const ClearHistoryModal: React.FC<ClearHistoryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');

  // Reset input when opening/closing
  useEffect(() => {
    if (isOpen) {
      setConfirmationInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isClearTyped = confirmationInput.trim().toLowerCase() === 'clear';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isClearTyped) {
      onConfirm();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm bg-[#220d05] border-2 border-[#542713] rounded-2xl shadow-2xl overflow-hidden p-5 flex flex-col gap-4 text-[#faf5ee] animate-in zoom-in-95 duration-200 select-none">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-wide">
                Clear All History?
              </h3>
              <p className="text-[11px] text-amber-200/70">
                {itemCount} {itemCount === 1 ? 'note' : 'notes'} will be deleted
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning text */}
        <p className="text-xs text-[#d1bfae] leading-relaxed">
          This will permanently delete all saved notes and clips across all your connected devices. This action <span className="text-red-400 font-semibold underline">cannot</span> be undone.
        </p>

        {/* Input prompt form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#ead9c9]">
              Type <span className="font-mono font-bold text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800/80">clear</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="type clear"
              autoFocus
              className="w-full bg-[#150702] border border-[#5a2a16] focus:border-red-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#6e5142] font-mono outline-none shadow-inner"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#d6c3b2] hover:bg-white/5 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isClearTyped}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                isClearTyped
                  ? 'bg-red-700 hover:bg-red-600 active:scale-95 text-white cursor-pointer'
                  : 'bg-red-950/40 text-red-300/40 border border-red-900/30 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Everything</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
