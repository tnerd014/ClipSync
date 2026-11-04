import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Bell, 
  Clipboard, 
  Wifi, 
  Vibrate, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { triggerHaptic } from '../utils/device';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PermissionItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: 'granted' | 'prompt' | 'denied' | 'unsupported';
  required: boolean;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [cameraStatus, setCameraStatus] = useState<'granted' | 'prompt' | 'denied'>('prompt');
  const [notificationStatus, setNotificationStatus] = useState<'granted' | 'prompt' | 'denied'>('prompt');
  const [clipboardStatus, setClipboardStatus] = useState<'granted' | 'prompt' | 'denied'>('prompt');
  const [vibrationStatus, setVibrationStatus] = useState<'granted' | 'unsupported'>('granted');
  const [networkStatus, setNetworkStatus] = useState<'granted' | 'prompt'>('granted');
  const [isRequesting, setIsRequesting] = useState(false);

  // Check current permission statuses
  const checkPermissions = async () => {
    // 1. Check Camera
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const camQuery = await navigator.permissions.query({ name: 'camera' as any });
        setCameraStatus(camQuery.state as any);
        camQuery.onchange = () => setCameraStatus(camQuery.state as any);
      } catch {
        // Fallback
      }
    }

    // 2. Check Notifications
    if ('Notification' in window) {
      setNotificationStatus(
        Notification.permission === 'granted'
          ? 'granted'
          : Notification.permission === 'denied'
          ? 'denied'
          : 'prompt'
      );
    }

    // 3. Check Clipboard
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const clipQuery = await navigator.permissions.query({ name: 'clipboard-read' as any });
        setClipboardStatus(clipQuery.state as any);
        clipQuery.onchange = () => setClipboardStatus(clipQuery.state as any);
      } catch {
        setClipboardStatus('granted');
      }
    } else {
      setClipboardStatus('granted');
    }

    // 4. Vibration
    if ('vibrate' in navigator) {
      setVibrationStatus('granted');
    } else {
      setVibrationStatus('unsupported');
    }

    // 5. Network / LAN
    if (navigator.onLine) {
      setNetworkStatus('granted');
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkPermissions();
    }
  }, [isOpen]);

  const requestCamera = async () => {
    triggerHaptic();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      // Stop tracks immediately after granting
      stream.getTracks().forEach((track) => track.stop());
      setCameraStatus('granted');
    } catch {
      setCameraStatus('denied');
    }
  };

  const requestNotification = async () => {
    triggerHaptic();
    if ('Notification' in window) {
      try {
        const result = await Notification.requestPermission();
        setNotificationStatus(
          result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt'
        );
      } catch {
        setNotificationStatus('denied');
      }
    }
  };

  const testClipboard = async () => {
    triggerHaptic();
    try {
      await navigator.clipboard.readText();
      setClipboardStatus('granted');
    } catch {
      try {
        await navigator.clipboard.writeText('');
        setClipboardStatus('granted');
      } catch {
        setClipboardStatus('prompt');
      }
    }
  };

  const testVibration = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 150]);
      setVibrationStatus('granted');
    }
  };

  const requestAll = async () => {
    setIsRequesting(true);
    triggerHaptic();

    if (cameraStatus !== 'granted') {
      await requestCamera();
    }
    if (notificationStatus !== 'granted') {
      await requestNotification();
    }
    if (clipboardStatus !== 'granted') {
      await testClipboard();
    }
    testVibration();

    setIsRequesting(false);
  };

  if (!isOpen) return null;

  const permissions: PermissionItem[] = [
    {
      id: 'camera',
      name: 'Camera Viewfinder',
      description: 'Scans your PC monitor QR code for 1-second instant pairing',
      icon: Camera,
      status: cameraStatus,
      required: true,
    },
    {
      id: 'clipboard',
      name: 'Clipboard Access',
      description: 'Syncs and restores your notes and text clippings seamlessly',
      icon: Clipboard,
      status: clipboardStatus,
      required: true,
    },
    {
      id: 'notification',
      name: 'Sync Notifications',
      description: 'Alerts you when devices connect or when your PC buzzes your phone',
      icon: Bell,
      status: notificationStatus,
      required: false,
    },
    {
      id: 'network',
      name: 'Local Wi-Fi Network',
      description: 'Connects directly to your PC over home/office Wi-Fi (100% private)',
      icon: Wifi,
      status: networkStatus,
      required: true,
    },
    {
      id: 'vibrate',
      name: 'Haptic Vibrations',
      description: 'Tactile pulses when notes sync, buttons click, and QR codes pair',
      icon: Vibrate,
      status: vibrationStatus,
      required: false,
    },
  ];

  const grantedCount = permissions.filter((p) => p.status === 'granted').length;
  const allGranted = grantedCount === permissions.length;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end animate-in fade-in select-none"
      onClick={onClose}
    >
      <div 
        className="bg-neutral-900 border-t border-neutral-800 rounded-t-3xl p-5 text-neutral-100 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Android Material 3 Drag Handle (Tap to dismiss) */}
        <div 
          onClick={onClose}
          className="w-12 h-1.5 bg-neutral-600/80 active:bg-neutral-500 rounded-full mx-auto -mt-1 mb-3 cursor-pointer"
          title="Dismiss"
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">Android Permissions Checklist</h3>
              <p className="text-[11px] text-neutral-400">Everything ClipSync needs to run natively</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-mono font-bold">
            <span className={allGranted ? 'text-emerald-400' : 'text-amber-400'}>{grantedCount}</span>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-400">{permissions.length}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-800 h-1.5 rounded-full my-3 overflow-hidden shrink-0">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${(grantedCount / permissions.length) * 100}%` }}
          />
        </div>

        {/* Checklist Items */}
        <div className="flex-1 overflow-y-auto space-y-2 py-1">
          {permissions.map((item) => {
            const Icon = item.icon;
            const isGranted = item.status === 'granted';
            const isDenied = item.status === 'denied';

            return (
              <div 
                key={item.id}
                className="p-3 bg-neutral-800/70 border border-neutral-750 rounded-2xl flex items-center justify-between gap-3 transition-colors hover:bg-neutral-800"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    isGranted 
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-neutral-700/60 text-neutral-300 border border-neutral-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-neutral-200">{item.name}</span>
                      {item.required && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-medium">Required</span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-tight mt-0.5 truncate">{item.description}</p>
                  </div>
                </div>

                {/* Status / Action Button */}
                <div className="shrink-0">
                  {isGranted ? (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Allowed</span>
                    </div>
                  ) : isDenied ? (
                    <button
                      onClick={() => {
                        if (item.id === 'camera') requestCamera();
                        if (item.id === 'notification') requestNotification();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium active:scale-95 cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Denied (Tap)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (item.id === 'camera') requestCamera();
                        if (item.id === 'notification') requestNotification();
                        if (item.id === 'clipboard') testClipboard();
                        if (item.id === 'vibrate') testVibration();
                      }}
                      className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400 text-neutral-950 text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-xs"
                    >
                      <span>Grant</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-3 shrink-0 mt-2">
          {!allGranted ? (
            <button
              onClick={requestAll}
              disabled={isRequesting}
              className="flex-1 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              <span>Grant All Permissions</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>All Permissions Granted - Ready</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium active:scale-95 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
