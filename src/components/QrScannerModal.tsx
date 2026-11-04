import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { triggerHaptic } from '../utils/device';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedData: string) => void;
  onManualConnect: (ipOrRoom: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onManualConnect,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-camera-reader';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setScannerError(null);
    setScannedResult(null);

    const timer = setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 170, height: 170 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!isMounted) return;
            triggerHaptic();
            setScannedResult(decodedText);

            scanner
              .stop()
              .catch(console.error)
              .finally(() => {
                onScanSuccess(decodedText);
                onClose();
              });
          },
          () => {}
        );
      } catch {
        if (!isMounted) return;
        setScannerError('Camera unavailable');
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(console.error);
        }
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScanSuccess, onClose]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onManualConnect(manualInput.trim());
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[240px] bg-[#1c1c1e]/95 backdrop-blur-xl rounded-2xl shadow-2xl p-3.5 text-neutral-100 space-y-2.5 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <span className="text-xs font-semibold text-neutral-200 tracking-tight">
            Scan QR
          </span>
        </div>

        {!scannerError ? (
          <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden flex items-center justify-center">
            <div id={containerId} className="w-full h-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-36 h-36 border border-emerald-400/70 rounded-xl" />
            </div>
            {scannedResult && (
              <div className="absolute inset-0 bg-neutral-950/90 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-amber-300/90 text-center py-2">{scannerError}</p>
        )}

        <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="PC IP..."
            className="flex-1 min-w-0 px-2.5 py-1.5 bg-white/[0.07] text-xs text-white rounded-xl font-mono outline-none placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="p-1.5 bg-white/15 hover:bg-white/25 disabled:opacity-30 text-white rounded-xl transition-all cursor-pointer shrink-0"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-xs font-medium text-neutral-200 transition-all cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
