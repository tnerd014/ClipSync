import React, { useState } from 'react';
import { 
  X, 
  Wifi, 
  ShieldAlert, 
  HelpCircle, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Radio, 
  Lock, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';

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
  const [testMessage, setTestMessage] = useState<string>('');
  const [editIp, setEditIp] = useState(lanIp);
  const [editPort, setEditPort] = useState(String(lanPort));
  const [editPin, setEditPin] = useState(pin);
  const [activeTab, setActiveTab] = useState<'test' | 'firewall' | 'router'>('test');

  if (!isOpen) return null;

  const runNetworkDiagnostic = async () => {
    setTestStatus('testing');
    setTestMessage(`Pinging http://${editIp}:${editPort}/api/health ...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`http://${editIp}:${editPort}/api/health`, {
        mode: 'cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestStatus('success');
        setTestMessage(`Reachable! PC responded in real-time. Port ${editPort} is open.`);
      } else {
        setTestStatus('failed');
        setTestMessage(`Received HTTP status ${res.status}. Port is open but returned error.`);
      }
    } catch (err: any) {
      setTestStatus('failed');
      if (err.name === 'AbortError') {
        setTestMessage(`Timed out after 3.5s. Port ${editPort} is blocked by Windows Firewall or router AP Isolation.`);
      } else {
        setTestMessage(`Failed to reach ${editIp}:${editPort}. Check if PC and phone are on the exact same Wi-Fi.`);
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl p-5 text-neutral-100 space-y-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Wi-Fi & LAN Diagnostics</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-neutral-950 p-1 border border-neutral-800 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('test')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'test' ? 'bg-neutral-800 text-amber-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Ping Test
          </button>
          <button
            onClick={() => setActiveTab('firewall')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'firewall' ? 'bg-neutral-800 text-amber-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Firewall Help
          </button>
          <button
            onClick={() => setActiveTab('router')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'router' ? 'bg-neutral-800 text-amber-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Wi-Fi Router
          </button>
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-3 text-xs">
          {activeTab === 'test' && (
            <div className="space-y-3">
              {/* Target info and live probe */}
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Target PC Host:</span>
                  <span className="font-mono text-neutral-200">{editIp}:{editPort}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Pairing Security PIN:</span>
                  <span className="font-mono text-amber-400 font-bold tracking-widest">{editPin || 'None'}</span>
                </div>

                <button
                  type="button"
                  onClick={runNetworkDiagnostic}
                  disabled={testStatus === 'testing'}
                  className="w-full mt-2 py-2 bg-neutral-800 hover:bg-neutral-700 active:scale-98 text-amber-300 font-semibold rounded-xl border border-neutral-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                  <span>{testStatus === 'testing' ? 'Testing Connection...' : 'Test PC Connection Now'}</span>
                </button>
              </div>

              {/* Probe result */}
              {testStatus !== 'idle' && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  testStatus === 'testing' 
                    ? 'bg-neutral-800/50 border-neutral-700 text-neutral-300' 
                    : testStatus === 'success' 
                    ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-200' 
                    : 'bg-red-950/60 border-red-800/80 text-red-200'
                }`}>
                  {testStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-amber-400 mt-0.5" />}
                  {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                  {testStatus === 'failed' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[11px] uppercase tracking-wider">
                      {testStatus === 'success' ? 'Connection Verified' : testStatus === 'failed' ? 'Connection Blocked' : 'Running Probe'}
                    </p>
                    <p className="text-xs opacity-90 leading-relaxed">{testMessage}</p>
                  </div>
                </div>
              )}

              {/* Quick edit form */}
              <form onSubmit={handleSaveSettings} className="space-y-2 pt-2 border-t border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium block">Update IP, Port, or PIN:</span>
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="text"
                    value={editIp}
                    onChange={(e) => setEditIp(e.target.value)}
                    placeholder="192.168.x.x"
                    className="col-span-3 px-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg font-mono text-xs text-neutral-200 outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={editPort}
                    onChange={(e) => setEditPort(e.target.value)}
                    placeholder="8432"
                    className="col-span-2 px-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg font-mono text-xs text-neutral-200 outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
                    <input
                      type="text"
                      maxLength={8}
                      value={editPin}
                      onChange={(e) => setEditPin(e.target.value)}
                      placeholder="Security PIN (e.g. 4819)"
                      className="w-full pl-8 pr-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg font-mono text-xs text-neutral-200 outline-none focus:border-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs cursor-pointer transition-colors shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'firewall' && (
            <div className="space-y-3 text-neutral-300 leading-relaxed">
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold">
                  <Flame className="w-4 h-4" />
                  <span>Windows Defender Firewall</span>
                </div>
                <p>When Windows prompts you on first run, it asks to allow network access. If missed:</p>
                <ol className="list-decimal list-inside space-y-1 text-neutral-400 pl-1">
                  <li>Press <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-[10px] text-amber-300">Win + S</kbd> and type <strong>Windows Firewall</strong>.</li>
                  <li>Click <strong>"Allow an app through Windows Firewall"</strong>.</li>
                  <li>Click <strong>"Change settings"</strong>, scroll down to <strong>ClipSync</strong>.</li>
                  <li>Check both <strong>Private</strong> and <strong>Public</strong> boxes.</li>
                </ol>
              </div>

              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-1.5">
                <span className="font-semibold text-neutral-200 block">Windows Network Profile (Private vs Public):</span>
                <p className="text-neutral-400">
                  Ensure your Windows Wi-Fi is set to <strong>"Private network"</strong> (Settings &rarr; Network & Internet &rarr; Wi-Fi &rarr; Properties). If set to "Public network", Windows blocks all local devices.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'router' && (
            <div className="space-y-3 text-neutral-300 leading-relaxed">
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <Radio className="w-4 h-4" />
                  <span>Router "AP Isolation" / Guest Network</span>
                </div>
                <p>
                  Many routers and guest networks feature <strong>Client Isolation</strong> (or <strong>AP Isolation</strong>). This prevents Wi-Fi devices from sending data to other devices on the same Wi-Fi.
                </p>
                <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
                  <span className="text-amber-300 font-semibold block">⚡ 10-Second Test:</span>
                  <p className="text-neutral-400">
                    Turn on your phone's <strong>Personal Hotspot</strong> and connect your PC to it. If ClipSync immediately connects, your router has AP Isolation enabled.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-1.5">
                <span className="font-semibold text-neutral-200 block">VPN & Virtual Adapters:</span>
                <p className="text-neutral-400">
                  If running NordVPN, Tailscale, or WSL on your PC, make sure local LAN traffic is allowed in your VPN settings.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-neutral-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
