import React, { useState, useEffect } from 'react';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[230px] bg-[#1c1c1e]/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 text-neutral-100 space-y-3 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <span className="text-xs font-semibold text-neutral-200 tracking-tight">
            Clear {itemCount} {itemCount === 1 ? 'Note' : 'Notes'}?
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            type="text"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder='Type "clear"'
            autoFocus
            className="w-full bg-white/[0.07] rounded-xl px-3 py-1.5 text-xs text-white text-center placeholder:text-neutral-500 font-mono outline-none focus:ring-1 focus:ring-red-400/70"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-xs font-medium text-neutral-200 transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={!isClearTyped}
              className="py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 disabled:opacity-30 active:scale-[0.98] text-xs font-semibold text-red-400 transition-all cursor-pointer"
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
