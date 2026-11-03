import { ColorScheme, StickyColor } from '../types';

export function getDeviceInfo(): { name: string; type: 'desktop' | 'mobile' | 'tablet' } {
  const ua = navigator.userAgent;
  let type: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  let osName = 'Desktop';

  if (/iPad|tablet/i.test(ua)) {
    type = 'tablet';
    osName = 'Tablet';
  } else if (/iPhone/i.test(ua)) {
    type = 'mobile';
    osName = 'iPhone';
  } else if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) {
      type = 'mobile';
      osName = 'Android Phone';
    } else {
      type = 'tablet';
      osName = 'Android Tablet';
    }
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    type = 'desktop';
    osName = 'Mac';
  } else if (/Windows NT/i.test(ua)) {
    type = 'desktop';
    osName = 'Windows PC';
  } else if (/Linux/i.test(ua)) {
    type = 'desktop';
    osName = 'Linux PC';
  }

  // Check saved custom name
  const savedName = localStorage.getItem('clipsync_device_name');
  if (savedName && savedName.trim()) {
    return { name: savedName.trim(), type };
  }

  // Browser brand
  let browser = 'Browser';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  const defaultName = `${osName} (${browser})`;
  return { name: defaultName, type };
}

export function getStoredDeviceId(): string {
  let id = localStorage.getItem('clipsync_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('clipsync_device_id', id);
  }
  return id;
}

export function saveDeviceName(name: string): void {
  localStorage.setItem('clipsync_device_name', name.trim());
}

// Web Audio API Synthesized Chimes (Zero external dependencies)
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSyncChime(enabled: boolean = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    // Pleasant two-tone chime (E5 -> G5)
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

export function playPingChime(enabled: boolean = true) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // High alert doorbell chime (C6 -> E6 -> G6)
    [1046.5, 1318.51, 1567.98].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.35);
    });
  } catch {
    // Ignore audio errors
  }
}

export function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([35, 40, 35]);
    } catch {
      // Ignore vibration error
    }
  }
}

export const COLOR_SCHEMES: Record<StickyColor, ColorScheme> = {
  yellow: {
    id: 'yellow',
    name: 'Canary Yellow',
    bgLight: 'bg-amber-100',
    bgDark: 'dark:bg-amber-950/70',
    textLight: 'text-amber-950',
    textDark: 'dark:text-amber-100',
    borderLight: 'border-amber-300',
    borderDark: 'dark:border-amber-700/50',
    headerLight: 'bg-amber-200/90',
    headerDark: 'dark:bg-amber-900/60',
    accent: 'text-amber-700 dark:text-amber-400',
  },
  mint: {
    id: 'mint',
    name: 'Mint Green',
    bgLight: 'bg-emerald-100',
    bgDark: 'dark:bg-emerald-950/70',
    textLight: 'text-emerald-950',
    textDark: 'dark:text-emerald-100',
    borderLight: 'border-emerald-300',
    borderDark: 'dark:border-emerald-700/50',
    headerLight: 'bg-emerald-200/90',
    headerDark: 'dark:bg-emerald-900/60',
    accent: 'text-emerald-700 dark:text-emerald-400',
  },
  lavender: {
    id: 'lavender',
    name: 'Soft Lavender',
    bgLight: 'bg-purple-100',
    bgDark: 'dark:bg-purple-950/70',
    textLight: 'text-purple-950',
    textDark: 'dark:text-purple-100',
    borderLight: 'border-purple-300',
    borderDark: 'dark:border-purple-700/50',
    headerLight: 'bg-purple-200/90',
    headerDark: 'dark:bg-purple-900/60',
    accent: 'text-purple-700 dark:text-purple-400',
  },
  blue: {
    id: 'blue',
    name: 'Sky Blue',
    bgLight: 'bg-sky-100',
    bgDark: 'dark:bg-sky-950/70',
    textLight: 'text-sky-950',
    textDark: 'dark:text-sky-100',
    borderLight: 'border-sky-300',
    borderDark: 'dark:border-sky-700/50',
    headerLight: 'bg-sky-200/90',
    headerDark: 'dark:bg-sky-900/60',
    accent: 'text-sky-700 dark:text-sky-400',
  },
  peach: {
    id: 'peach',
    name: 'Warm Coral',
    bgLight: 'bg-rose-100',
    bgDark: 'dark:bg-rose-950/70',
    textLight: 'text-rose-950',
    textDark: 'dark:text-rose-100',
    borderLight: 'border-rose-300',
    borderDark: 'dark:border-rose-700/50',
    headerLight: 'bg-rose-200/90',
    headerDark: 'dark:bg-rose-900/60',
    accent: 'text-rose-700 dark:text-rose-400',
  },
  dark: {
    id: 'dark',
    name: 'Obsidian Slate',
    bgLight: 'bg-neutral-800',
    bgDark: 'dark:bg-neutral-900',
    textLight: 'text-neutral-100',
    textDark: 'dark:text-neutral-100',
    borderLight: 'border-neutral-700',
    borderDark: 'dark:border-neutral-800',
    headerLight: 'bg-neutral-900',
    headerDark: 'dark:bg-neutral-950',
    accent: 'text-neutral-400',
  },
};
