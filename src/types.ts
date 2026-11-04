export type StickyColor = 'yellow' | 'mint' | 'lavender' | 'blue' | 'peach' | 'dark';

export interface ClipItem {
  id: string;
  content: string;
  timestamp: number;
  device: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  category?: 'note' | 'code' | 'url' | 'number';
}

export interface NoteState {
  id: string;
  content: string;
  color: StickyColor;
  fontSize: 'sm' | 'base' | 'lg';
  updatedAt: number;
  updatedBy: string;
  rev?: number;
}

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  isTyping?: boolean;
}

export interface ColorScheme {
  id: StickyColor;
  name: string;
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
  headerLight: string;
  headerDark: string;
  accent: string;
}
