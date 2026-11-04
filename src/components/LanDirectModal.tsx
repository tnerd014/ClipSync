import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Wifi, ArrowRight, Lock, RefreshCw, HelpCircle } from 'lucide-react';

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
  const [copiedPin, setCopiedPin] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  // Clean host resolution: ensure mobile gets real Wi-Fi IP and port
  const hostToUse = lanIp && lanIp !== '127.0.0.1' && lanIp !== 'localhost'
    ? lanIp
    : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? window.location.hostname : '127.0.0.1');
  const portToUse = lanPort || 8432;

  // Short display address
  const displayAddress = `${hostToUse}:${portToUse}`;
  
  // Full URL for mobile camera scanning: embeds room, host, port, and security PIN for instant auto-pairing!
  const qrAddress = `http://${hostToUse}:${portToUse}/?room=${encodeURIComponent(sessionId)}&host=${encodeURIComponent(hostToUse)}&port=${portToUse}&pin=${encodeURIComponent(pin)}`;

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
          <span className="text-[11px] font-medium text-neutral-700 mt-1">Scan with phone camera or app</span>
        </div>

        {/* Live Handshake Status */}
        {connectedClients > 0 ? (
          <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-emerald-950/70 border border-emerald-700/80 rounded-xl text-emerald-300 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">Handshake Active: {connectedClients} phone(s) synced</span>
          </div>
        ) : (
          <div className="text-center text-[11px] text-neutral-400">
            Waiting for phone to scan QR code...
          </div>
        )}

        {/* Security Pairing PIN Card */}
        <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-neutral-300">Pairing Security PIN:</span>
            </div>
            {onRegeneratePin && (
              <button
                type="button"
                onClick={onRegeneratePin}
                className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="Generate new PIN"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>New PIN</span>
              </button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="font-mono text-xl tracking-[0.25em] font-bold text-amber-400 pl-1">
              {pin}
            </div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(pin).catch(() => {});
                setCopiedPin(true);
                setTimeout(() => setCopiedPin(false), 1500);
              }}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-[11px] text-neutral-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              {copiedPin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-[10px] text-neutral-500 leading-tight">
            Other PCs on your Wi-Fi cannot see or connect to your notes without this PIN.
          </p>
        </div>

        {/* Adapter Switcher (If multiple network interfaces exist) */}
        {allIps && allIps.length > 1 && onSelectIp && (
          <div className="space-y-1 pt-1">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Select PC Network Adapter:</span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {allIps.map((adapter) => {
                const isSelected = adapter.ip === hostToUse;
                return (
                  <button
                    key={adapter.ip}
                    type="button"
                    onClick={() => onSelectIp(adapter.ip)}
                    className={`px-2 py-1 text-[11px] rounded font-mono transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold'
                        : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700'
                    }`}
                  >
                    {adapter.name ? `${adapter.name}: ` : ''}{adapter.ip}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Troubleshoot / Diagnostics button */}
        {onOpenTroubleshoot && (
          <div className="pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTroubleshoot();
              }}
              className="w-full py-2 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Firewall & Wi-Fi Diagnostics</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
