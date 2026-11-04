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
import { PinModal } from './components/PinModal';
import { TroubleshootModal } from './components/TroubleshootModal';
import { WifiOff, Bell, CheckCircle2, QrCode, Lock, ShieldAlert } from 'lucide-react';

// Safe localStorage wrapper to prevent QuotaExceededError in mobile webviews
function safeStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      console.warn('[ClipSync] LocalStorage quota exceeded, clearing older history clips...');
      try {
        const hist = localStorage.getItem('clipsync_history');
        if (hist) {
          const parsed = JSON.parse(hist);
          if (Array.isArray(parsed) && parsed.length > 5) {
            localStorage.setItem('clipsync_history', JSON.stringify(parsed.slice(0, 5)));
          }
        }
        localStorage.setItem(key, value);
      } catch {
        // Ignore fallback errors
      }
    }
  }
}

export default function App() {
  const [deviceInfo] = useState(() => getDeviceInfo());
  const [deviceId] = useState(() => getStoredDeviceId());

  // Strict, permanent platform separation:
  // 1. Electron .exe app is 100% desktop view ('windows') ALWAYS. Resizing sticky note never flips to mobile!
  // 2. Android APK (Capacitor or native Android UA) is 100% mobile view ('android') ALWAYS. Never switches to windows!
  // 3. Web browser preview allows explicit override with ?platform=windows or ?platform=android, defaulting by device UA / screen width.
  const [currentPlatform] = useState<'windows' | 'android'>(() => {
    if (typeof window === 'undefined') return 'windows';

    const params = new URLSearchParams(window.location.search);
    const platformParam = params.get('platform')?.toLowerCase();
    if (platformParam === 'windows' || platformParam === 'desktop') return 'windows';
    if (platformParam === 'android' || platformParam === 'mobile') return 'android';

    // Electron check (window.electronAPI or userAgent)
    const isElectronEnv = Boolean((window as any).electronAPI) || /Electron/i.test(navigator.userAgent);
    if (isElectronEnv) return 'windows';

    // Native Android / Capacitor check
    const isCapacitor = Boolean((window as any).Capacitor?.isNativePlatform?.() || (window as any).Capacitor);
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isCapacitor || isAndroid) return 'android';

    // Standard web browser fallback
    return /iPhone|iPad|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768 ? 'android' : 'windows';
  });

  const isMobile = currentPlatform === 'android';

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

  // Pairing Security PIN (4-digit numeric code to protect against rogue LAN devices)
  const [pin, setPin] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get('pin');
      if (urlPin) {
        safeStorageSet('clipsync_pin', urlPin.trim());
        return urlPin.trim();
      }
      const saved = localStorage.getItem('clipsync_pin');
      if (saved) return saved;
    }
    return '4819';
  });

  const [allIps, setAllIps] = useState<Array<{ name: string; ip: string }>>([]);
  const [needsPairing, setNeedsPairing] = useState<boolean>(false);
  const [wsRetryTrigger, setWsRetryTrigger] = useState<number>(0);
  const [isElectron, setIsElectron] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).electronAPI) || /Electron/i.test(navigator.userAgent);
  });

  // Room / Session (clean 4-digit code)
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam && roomParam.trim()) {
        const r = roomParam.trim().toUpperCase();
        safeStorageSet('clipsync_room', r);
        return r;
      }
      const saved = localStorage.getItem('clipsync_room');
      if (saved && saved.trim()) return saved.trim().toUpperCase();
      const generated = 'CLIP-' + Math.floor(1000 + Math.random() * 9000);
      safeStorageSet('clipsync_room', generated);
      return generated;
    }
    return 'CLIP-' + Math.floor(1000 + Math.random() * 9000);
  });

  // Note State with localStorage persistence & versioning
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
      rev: 1,
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
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState<string | null>(null);
  const [isTroubleshootOpen, setIsTroubleshootOpen] = useState(false);

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
  const lastPongRef = useRef<number>(Date.now());
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' = 'info') => {
    setStatusToast({ message, type });
    setTimeout(() => {
      setStatusToast((prev) => (prev?.message === message ? null : prev));
    }, 2500);
  }, []);

  // Persist note changes safely
  useEffect(() => {
    safeStorageSet('clipsync_note', JSON.stringify(note));
  }, [note]);

  // Persist history changes safely
  useEffect(() => {
    safeStorageSet('clipsync_history', JSON.stringify(history));
  }, [history]);

  // Check if running in native Electron & subscribe to LAN events
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.isElectron) {
      setIsElectron(true);

      electronAPI.getLocalInfo().then((info: any) => {
        if (info?.allIps && Array.isArray(info.allIps)) {
          setAllIps(info.allIps);
        }
        if (info?.ip && info.ip !== '127.0.0.1') {
          setLanIp(info.ip);
          safeStorageSet('clipsync_lan_ip', info.ip);
        }
        if (info?.port) {
          setLanPort(info.port);
          safeStorageSet('clipsync_lan_port', String(info.port));
        }
        if (info?.pin) {
          setPin(info.pin);
          safeStorageSet('clipsync_pin', info.pin);
        }
      }).catch(console.error);

      // Listen for dynamic port failover from Electron host
      const unsubPort = electronAPI.onPortUpdated?.((newPort: number) => {
        setLanPort(newPort);
        safeStorageSet('clipsync_lan_port', String(newPort));
      });

      // Listen for PIN changes
      const unsubPin = electronAPI.onPinUpdated?.((newPin: string) => {
        setPin(newPin);
        safeStorageSet('clipsync_pin', newPin);
      });

      // Listen for phone / client handshake connection
      const unsubConnected = electronAPI.onClientConnected?.((client: any) => {
        playSyncChime(soundEnabled);
        showToast(`Phone Connected: ${client.deviceName || 'Mobile Phone'}`, 'success');
        triggerHaptic();
      });

      const unsubCount = electronAPI.onClientCount?.((count: number) => {
        if (typeof count === 'number') {
          // Keep count synced
        }
      });

      const unsubMsg = electronAPI.onLanMessage((data: any) => {
        if (data.type === 'text:update') {
          // Echo suppression: ignore if from our own device
          if (data.senderDeviceId && data.senderDeviceId === deviceId) return;

          setNote((prev) => {
            if (data.rev && prev.rev && data.rev < prev.rev) {
              return prev; // reject stale packet
            }
            return {
              ...prev,
              content: data.content,
              rev: data.rev || (prev.rev || 0) + 1,
              updatedAt: Date.now(),
              updatedBy: data.deviceName || 'Android',
            };
          });
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
        if (unsubConnected) unsubConnected();
        if (unsubCount) unsubCount();
        if (unsubPort) unsubPort();
        if (unsubPin) unsubPin();
      };
    }
  }, [soundEnabled, showToast, deviceId]);

  // Android App Lifecycle: Reconnect immediately when resuming from screen lock or background Doze mode
  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('[ClipSync] App resumed from background, re-establishing LAN socket...');
          setWsRetryTrigger((prev) => prev + 1);
        }
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, []);

  // Connect to WebSocket with dynamic LAN target host resolution & heartbeat
  useEffect(() => {
    let isMounted = true;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    function connectWs() {
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
      if (isElectron) {
        // Desktop Electron connects directly to its own embedded server on loopback
        wsUrl = `ws://127.0.0.1:${targetPort || 8432}`;
      } else if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        // Running inside browser connected to PC IP or cloud preview
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}`;
      } else {
        // Explicit LAN Host & Port (e.g. Android phone connecting to PC)
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
          setPinErrorMessage(null);
          lastPongRef.current = Date.now();

          // Send join payload with security PIN
          ws.send(
            JSON.stringify({
              type: 'join',
              sessionId,
              pin,
              deviceId,
              deviceName: deviceInfo.name,
              deviceType: currentPlatform === 'android' ? 'mobile' : 'desktop',
              isDesktop: currentPlatform === 'windows',
            })
          );

          // 10-Second Keep-Alive Heartbeat for half-open socket detection
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
              // Check if server pong is late by more than 25 seconds
              if (Date.now() - lastPongRef.current > 25000) {
                console.warn('[ClipSync] Heartbeat pong timed out, reconnecting...');
                ws.close();
              }
            }
          }, 10000);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            // Heartbeat Pong
            if (msg.type === 'pong') {
              lastPongRef.current = Date.now();
              return;
            }

            // PIN Security Authentication Error
            if (msg.type === 'auth:error') {
              setPinErrorMessage(msg.message || 'Incorrect pairing PIN. Please enter the PIN shown on your PC.');
              setIsPinModalOpen(true);
              setIsConnected(false);
              return;
            }

            if (msg.type === 'sync') {
              if (msg.pin) {
                setPin(msg.pin);
                safeStorageSet('clipsync_pin', msg.pin);
              }
              if (msg.note && msg.note.content) {
                setNote(msg.note);
                lastSavedContentRef.current = msg.note.content;
              }
              if (msg.history && Array.isArray(msg.history) && msg.history.length > 0) {
                setHistory(msg.history);
              }
              if (msg.clients) setConnectedDevices(msg.clients);
              if (currentPlatform === 'android' && (!connectedDevices || connectedDevices.length === 0)) {
                showToast('Handshake Connected to PC!', 'success');
              }
            } else if (msg.type === 'pin:updated') {
              if (msg.pin) {
                setPin(msg.pin);
                safeStorageSet('clipsync_pin', msg.pin);
                showToast(`Pairing PIN updated: ${msg.pin}`, 'info');
              }
            } else if (msg.type === 'text:update') {
              // Echo suppression: ignore if from our own device
              if (msg.senderDeviceId && msg.senderDeviceId === deviceId) return;

              // Stale packet rejection: ignore if incoming revision is older than local
              setNote((prev) => {
                if (msg.rev && prev.rev && msg.rev < prev.rev) {
                  return prev;
                }
                return {
                  ...prev,
                  content: msg.content,
                  rev: msg.rev || (prev.rev || 0) + 1,
                  updatedAt: msg.updatedAt || Date.now(),
                  updatedBy: msg.updatedBy || 'Remote Device',
                };
              });

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
              if (msg.event === 'joined' && msg.deviceName && msg.deviceName !== deviceInfo.name) {
                playSyncChime(soundEnabled);
                showToast(`Handshake: ${msg.deviceName} connected`, 'success');
                triggerHaptic();
              }
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
          if (heartbeatInterval) clearInterval(heartbeatInterval);
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
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [sessionId, deviceId, deviceInfo.name, currentPlatform, soundEnabled, wsRetryTrigger, lanIp, lanPort, isMobile, pin]);

  // Live Instant Typing Sync with monotonic revision bump
  const handleTextChange = (newContent: string) => {
    const nextRev = (note.rev || 0) + 1;

    setNote((prev) => ({
      ...prev,
      content: newContent,
      rev: nextRev,
      updatedAt: Date.now(),
      updatedBy: deviceInfo.name,
    }));

    const payload = {
      type: 'text:update',
      sessionId,
      content: newContent,
      rev: nextRev,
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
              sessionId,
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
          sessionId,
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
          sessionId,
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
          sessionId,
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
          sessionId,
          clipId,
        })
      );
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    safeStorageSet('clipsync_history', JSON.stringify([]));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'history:update',
          sessionId,
          history: [],
        })
      );
    }
    showToast('History cleared', 'info');
  };

  const handleBuzzDevices = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'ping:buzz',
          sessionId,
          deviceName: deviceInfo.name,
        })
      );
      showToast('Buzzed connected devices!', 'info');
      triggerHaptic();
    }
  };

  const handleNewNote = () => {
    const freshNote: NoteState = {
      id: `note-${Date.now()}`,
      content: '',
      color: 'yellow',
      fontSize: 'base',
      updatedAt: Date.now(),
      updatedBy: deviceInfo.name,
      rev: (note.rev || 0) + 1,
    };
    setNote(freshNote);
    lastSavedContentRef.current = '';

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'text:update',
          sessionId,
          content: '',
          rev: freshNote.rev,
          deviceId,
          deviceName: deviceInfo.name,
        })
      );
    }
    showToast('New note ready', 'info');
  };

  // PIN Management
  const handlePinSubmit = (enteredPin: string) => {
    const clean = enteredPin.trim();
    setPin(clean);
    safeStorageSet('clipsync_pin', clean);
    setIsPinModalOpen(false);
    setPinErrorMessage(null);
    setWsRetryTrigger((prev) => prev + 1);
    showToast('Pairing with PIN...', 'info');
  };

  const handleRegeneratePin = async () => {
    if ((window as any).electronAPI?.regeneratePin) {
      const newPin = await (window as any).electronAPI.regeneratePin();
      if (newPin) {
        setPin(newPin);
        safeStorageSet('clipsync_pin', newPin);
        showToast(`New PIN: ${newPin}`, 'success');
      }
    } else {
      const newPin = String(Math.floor(1000 + Math.random() * 9000));
      setPin(newPin);
      safeStorageSet('clipsync_pin', newPin);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'pin:update', sessionId, pin: newPin }));
      }
      showToast(`New PIN: ${newPin}`, 'success');
    }
  };

  // Parse QR / Manual Connect String (extracts IP, port, room, and PIN)
  const handleQrScanSuccess = (scannedText: string) => {
    try {
      if (scannedText.startsWith('http://') || scannedText.startsWith('https://')) {
        const url = new URL(scannedText);
        const host = url.searchParams.get('host') || url.hostname;
        const port = url.searchParams.get('port') || url.port;
        const room = url.searchParams.get('room');
        const scannedPin = url.searchParams.get('pin');

        if (host) {
          setLanIp(host);
          safeStorageSet('clipsync_lan_ip', host);
        }
        if (port) {
          const p = parseInt(port, 10);
          setLanPort(p);
          safeStorageSet('clipsync_lan_port', p.toString());
        }
        if (room) {
          setSessionId(room.toUpperCase());
          safeStorageSet('clipsync_room', room.toUpperCase());
        }
        if (scannedPin) {
          setPin(scannedPin.trim());
          safeStorageSet('clipsync_pin', scannedPin.trim());
        }
      } else if (scannedText.includes(':')) {
        const [ip, portStr] = scannedText.split(':');
        if (ip) {
          setLanIp(ip.trim());
          safeStorageSet('clipsync_lan_ip', ip.trim());
        }
        if (portStr) {
          const p = parseInt(portStr.trim(), 10);
          if (!isNaN(p)) {
            setLanPort(p);
            safeStorageSet('clipsync_lan_port', p.toString());
          }
        }
      } else {
        setSessionId(scannedText.toUpperCase());
        safeStorageSet('clipsync_room', scannedText.toUpperCase());
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
            className="px-3 py-1 bg-amber-600/95 hover:bg-amber-500 border border-amber-400/80 text-amber-50 text-xs font-medium rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-md active:scale-95 transition-all cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Ready to Pair: Tap to Scan PC</span>
          </button>
        </div>
      )}

      {/* Offline Alert: Clickable to diagnose */}
      {!isConnected && !needsPairing && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => setIsTroubleshootOpen(true)}
            className="px-3 py-1 bg-red-950/90 hover:bg-red-900 border border-red-700/80 text-red-200 text-xs rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-md active:scale-95 transition-all cursor-pointer"
            title="Click to run network diagnostics & firewall checks"
          >
            <WifiOff className="w-3 h-3 text-red-400" />
            <span>LAN Connecting... (Tap to Troubleshoot)</span>
          </button>
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
          pin={pin}
          onTextChange={handleTextChange}
          onColorChange={handleColorChange}
          onFontSizeChange={handleFontSizeChange}
          onSaveToHistory={handleSaveToHistory}
          onRestoreClip={handleRestoreClip}
          onDeleteClip={handleDeleteClip}
          onClearHistory={handleClearHistory}
          onBuzzDevices={handleBuzzDevices}
          onOpenLanModal={() => setIsLanModalOpen(true)}
          onOpenTroubleshoot={() => setIsTroubleshootOpen(true)}
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
          pin={pin}
          onTextChange={handleTextChange}
          onColorChange={handleColorChange}
          onSaveToHistory={handleSaveToHistory}
          onRestoreClip={handleRestoreClip}
          onDeleteClip={handleDeleteClip}
          onClearHistory={handleClearHistory}
          onBuzzDevices={handleBuzzDevices}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenPinModal={() => setIsPinModalOpen(true)}
          onOpenTroubleshoot={() => setIsTroubleshootOpen(true)}
          onNewNote={handleNewNote}
          onOpenPermissions={() => setIsPermissionsOpen(true)}
          remoteTypingDevice={remoteTypingDevice}
        />
      )}

      {/* Desktop: Displays the pairing QR code and Security PIN for the phone to scan */}
      <LanDirectModal
        isOpen={isLanModalOpen}
        onClose={() => setIsLanModalOpen(false)}
        lanIp={lanIp}
        lanPort={lanPort}
        pin={pin}
        sessionId={sessionId}
        isElectron={isElectron}
        allIps={allIps}
        onSelectIp={(ip) => {
          setLanIp(ip);
          safeStorageSet('clipsync_lan_ip', ip);
          setWsRetryTrigger((prev) => prev + 1);
          showToast(`PC IP switched to ${ip}`, 'info');
        }}
        onRegeneratePin={handleRegeneratePin}
        onOpenTroubleshoot={() => setIsTroubleshootOpen(true)}
        connectedClients={connectedDevices.length}
      />

      {/* Android: Camera scanner that scans the PC QR code */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleQrScanSuccess}
        onManualConnect={handleQrScanSuccess}
      />

      {/* Security Pairing PIN Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSubmitPin={handlePinSubmit}
        errorMessage={pinErrorMessage}
        targetDeviceName="Windows PC"
      />

      {/* Wi-Fi & LAN Network Diagnostics Modal */}
      <TroubleshootModal
        isOpen={isTroubleshootOpen}
        onClose={() => setIsTroubleshootOpen(false)}
        lanIp={lanIp}
        lanPort={lanPort}
        pin={pin}
        onUpdateTarget={(newIp, newPort, newPin) => {
          setLanIp(newIp);
          safeStorageSet('clipsync_lan_ip', newIp);
          setLanPort(newPort);
          safeStorageSet('clipsync_lan_port', String(newPort));
          if (newPin) {
            setPin(newPin);
            safeStorageSet('clipsync_pin', newPin);
          }
          setWsRetryTrigger((prev) => prev + 1);
          showToast('Network settings updated', 'success');
        }}
      />

      {/* Android: Permissions Checklist Modal */}
      <PermissionsModal
        isOpen={isPermissionsOpen}
        onClose={() => setIsPermissionsOpen(false)}
      />
    </div>
  );
}
