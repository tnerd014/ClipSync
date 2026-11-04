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
import { WifiOff, Bell, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [deviceInfo, setDeviceInfo] = useState(() => getDeviceInfo());
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
      const saved = localStorage.getItem('clipsync_lan_ip');
      if (saved) return saved;
      return window.location.hostname === 'localhost' ? '192.168.1.100' : window.location.hostname;
    }
    return '192.168.1.100';
  });
  const [lanPort] = useState<number>(8432);
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

  // Note State
  const [note, setNote] = useState<NoteState>({
    id: 'note-1',
    content: '',
    color: 'yellow',
    fontSize: 'base',
    updatedAt: Date.now(),
    updatedBy: 'ClipSync',
  });

  // History & Connected Devices
  const [history, setHistory] = useState<ClipItem[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [remoteTypingDevice, setRemoteTypingDevice] = useState<string | null>(null);

  // Modals: Desktop shows QR Modal, Android shows Camera Scanner
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
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' = 'info') => {
    setStatusToast({ message, type });
    setTimeout(() => {
      setStatusToast((prev) => (prev?.message === message ? null : prev));
    }, 2500);
  }, []);

  // Check if running in native Electron
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.isElectron) {
      setIsElectron(true);
      electronAPI.getLocalInfo().then((info: any) => {
        if (info?.ip) setLanIp(info.ip);
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

  // Connect to WebSocket
  useEffect(() => {
    let isMounted = true;

    function connectWs() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
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
            if (msg.note) setNote(msg.note);
            if (msg.history) setHistory(msg.history);
            if (msg.clients) setConnectedDevices(msg.clients);
          } else if (msg.type === 'text:update') {
            setNote((prev) => ({
              ...prev,
              content: msg.content,
              updatedAt: msg.updatedAt || Date.now(),
              updatedBy: msg.updatedBy || 'Remote Device',
            }));

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
          } else if (msg.type === 'presence') {
            if (msg.clients) setConnectedDevices(msg.clients);
          } else if (msg.type === 'ping:notify') {
            playPingChime(soundEnabled);
            triggerHaptic();
            setBuzzNotification('Buzzed!');
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
        }, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [sessionId, deviceId, deviceInfo.name, currentPlatform, soundEnabled]);

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
    };

    if ((window as any).electronAPI?.broadcast) {
      (window as any).electronAPI.broadcast(payload);
    }

    if (textDebounceRef.current) clearTimeout(textDebounceRef.current);
    textDebounceRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    }, 120);
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

  const handleSaveToHistory = (content: string) => {
    if (!content.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'clip:save',
          content,
          deviceName: deviceInfo.name,
          deviceType: currentPlatform === 'android' ? 'mobile' : 'desktop',
        })
      );
      showToast('Saved to history', 'success');
    }
  };

  const handleRestoreClip = (content: string) => {
    handleTextChange(content);
    showToast('Restored', 'success');
  };

  const handleDeleteClip = (clipId: string) => {
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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'clip:clear_history',
        })
      );
    }
  };

  const handleBuzzDevices = () => {
    const payload = {
      type: 'ping:notify',
      deviceName: deviceInfo.name,
    };
    if ((window as any).electronAPI?.broadcast) {
      (window as any).electronAPI.broadcast(payload);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
    playPingChime(soundEnabled);
    showToast('Buzzed!', 'success');
  };

  const handleNewNote = () => {
    if (note.content.trim()) {
      handleSaveToHistory(note.content);
    }
    handleTextChange('');
    showToast('New blank note ready', 'success');
  };

  // Called when Android phone camera scans the PC QR code
  const handleQrScanSuccess = (scannedText: string) => {
    try {
      triggerHaptic();
      playSyncChime(soundEnabled);

      if (scannedText.startsWith('http') || scannedText.startsWith('ws')) {
        const url = new URL(scannedText);
        const roomParam = url.searchParams.get('room');
        if (roomParam) {
          setSessionId(roomParam.toUpperCase());
          localStorage.setItem('clipsync_room', roomParam.toUpperCase());
        }
        if (url.hostname && url.hostname !== 'localhost') {
          setLanIp(url.hostname);
          localStorage.setItem('clipsync_lan_ip', url.hostname);
        }
      } else if (scannedText.includes(':')) {
        const [ip] = scannedText.split(':');
        setLanIp(ip);
        localStorage.setItem('clipsync_lan_ip', ip);
      } else {
        setSessionId(scannedText.toUpperCase());
        localStorage.setItem('clipsync_room', scannedText.toUpperCase());
      }

      showToast('Connected to PC!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Connected!', 'success');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col font-sans select-none bg-neutral-950 text-neutral-100">
      {/* Offline Alert */}
      {!isConnected && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="px-3 py-1 bg-red-950/90 border border-red-700/80 text-red-200 text-xs rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-md">
            <WifiOff className="w-3 h-3" />
            <span>Connecting...</span>
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

      {/* Desktop App (PC shows QR code) */}
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
        /* Android App (Phone opens camera to scan PC QR code) */
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
