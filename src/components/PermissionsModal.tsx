import React, { useState, useEffect } from 'react';
import { Camera, Bell, Clipboard, Wifi, Check } from 'lucide-react';
import { triggerHaptic } from '../utils/device';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [cameraStatus, setCameraStatus] = useState<'granted' | 'prompt' | 'denied'>('prompt');
  const [notificationStatus, setNotificationStatus] = useState<'granted' | 'prompt' | 'denied'>('prompt');
  const [clipboardStatus, setClipboardStatus] = useState<'granted' | 'prompt' | 'denied'>('granted');
  const [networkStatus, setNetworkStatus] = useState<'granted' | 'prompt'>('granted');

  const checkPermissions = async () => {
    if (navigator.permissions?.query) {
      try {
        const camQuery = await navigator.permissions.query({ name: 'camera' as any });
        setCameraStatus(camQuery.state as any);
        camQuery.onchange = () => setCameraStatus(camQuery.state as any);
      } catch {}
    }

    if ('Notification' in window) {
      setNotificationStatus(
        Notification.permission === 'granted'
          ? 'granted'
          : Notification.permission === 'denied'
          ? 'denied'
          : 'prompt'
      );
    }

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
      setClipboardStatus('granted');
    }
  };

  if (!isOpen) return null;

  const items = [
    { id: 'camera', name: 'Camera', icon: Camera, status: cameraStatus, action: requestCamera },
    { id: 'clipboard', name: 'Clipboard', icon: Clipboard, status: clipboardStatus, action: testClipboard },
    { id: 'notification', name: 'Alerts', icon: Bell, status: notificationStatus, action: requestNotification },
    { id: 'network', name: 'Wi-Fi', icon: Wifi, status: networkStatus, action: () => {} },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-sm animate-in fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[230px] bg-[#1c1c1e]/95 backdrop-blur-xl rounded-2xl shadow-2xl p-3.5 text-neutral-100 space-y-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <span className="text-xs font-semibold text-neutral-200 tracking-tight">
            Permissions
          </span>
        </div>

        <div className="space-y-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isGranted = item.status === 'granted';
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-1.5 bg-white/[0.07] rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-xs text-neutral-200">{item.name}</span>
                </div>
                {isGranted ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <button
                    onClick={item.action}
                    className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-neutral-950 text-[10px] font-semibold cursor-pointer"
                  >
                    Allow
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-xs font-medium text-neutral-200 transition-all cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
