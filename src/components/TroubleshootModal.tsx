import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface TroubleshootModalProps {
  isOpen: boolean;
  onClose: () => void;
  lanIp: string;
  lanPort: number;
  pin: string;
  onUpdateTarget?: (ip: string, port: number, pin: string) => void;
}

export const TroubleshootModal: React.FC<TroubleshootModalProps> = ({
  isOpen,
  onClose,
  lanIp,
  lanPort,
  pin,
  onUpdateTarget,
}) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [editIp, setEditIp] = useState(lanIp);
  const [editPort, setEditPort] = useState(String(lanPort));
  const [editPin, setEditPin] = useState(pin);

  if (!isOpen) return null;

  const runNetworkDiagnostic = async () => {
    setTestStatus('testing');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`http://${editIp}:${editPort}/api/health`, {
        mode: 'cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setTestStatus(res.ok ? 'success' : 'failed');
    } catch {
      setTestStatus('failed');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateTarget) {
      onUpdateTarget(editIp.trim(), parseInt(editPort.trim(), 10) || 8432, editPin.trim());
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
            Connection
          </span>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <input
              type="text"
              value={editIp}
              onChange={(e) => setEditIp(e.target.value)}
              placeholder="PC IP"
              className="col-span-2 px-2.5 py-1.5 bg-white/[0.07] rounded-xl font-mono text-[11px] text-white outline-none"
            />
            <input
              type="text"
              value={editPort}
              onChange={(e) => setEditPort(e.target.value)}
              placeholder="8432"
              className="col-span-1 px-2 py-1.5 bg-white/[0.07] rounded-xl font-mono text-[11px] text-white text-center outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              maxLength={4}
              value={editPin}
              onChange={(e) => setEditPin(e.target.value)}
              placeholder="PIN"
              className="w-20 px-2 py-1.5 bg-white/[0.07] rounded-xl font-mono text-[11px] text-amber-300 font-bold tracking-widest text-center outline-none"
            />
            <button
              type="button"
              onClick={runNetworkDiagnostic}
              disabled={testStatus === 'testing'}
              className="flex-1 py-1.5 bg-white/[0.07] hover:bg-white/15 active:scale-[0.98] text-neutral-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1 cursor-pointer transition-all"
            >
              <RefreshCw className={`w-3 h-3 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
              <span>Ping</span>
            </button>
          </div>

          {testStatus === 'success' && (
            <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Reachable</span>
            </div>
          )}
          {testStatus === 'failed' && (
            <div className="flex items-center justify-center gap-1 text-[10px] text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Blocked by Firewall or Wi-Fi</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-xs font-medium text-neutral-200 transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              className="py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-[0.98] text-xs font-medium text-white transition-all cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
