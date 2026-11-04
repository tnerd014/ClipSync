import React, { useState, useRef, useEffect } from 'react';
import { triggerHaptic } from '../utils/device';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitPin: (pin: string) => void;
  errorMessage?: string | null;
  targetDeviceName?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onSubmitPin,
  errorMessage,
}) => {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = clean;
    setDigits(nextDigits);

    if (clean && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (clean && index === 3 && nextDigits.every((d) => d.length === 1)) {
      triggerHaptic();
      onSubmitPin(nextDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length > 0) {
      const nextDigits = ['', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        nextDigits[i] = pasted[i];
      }
      setDigits(nextDigits);
      if (pasted.length === 4) {
        triggerHaptic();
        onSubmitPin(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = digits.join('');
    if (pin.length === 4) {
      triggerHaptic();
      onSubmitPin(pin);
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
            Enter PIN
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex justify-between gap-2" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-11 bg-white/[0.07] text-center font-mono text-base font-semibold rounded-xl outline-none transition-all ${
                  errorMessage
                    ? 'ring-1 ring-red-500/80 text-red-400'
                    : digit
                    ? 'ring-1 ring-amber-400/80 text-amber-300'
                    : 'text-white focus:ring-1 focus:ring-white/30'
                }`}
              />
            ))}
          </div>

          {errorMessage && (
            <p className="text-[11px] text-red-400 text-center leading-none">
              Incorrect PIN
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-xs font-medium text-neutral-200 transition-all cursor-pointer"
          >
            Close
          </button>
        </form>
      </div>
    </div>
  );
};
