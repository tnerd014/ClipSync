import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
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

    // Auto-submit immediately when 4th digit is entered
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[240px] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl p-4 text-neutral-100 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-300 tracking-wide">Enter PC PIN</span>
          <button
            onClick={onClose}
            className="p-1 -mr-1 text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Clean 4-Digit Input Row */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
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
                className={`w-11 h-12 bg-neutral-950 border text-center font-mono text-lg font-semibold rounded-xl outline-none transition-colors ${
                  errorMessage
                    ? 'border-red-500/70 text-red-300 focus:border-red-400'
                    : digit
                    ? 'border-amber-400/80 text-amber-300'
                    : 'border-neutral-800 text-neutral-100 focus:border-neutral-500'
                }`}
              />
            ))}
          </div>

          {errorMessage && (
            <p className="text-[11px] text-red-400 text-center">
              Incorrect PIN
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
