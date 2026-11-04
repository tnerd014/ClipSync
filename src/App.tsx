import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getDeviceInfo, 
  getStoredDeviceId, 
  playSyncChime, 
  playPingChime, 
  triggerHaptic 
} from './utils/device';
import { NoteState, ClipItem, ConnectedDevice, StickyColor } from './types';
import { AndroidApp } from './platforms/AndroidApp';
import { WindowsApp } from './platforms/WindowsApp';
import { LanDirectModal } from './components/LanDirectModal';
import { QrScannerModal } from './components/QrScannerModal';
import { PermissionsModal } from './components/PermissionsModal';
import { WifiOff, Bell, CheckCircle2, QrCode } from 'lucide-react';

export default function App() {
  const [deviceInfo] = useState(() => getDeviceInfo());
  const [deviceId] = useState(() => getStoredDeviceId());

  // Automatic platform detection: 'windows' or 'android'
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentPlatform = isMobile ? 'android' : 'windows';

  // Local Area Network (LAN) IP & Port for serverless direct Wi-Fi sync
  const [lanIp, setLanIp] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlHost = params.get('host');
      if (urlHost) return urlHost;
      const saved = localStorage.getItem('clipsync_lan_ip');
      if (saved) return saved;
      return window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
    }
    return '127.0.0.1';
  });

  const [lanPort, setLanPort] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPort = params.get('port');
      if (urlPort) return parseInt(urlPort, 10);
      const saved = localStorage.getItem('clipsync_lan_port');
      if (saved) return parseInt(saved, 10);
      if (window.location.port && window.location.port !== '3000') {
        return parseInt(window.location.port, 10);
      }
    }
    return 8432;
  });

  const [needsPairing, setNeedsPairing] = useState<boolean>(false);
  const [wsRetryTrigger, setWsRetryTrigger] = useState<number>(0);
  const [isElectron, setIsElectron] = useState(false);

  // Room / Session (clean 4-digit code)
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam && roomParam.trim()) {
        return roomParam.trim().toUpperCase();
      }
      const saved = localStorage.getItem('clipsync_room');
      if (saved && saved.trim()) return saved.trim().toUpperCase();
    }
    return 'CLIP-' + Math.floor(1000 + Math.random() * 9000);
  });

  // Note State with localStorage persistence
  const [note, setNote] = useState<NoteState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clipsync_note');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved note:', e);
        }
      }
    }
    return {
      id: 'note-1',
      content: '',
      color: 'yellow',
      fontSize: 'base',
      updatedAt: Date.now(),
      updatedBy: 'ClipSync',
    };
  });

  // History with localStorage persistence
  const [history, setHistory] = useState<ClipItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clipsync_history');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved history:', e);
        }
      }
    }
    return [];
  });

  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [remoteTypingDevice, setRemoteTypingDevice] = useState<string | null>(null);

  // Modals & UI States
  const [isConnected, setIsConnected] = useState(false);
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [soundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('clipsync_sound') !== 'false';
  });
  const [buzzNotification, setBuzzNotification] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<{ message: string; type: 'info' | 'success' } | null>(null);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const textDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>(note.content);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' = 'info') => {
    setStatusToast({ message, type });
    setTimeout(() => {
      setStatusToast((prev) => (prev?.message === message ? null : prev));
    }, 2500);
  }, []);

  // Persist note changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('clipsync_note', JSON.stringify(note));
    } catch (e) {
      console.error(e);
    }
  }, [note]);

  // Persist history changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('clipsync_history', JSON.stringify(history));
    } catch (e) {
      console.error(e);
    }
  }, [history]);

  // Check if running in native Electron
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.isElectron) {
      setIsElectron(true);
      electronAPI.getLocalInfo().then((info: any) => {
        if (info?.ip && info.ip !== '127.0.0.1') {
          setLanIp(info.ip);
          localStorage.setItem('clipsync_lan_ip', info.ip);
        }
      }).catch(console.error);

      const unsubMsg = electronAPI.onLanMessage((data: any) => {
        if (data.type === 'text:update') {
          setNote((prev) => ({
            ...prev,
            content: data.content,
            updatedAt: Date.now(),
            updatedBy: data.deviceName || 'Android',
          }));
          playSyncChime(soundEnabled);
          triggerHaptic();
        } else if (data.type === 'ping:notify') {
          playPingChime(soundEnabled);
          setBuzzNotification('Connected phone buzzed!');
          setTimeout(() => setBuzzNotification(null), 3000);
        }
      });

      return () => {
        if (unsubMsg) unsubMsg();
      };
    }
  }, [soundEnabled]);

  // Connect to WebSocket with dynamic LAN target host resolution
  useEffect(() => {
    let isMounted = true;

    function connectWs() {
      // Determine target IP & Port
      const params = new URLSearchParams(window.location.search);
      const paramHost = params.get('host');
      const paramPort = params.get('port');
      const storedIp = localStorage.getItem('clipsync_lan_ip');
      const storedPort = localStorage.getItem('clipsync_lan_port');

      let targetHost = paramHost || storedIp || lanIp;
      let targetPort = paramPort ? parseInt(paramPort, 10) : (storedPort ? parseInt(storedPort, 10) : lanPort);

      const isCapacitor = typeof window !== 'undefined' && Boolean((window as any).Capacitor);
      const isMobileLocal = (isCapacitor || isMobile) && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      // If mobile on localhost with no valid remote PC IP, ask user to pair
      if (isMobileLocal && (!storedIp || storedIp === 'localhost' || storedIp === '127.0.0.1')) {
        setNeedsPairing(true);
        setIsConnected(false);
        return;
      }
      setNeedsPairing(false);

      let wsUrl = '';
      if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        // Running inside browser connected to PC IP or cloud preview
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}`;
      } else {
        // Explicit LAN Host & Port
        const hostToUse = (targetHost && targetHost !== '127.0.0.1' && targetHost !== 'localhost') ? targetHost : '127.0.0.1';
        wsUrl = `ws://${hostToUse}:${targetPort}`;
      }

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          setNeedsPairing(false);
          ws.send(
            JSON.stringify({
              type: 'join',
              sessionId,
              deviceId,
              deviceName: deviceInfo.name,
              deviceType: currentPlatform === 'android' ? 'mobile' : 'desktop',
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'sync') {
              if (msg.note && msg.note.content) {
                setNote(msg.note);
                lastSavedContentRef.current = msg.note.content;
              }
              if (msg.history && Array.isArray(msg.history) && msg.history.length > 0) {
                setHistory(msg.history);
              }
              if (msg.clients) setConnectedDevices(msg.clients);
            } else if (msg.type === 'text:update') {
              setNote((prev) => ({
                ...prev,
                content: msg.content,
                updatedAt: msg.updatedAt || Date.now(),
                updatedBy: msg.updatedBy || 'Remote Device',
              }));

              lastSavedContentRef.current = msg.content;
              setRemoteTypingDevice(msg.updatedBy || 'Remote Device');
              if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
              typingTimerRef.current = setTimeout(() => setRemoteTypingDevice(null), 1200);

              playSyncChime(soundEnabled);
              triggerHaptic();
            } else if (msg.type === 'style:update') {
              setNote((prev) => ({
                ...prev,
                color: msg.color || prev.color,
                fontSize: msg.fontSize || prev.fontSize,
                updatedAt: msg.updatedAt || Date.now(),
              }));
            } else if (msg.type === 'history:update') {
              if (msg.history) setHistory(msg.history);
            } else if (msg.type === 'history:add') {
              if (msg.clip) {
                setHistory((prev) => [msg.clip, ...prev.filter(c => c.id !== msg.clip.id)].slice(0, 50));
              }
            } else if (msg.type === 'presence') {
              if (msg.clients) setConnectedDevices(msg.clients);
            } else if (msg.type === 'ping:notify') {
              playPingChime(soundEnabled);
              triggerHaptic();
              setBuzzNotification('Remote device buzzed!');
              setTimeout(() => setBuzzNotification(null), 3000);
            }
          } catch (err) {
            console.error('Error handling WS message:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWs();
          }, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        console.error('WS Connection initialization error:', e);
      }
    }

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [sessionId, deviceId, deviceInfo.name, currentPlatform, soundEnabled, wsRetryTrigger, lanIp, lanPort, isMobile]);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Live Instant Typing Sync (50ms debounce) + Auto-Save History (3s idle)
  const handleTextChange = (newContent: string) => {
    setNote((prev) => ({
      ...prev,
      content: newContent,
      updatedAt: Date.now(),
      updatedBy: deviceInfo.name,
    }));

    const payload = {
      type: 'text:update',
      content: newContent,
      deviceId,
      deviceName: deviceInfo.name,
      updatedAt: Date.now(),
    };

    if ((window as any).electronAPI?.broadcast) {
      (window as any).electronAPI.broadcast(payload);
    }

    // 1. Instant keystroke broadcast (50ms debounce for ultra-responsive live sync)
    if (textDebounceRef.current) clearTimeout(textDebounceRef.current);
    textDebounceRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    }, 50);

    // 2. Automatic history snapshot saved after typing pause (3 seconds)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const trimmed = newContent.trim();
      if (trimmed.length > 0 && trimmed !== lastSavedContentRef.current.trim()) {
        lastSavedContentRef.current = trimmed;
        const newClip: ClipItem = {
          id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          content: trimmed,
          timestamp: Date.now(),
          device: deviceInfo.name,
          deviceType: currentPlatform === 'android' ? 'mobile' : 'desktop',
        };

        setHistory((prev) => {
          const next = [newClip, ...prev.filter((c) => c.content !== trimmed)].slice(0, 50);
          return next;
        });

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'history:add',
              clip: newClip,
            })
          );
        }
      }
    }, 3000);
  };

  const handleColorChange = (newColor: StickyColor) => {
    setNote((prev) => ({ ...prev, color: newColor }));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'style:update',
          color: newColor,
        })
      );
    }
  };

  const handleFontSizeChange = (newSize: 'sm' | 'base' | 'lg') => {
    setNote((prev) => ({ ...prev, fontSize: newSize }));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'style:update',
          fontSize: newSize,
        })
      );
    }
  };

  // Explicit Save to History (manual bookmark or trigger)
  const handleSaveToHistory = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    lastSavedContentRef.current = trimmed;

    const newClip: ClipItem = {
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: trimmed,
      timestamp: Date.now(),
      device: deviceInfo.name,
      deviceType: currentPlatform === 'android' ? 'mobile' : 'desktop',
    };

    setHistory((prev) => [newClip, ...prev.filter((c) => c.content !== trimmed)].slice(0, 50));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'history:add',
          clip: newClip,
        })
      );
    }
    showToast('Saved to history', 'success');
  };

  const handleRestoreClip = (content: string) => {
    handleTextChange(content);
    showToast('Note restored', 'success');
  };

  const handleDeleteClip = (clipId: string) => {
    setHistory((prev) => prev.filter((c) => c.id !== clipId));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'clip:delete',
          clipId,
        })
      );
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'clip:clear_history',
        })
      );
    }
    showToast('History cleared', 'info');
  };

  const handleBuzzDevices = () => {
    const payload = {
      type: 'ping:buzz',
      deviceName: deviceInfo.name,
    };
    if ((window as any).electronAPI?.broadcast) {
      (window as any).electronAPI.broadcast(payload);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
    playPingChime(soundEnabled);
    showToast('Buzzed connected devices!', 'success');
  };

  const handleNewNote = () => {
    // If current note has content, ensure it's preserved in history first
    if (note.content.trim()) {
      handleSaveToHistory(note.content);
    }
    handleTextChange('');
    showToast('New blank note ready', 'success');
  };

  // Called when Android phone camera scans the PC QR code or manual IP entry
  const handleQrScanSuccess = (scannedText: string) => {
    try {
      triggerHaptic();
      playSyncChime(soundEnabled);

      if (scannedText.startsWith('http://') || scannedText.startsWith('https://') || scannedText.startsWith('ws://')) {
        const url = new URL(scannedText);
        const roomParam = url.searchParams.get('room');
        const hostParam = url.searchParams.get('host') || url.hostname;
        const portParam = url.searchParams.get('port') || url.port;

        if (roomParam) {
          setSessionId(roomParam.toUpperCase());
          localStorage.setItem('clipsync_room', roomParam.toUpperCase());
        }
        if (hostParam && hostParam !== 'localhost') {
          setLanIp(hostParam);
          localStorage.setItem('clipsync_lan_ip', hostParam);
        }
        if (portParam) {
          const p = parseInt(portParam, 10);
          setLanPort(p);
          localStorage.setItem('clipsync_lan_port', p.toString());
        }
      } else if (scannedText.includes(':')) {
        const [ip, portStr] = scannedText.split(':');
        if (ip) {
          setLanIp(ip.trim());
          localStorage.setItem('clipsync_lan_ip', ip.trim());
        }
        if (portStr) {
          const p = parseInt(portStr.trim(), 10);
          if (!isNaN(p)) {
            setLanPort(p);
            localStorage.setItem('clipsync_lan_port', p.toString());
          }
        }
      } else {
        setSessionId(scannedText.toUpperCase());
        localStorage.setItem('clipsync_room', scannedText.toUpperCase());
      }

      setNeedsPairing(false);
      setWsRetryTrigger((prev) => prev + 1);
      showToast('Connecting to PC...', 'success');
    } catch (e) {
      console.error(e);
      showToast('Pairing info saved', 'success');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col font-sans select-none bg-[#1c1815] text-neutral-100">
      {/* Needs Pairing Alert on Mobile */}
      {needsPairing && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-3 py-1 bg-amber-600/95 hover:bg-amber-500 border border-amber-400/80 text-amber-50 text-xs font-medium rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-md active:scale-95 transition-all"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Ready to Pair: Tap to Scan PC</span>
          </button>
        </div>
      )}

      {/* Offline Alert (When not paired or disconnected) */}
      {!isConnected && !needsPairing && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="px-3 py-1 bg-red-950/90 border border-red-700/80 text-red-200 text-xs rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-md">
            <WifiOff className="w-3 h-3" />
            <span>LAN: Connecting...</span>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {statusToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2">
          <div className="px-3.5 py-1.5 bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-full shadow-xl flex items-center gap-2 backdrop-blur-md">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{statusToast.message}</span>
          </div>
        </div>
      )}

      {/* Buzz Alert */}
      {buzzNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="px-4 py-1.5 bg-amber-400 text-neutral-950 text-xs font-bold rounded-full shadow-xl flex items-center gap-2 backdrop-blur-md animate-bounce">
            <Bell className="w-3.5 h-3.5 fill-neutral-950" />
            <span>{buzzNotification}</span>
          </div>
        </div>
      )}

      {/* Desktop App (Windows Notepad / Legal Pad) */}
      {currentPlatform === 'windows' ? (
        <WindowsApp
          note={note}
          sessionId={sessionId}
          connectedDevices={connectedDevices}
          history={history}
          lanIp={lanIp}
          lanPort={lanPort}
          onTextChange={handleTextChange}
          onColorChange={handleColorChange}
          onFontSizeChange={handleFontSizeChange}
          onSaveToHistory={handleSaveToHistory}
          onRestoreClip={handleRestoreClip}
          onDeleteClip={handleDeleteClip}
          onClearHistory={handleClearHistory}
          onBuzzDevices={handleBuzzDevices}
          onOpenLanModal={() => setIsLanModalOpen(true)}
          onNewNote={handleNewNote}
          remoteTypingDevice={remoteTypingDevice}
        />
      ) : (
        /* Android App (Mobile Notepad / Legal Pad) */
        <AndroidApp
          note={note}
          sessionId={sessionId}
          connectedDevices={connectedDevices}
          history={history}
          onTextChange={handleTextChange}
          onColorChange={handleColorChange}
          onSaveToHistory={handleSaveToHistory}
          onRestoreClip={handleRestoreClip}
          onDeleteClip={handleDeleteClip}
          onClearHistory={handleClearHistory}
          onBuzzDevices={handleBuzzDevices}
          onOpenScanner={() => setIsScannerOpen(true)}
          onNewNote={handleNewNote}
          onOpenPermissions={() => setIsPermissionsOpen(true)}
          remoteTypingDevice={remoteTypingDevice}
        />
      )}

      {/* Desktop: Displays the pairing QR code for the phone to scan */}
      <LanDirectModal
        isOpen={isLanModalOpen}
        onClose={() => setIsLanModalOpen(false)}
        lanIp={lanIp}
        lanPort={lanPort}
        sessionId={sessionId}
        isElectron={isElectron}
        connectedClients={connectedDevices.length}
      />

      {/* Android: Camera scanner that scans the PC QR code */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleQrScanSuccess}
        onManualConnect={handleQrScanSuccess}
      />

      {/* Android: Permissions Checklist Modal */}
      <PermissionsModal
        isOpen={isPermissionsOpen}
        onClose={() => setIsPermissionsOpen(false)}
      />
    </div>
  );
}
