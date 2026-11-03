import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const [showManual, setShowManual] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-camera-reader';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setScannerError(null);
    setScannedResult(null);

    // Give DOM a frame to render the container
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
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!isMounted) return;
            triggerHaptic();
            setScannedResult(decodedText);

            // Stop camera immediately on scan
            scanner.stop().catch(console.error).finally(() => {
              onScanSuccess(decodedText);
              onClose();
            });
          },
          () => {
            // Frame error (no QR detected yet) - ignore
          }
        );
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Camera QR error:', err);
        setScannerError(err?.message || 'Could not access camera. Please allow camera permissions or enter PC IP manually.');
        setShowManual(true);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl p-5 text-neutral-100 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with native back navigation */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <button
            onClick={onClose}
            className="p-1 -ml-1 text-neutral-400 hover:text-neutral-100 rounded-full transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold">Scan PC Screen</h3>
          </div>
          <div className="w-5" />
        </div>

        {/* Camera Viewfinder */}
        {!showManual && (
          <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-800">
            <div id={containerId} className="w-full h-full object-cover"></div>

            {/* Scanning Target Overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                {/* Laser animation */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute top-0 animate-pulse"></div>
              </div>
            </div>

            {scannedResult && (
              <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center gap-2 text-emerald-400 animate-in fade-in">
                <CheckCircle2 className="w-10 h-10" />
                <span className="text-xs font-bold text-neutral-200">Connected!</span>
              </div>
            )}
          </div>
        )}

        {/* Helper instruction */}
        {!showManual && (
          <p className="text-center text-xs text-neutral-400">
            Point your camera at the QR code on your PC screen
          </p>
        )}

        {/* Camera permission error */}
        {scannerError && (
          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{scannerError}</span>
          </div>
        )}

        {/* Manual Input Fallback */}
        <div className="pt-1 border-t border-neutral-800">
          {!showManual ? (
            <button
              onClick={() => setShowManual(true)}
              className="w-full py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors text-center cursor-pointer"
            >
              Or enter PC IP address manually
            </button>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <span className="text-xs text-neutral-400 block">Enter PC address or room code:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. 192.168.1.50 or CLIP-1234"
                  className="flex-1 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 rounded-lg font-mono outline-none focus:border-amber-400"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span>Connect</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors pt-1"
              >
                ← Back to camera scanner
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
