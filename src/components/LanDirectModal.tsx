import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, RefreshCw, ArrowRight } from 'lucide-react';

interface LanDirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  lanIp: string;
  lanPort: number;
  pin?: string;
  sessionId?: string;
  allIps?: Array<{ name: string; ip: string }>;
  onSelectIp?: (ip: string) => void;
  onUpdateLanTarget?: (target: string) => void;
  onRegeneratePin?: () => void;
  onOpenTroubleshoot?: () => void;
  isElectron: boolean;
  connectedClients: number;
}

export const LanDirectModal: React.FC<LanDirectModalProps> = ({
  isOpen,
  onClose,
  lanIp,
  lanPort,
  pin = '4819',
  sessionId = 'DEFAULT',
  allIps,
  onSelectIp,
  onUpdateLanTarget,
  onRegeneratePin,
  onOpenTroubleshoot,
  connectedClients,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  const hostToUse =
    lanIp && lanIp !== '127.0.0.1' && lanIp !== 'localhost'
      ? lanIp
      : typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? window.location.hostname
      : '127.0.0.1';
  const portToUse = lanPort || 8432;
  const displayAddress = `${hostToUse}:${portToUse}`;

  const qrAddress = `http://${hostToUse}:${portToUse}/?room=${encodeURIComponent(
    sessionId
  )}&host=${encodeURIComponent(hostToUse)}&port=${portToUse}&pin=${encodeURIComponent(pin)}`;

  useEffect(() => {
    if (isOpen && qrAddress) {
      QRCode.toDataURL(qrAddress, {
        width: 160,
        margin: 1,
        color: {
          dark: '#0a0a0a',
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
      await navigator.clipboard.writeText(displayAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateLanTarget && targetInput.trim()) {
      onUpdateLanTarget(targetInput.trim());
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[235px] bg-[#1c1c1e]/95 backdrop-blur-xl rounded-2xl shadow-2xl p-3.5 text-neutral-100 space-y-2.5 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Center Title */}
        <div className="flex items-center justify-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              connectedClients > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-semibold text-neutral-200 tracking-tight">
            {connectedClients > 0 ? `${connectedClients} Synced` : 'Wi-Fi Sync'}
          </span>
        </div>

        {/* Compact QR Square */}
        <div className="flex items-center justify-center p-2 bg-white rounded-xl mx-auto w-32 h-32">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain" />
          ) : (
            <div className="text-neutral-400 text-[10px]">...</div>
          )}
        </div>

        {/* Compact SwiftUI-style PIN Row */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.07] rounded-xl">
          <span className="text-[11px] text-neutral-400 font-medium">PIN</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-[0.2em] text-amber-300">
              {pin}
            </span>
            {onRegeneratePin && (
              <button
                type="button"
                onClick={onRegeneratePin}
                title="New PIN"
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Adapter Selector (Only if multiple exist) */}
        {allIps && allIps.length > 1 && onSelectIp && (
          <select
            value={hostToUse}
            onChange={(e) => onSelectIp(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white/[0.07] rounded-xl text-[11px] font-mono text-neutral-200 outline-none cursor-pointer"
          >
            {allIps.map((adapter) => (
              <option key={adapter.ip} value={adapter.ip} className="bg-neutral-900">
                {adapter.name ? `${adapter.name}: ` : ''}
                {adapter.ip}
              </option>
            ))}
          </select>
        )}

        {/* Compact IP Row */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.07] rounded-xl">
          <span className="text-[11px] font-mono text-neutral-300 truncate select-all">
            {displayAddress}
          </span>
          <button
            onClick={handleCopy}
            className="text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-1.5"
            title="Copy IP"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Manual IP Input (if applicable) */}
        {onUpdateLanTarget && (
          <form onSubmit={handleConnect} className="flex items-center gap-1.5">
            <input
              type="text"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="PC IP..."
              className="flex-1 min-w-0 px-2.5 py-1 bg-white/[0.07] text-[11px] text-white rounded-xl font-mono outline-none placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={!targetInput.trim()}
              className="p-1.5 bg-white/15 hover:bg-white/25 disabled:opacity-30 text-white rounded-xl transition-all cursor-pointer shrink-0"
            >
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        )}

        {/* Bottom SwiftUI Action Buttons: Setup + Close */}
        <div className={`grid gap-2 pt-0.5 ${onOpenTroubleshoot ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {onOpenTroubleshoot && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTroubleshoot();
              }}
              className="py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/15 active:scale-[0.98] text-xs font-medium text-neutral-300 transition-all cursor-pointer"
            >
              Setup
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-xs font-medium text-neutral-200 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
