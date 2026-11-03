import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Wifi, ArrowRight } from 'lucide-react';

interface LanDirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  lanIp: string;
  lanPort: number;
  onUpdateLanTarget?: (target: string) => void;
  isElectron: boolean;
  connectedClients: number;
}

export const LanDirectModal: React.FC<LanDirectModalProps> = ({
  isOpen,
  onClose,
  lanIp,
  lanPort,
  onUpdateLanTarget,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  // Short display address
  const displayAddress = lanIp.includes('://') ? lanIp : `${lanIp}:${lanPort}`;
  const qrAddress = typeof window !== 'undefined'
    ? (lanIp.startsWith('http') || lanIp.startsWith('ws')
        ? lanIp
        : `${window.location.protocol}//${window.location.host}`)
    : '';

  useEffect(() => {
    if (isOpen && qrAddress) {
      QRCode.toDataURL(qrAddress, {
        width: 200,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [isOpen, qrAddress]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrAddress || displayAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateLanTarget && targetInput.trim()) {
      onUpdateLanTarget(targetInput.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div 
        className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-5 text-neutral-100 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold">Wi-Fi Sync</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Pairing QR" className="w-40 h-40 object-contain rounded" />
          ) : (
            <div className="w-40 h-40 flex items-center justify-center text-neutral-400 text-xs">
              Loading QR...
            </div>
          )}
          <span className="text-[11px] font-medium text-neutral-700 mt-1">Scan to connect phone</span>
        </div>

        {/* Address */}
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs font-mono text-neutral-200 truncate select-all">
            {displayAddress}
          </div>
          <button
            onClick={handleCopy}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-200 transition-colors cursor-pointer shrink-0"
            title="Copy address"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Manual Target IP (Optional) */}
        {onUpdateLanTarget && (
          <form onSubmit={handleConnect} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="Or enter PC IP..."
              className="flex-1 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 rounded-lg font-mono outline-none focus:border-amber-400 placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={!targetInput.trim()}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1"
            >
              <span>Join</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
