import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Mail,
  QrCode,
  Copy,
  Check,
  Clipboard,
  Minus,
  Square,
  X,
  Search,
  ExternalLink,
  RotateCcw,
  Pin,
  LayoutTemplate,
} from 'lucide-react';
import { NoteState, ClipItem, ConnectedDevice } from '../types';
import { ClearHistoryModal } from '../components/ClearHistoryModal';

interface WindowsAppProps {
  note: NoteState;
  history: ClipItem[];
  connectedDevices: ConnectedDevice[];
  isConnected?: boolean;
  sessionId: string;
  pin: string;
  lanIp: string;
  lanPort: number;
  remoteTypingDevice: string | null;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onTextChange: (content: string) => void;
  onColorChange?: (color: any) => void;
  onFontSizeChange?: (size: any) => void;
  onSaveToHistory: (content: string) => void;
  onRestoreClip: (content: string) => void;
  onDeleteClip: (id: string) => void;
  onClearHistory: () => void;
  onBuzzDevices: () => void;
  onNewNote: () => void;
  onOpenLanModal: () => void;
  onOpenTroubleshoot?: () => void;
}

export const WindowsApp: React.FC<WindowsAppProps> = ({
  note,
  history,
  connectedDevices,
  pin,
  lanIp,
  lanPort,
  remoteTypingDevice,
  onTextChange,
  onSaveToHistory,
  onRestoreClip,
  onDeleteClip,
  onClearHistory,
  onNewNote,
  onOpenLanModal,
}) => {
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearNoteModalOpen, setIsClearNoteModalOpen] = useState(false);

  // Desktop Sticky Note Widget States (Always on Top & Mini Widget Mode)
  const initialWidget =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('widget') === '1';
  const [isPinned, setIsPinned] = useState(initialWidget);
  const [isWidgetMode, setIsWidgetMode] = useState(initialWidget);
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).electronAPI);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Live clock for the "Today  12/4/2026 12:35 PM" header line
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Listen for native Electron Always-on-Top / Widget state changes (e.g. from system tray)
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.getWindowState) {
      api.getWindowState().then((state: any) => {
        if (state) {
          setIsPinned(Boolean(state.alwaysOnTop));
          setIsWidgetMode(Boolean(state.isWidgetMode));
        }
      }).catch(() => {});
    }
    if (api?.onAlwaysOnTopChanged) {
      const unsub = api.onAlwaysOnTopChanged((val: boolean) => setIsPinned(val));
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, []);

  // Extract URLs in note for quick click-to-open
  const detectedUrls = React.useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return note.content.match(urlRegex) || [];
  }, [note.content]);

  const handleCopy = async () => {
    if (!note.content.trim()) return;
    try {
      await navigator.clipboard.writeText(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const el = document.createElement('textarea');
      el.value = note.content;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handlePaste = async () => {
    try {
      let text = '';
      if ((window as any).electronAPI?.readClipboard) {
        text = await (window as any).electronAPI.readClipboard();
      } else {
        text = await navigator.clipboard.readText();
      }
      if (text) {
        const nextContent = note.content
          ? `${note.content}${note.content.endsWith('\n') ? '' : '\n'}${text}`
          : text;
        onTextChange(nextContent);
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch (err) {
      console.error('Clipboard read error:', err);
    }
  };

  // Cycle backward/forward through note history using the < and > buttons
  const handlePrevNote = () => {
    if (history.length === 0) return;
    const nextIdx = Math.min(historyIndex + 1, history.length - 1);
    setHistoryIndex(nextIdx);
    onRestoreClip(history[nextIdx].content);
  };

  const handleNextNote = () => {
    if (history.length === 0) return;
    if (historyIndex <= 0) {
      setHistoryIndex(-1);
      return;
    }
    const prevIdx = historyIndex - 1;
    setHistoryIndex(prevIdx);
    onRestoreClip(history[prevIdx].content);
  };

  const handleRequestClearNote = () => {
    if (!note.content.trim()) return;
    setIsClearNoteModalOpen(true);
  };

  const confirmClearNote = () => {
    const trimmed = note.content.trim();
    if (trimmed) {
      const matchingHistoryItem =
        historyIndex >= 0 && history[historyIndex]
          ? history[historyIndex]
          : history.find((h) => h.content.trim() === trimmed);
      if (matchingHistoryItem) {
        onDeleteClip(matchingHistoryItem.id);
      }
    }
    setHistoryIndex(-1);
    onTextChange('');
    setIsClearNoteModalOpen(false);
    textareaRef.current?.focus();
  };

  // Electron Window Controls (Fallback for web preview; native Windows 11 titleBarOverlay handles these on PC)
  const handleMinimize = () => {
    if ((window as any).electronAPI?.minimizeWindow) {
      (window as any).electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if ((window as any).electronAPI?.maximizeWindow) {
      (window as any).electronAPI.maximizeWindow();
    }
  };

  const handleClose = () => {
    if ((window as any).electronAPI?.closeWindow) {
      (window as any).electronAPI.closeWindow();
    }
  };

  // Pin to Screen (Always on Top Sticky Note)
  const handleTogglePin = async () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    if ((window as any).electronAPI?.toggleAlwaysOnTop) {
      const confirmed = await (window as any).electronAPI.toggleAlwaysOnTop(nextPinned);
      setIsPinned(Boolean(confirmed));
    }
  };

  // Toggle Compact Desktop Sticky Note Widget Mode
  const handleToggleWidget = async () => {
    const nextWidget = !isWidgetMode;
    setIsWidgetMode(nextWidget);
    if (nextWidget && !isPinned) {
      setIsPinned(true);
    }
    if ((window as any).electronAPI?.toggleWidgetMode) {
      const res = await (window as any).electronAPI.toggleWidgetMode(nextWidget);
      if (res) {
        setIsWidgetMode(Boolean(res.isWidgetMode));
        setIsPinned(Boolean(res.alwaysOnTop));
      }
    }
  };

  const filteredHistory = history.filter(
    (item) =>
      item.content.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.device.toLowerCase().includes(historySearch.toLowerCase())
  );

  const formattedDateTime = `${currentTime.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  })} ${currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;

  const displayLanLabel =
    lanIp && lanIp !== '127.0.0.1' && lanIp !== 'localhost'
      ? lanIp
      : 'LAN Sync';

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col bg-[#2b170e] select-none font-sans shadow-2xl transition-all duration-200 ${
        isPinned ? 'border border-white/20' : 'border border-[#3e2215]'
      }`}
    >
      {/* 1. MINIMALIST SWIFTUI HEADER (Draggable Titlebar + Native Windows 11 Overlay Space) */}
      <header
        className={`relative z-30 flex items-center justify-between bg-gradient-to-b from-[#452315] to-[#281107] border-b border-black/40 shadow-sm ${
          isWidgetMode ? 'h-[36px] pl-2' : 'h-[38px] pl-2.5'
        } ${isElectron && !isWidgetMode ? 'pr-[138px]' : 'pr-2'}`}
        style={{ WebkitAppRegion: 'drag' } as any}
        onDoubleClick={handleMaximize}
      >
        {/* Left Section: SwiftUI Minimalist Segmented Pill */}
        <div
          className="flex items-center gap-0.5 p-0.5 bg-black/25 backdrop-blur-md rounded-full z-10 shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <button
            onClick={onOpenLanModal}
            title={`LAN: ${lanIp}:${lanPort} | PIN: ${pin}`}
            className={`flex items-center justify-center gap-1 hover:bg-white/10 active:scale-95 rounded-full text-[#faf3e0]/95 text-[11px] font-medium tracking-tight transition-all cursor-pointer ${
              isWidgetMode ? 'w-6 h-6 p-0' : 'px-2.5 py-0.5 max-w-[130px]'
            }`}
          >
            <QrCode className="w-3 h-3 text-[#faf3e0]/80 stroke-[1.8] shrink-0" />
            {!isWidgetMode && (
              <span className="font-mono text-[11px] truncate">{displayLanLabel}</span>
            )}
            {connectedDevices.length > 0 && (
              <span className="flex items-center gap-0.5 text-emerald-400 text-[10px] font-semibold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {!isWidgetMode && connectedDevices.length}
              </span>
            )}
          </button>

          {!isWidgetMode && (
            <button
              onClick={onOpenLanModal}
              title={`PIN: ${pin}`}
              className="hidden sm:flex items-center gap-1 px-2 py-0.5 hover:bg-white/10 active:scale-95 rounded-full text-[#faf3e0]/85 text-[11px] font-mono font-medium cursor-pointer transition-all"
            >
              <span>{pin}</span>
            </button>
          )}
        </div>

        {/* Center Draggable Grab Area */}
        <div
          className="flex-1 h-full flex flex-col items-center justify-center px-1 truncate cursor-move"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          {!isWidgetMode && (
            <h1 className="text-sm font-semibold text-[#faf3e0]/95 tracking-tight truncate font-serif pointer-events-none select-none">
              Notes
            </h1>
          )}
          {remoteTypingDevice && !isWidgetMode && (
            <p className="text-[9px] text-[#faf3e0]/70 font-sans animate-pulse pointer-events-none leading-none">
              {remoteTypingDevice} typing...
            </p>
          )}
        </div>

        {/* Right Section: SwiftUI Minimalist Capsule Actions */}
        <div
          className="flex items-center gap-1 z-10 shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <div className="flex items-center gap-0.5 p-0.5 bg-black/25 backdrop-blur-md rounded-full">
            <button
              onClick={() => {
                setHistoryIndex(-1);
                onNewNote();
              }}
              title="New Note"
              className="w-6 h-6 flex items-center justify-center hover:bg-white/10 active:scale-95 rounded-full text-[#faf3e0]/90 hover:text-white transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2]" />
            </button>

            <button
              onClick={handleTogglePin}
              title={isPinned ? 'Unpin' : 'Pin on Top'}
              className={`w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                isPinned
                  ? 'bg-white/20 text-white'
                  : 'text-[#faf3e0]/75 hover:text-white hover:bg-white/10'
              }`}
            >
              <Pin className={`w-3 h-3 stroke-[1.8] transition-transform ${isPinned ? 'rotate-45 fill-white' : ''}`} />
            </button>

            <button
              onClick={handleToggleWidget}
              title={isWidgetMode ? 'Standard Size' : 'Mini Widget'}
              className={`w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                isWidgetMode
                  ? 'bg-white/20 text-white'
                  : 'text-[#faf3e0]/75 hover:text-white hover:bg-white/10'
              }`}
            >
              <LayoutTemplate className="w-3 h-3 stroke-[1.8]" />
            </button>
          </div>

          {!isElectron && !isWidgetMode && (
            <div className="flex items-center gap-0.5 pl-0.5">
              <button
                onClick={handleMinimize}
                title="Minimize"
                className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-full text-[#faf3e0]/75 hover:text-white transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3 stroke-[1.8]" />
              </button>
              <button
                onClick={handleMaximize}
                title="Maximize"
                className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-full text-[#faf3e0]/75 hover:text-white transition-colors cursor-pointer"
              >
                <Square className="w-2.5 h-2.5 stroke-[1.8]" />
              </button>
              <button
                onClick={handleClose}
                title="Close"
                className="w-6 h-6 flex items-center justify-center hover:bg-red-500/80 rounded-full text-[#faf3e0]/75 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3 stroke-[1.8]" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. CANARY YELLOW LINED LEGAL PAD BODY */}
      <main className="relative flex-1 flex flex-col overflow-hidden bg-[#fbf5cd] text-neutral-900 shadow-inner">
        {!isWidgetMode && (
          <div className="flex items-center justify-between px-6 pt-2.5 pb-1 border-b border-[#e5dcab]/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-serif font-semibold text-[#991b1b] tracking-tight text-xs">
                Today
              </span>
              {isPinned && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-[#6e3b26] bg-black/[0.06] px-2 py-0.5 rounded-full">
                  <Pin className="w-2.5 h-2.5 rotate-45" />
                  <span>Pinned</span>
                </span>
              )}
            </div>
            <span className="text-[#854d0e]/80 font-sans text-[11px] tracking-tight">
              {formattedDateTime}
            </span>
          </div>
        )}

        {/* Lined Paper Canvas with Left Red Margin Rule */}
        <div className="relative flex-1 flex overflow-hidden">
          <div className="absolute top-0 bottom-0 left-[44px] w-px bg-red-400/35 pointer-events-none z-10" />

          <div
            className="flex-1 h-full w-full overflow-y-auto px-4 pl-[54px] pr-4 py-2 relative"
            style={{
              background: 'repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(148, 163, 184, 0.32) 27px, rgba(148, 163, 184, 0.32) 28px)',
            }}
          >
            <textarea
              ref={textareaRef}
              value={note.content}
              onChange={(e) => {
                setHistoryIndex(-1);
                onTextChange(e.target.value);
              }}
              placeholder="Type note or paste text... Instant real-time LAN sync with your phone"
              className="w-full h-full min-h-[200px] bg-transparent resize-none border-none outline-none font-['Patrick_Hand',cursive,sans-serif] text-[20px] text-[#1c1917] placeholder:text-[#a8a29e] select-text focus:ring-0 leading-[28px]"
              autoFocus
              spellCheck="false"
            />
          </div>
        </div>

        {/* Detected URL Quick Access Pill */}
        {detectedUrls.length > 0 && (
          <div className="px-5 py-1.5 bg-[#f5ecc0]/80 border-t border-[#e2d69b]/70 flex items-center gap-1.5 overflow-x-auto z-10">
            {detectedUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1c1917] bg-black/[0.06] hover:bg-black/[0.1] px-2.5 py-0.5 rounded-full truncate max-w-[260px] transition-colors"
              >
                <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        )}

        {/* 3. SWIFTUI MINIMALIST BOTTOM TOOLBAR */}
        <footer className="relative z-20 flex items-center justify-around px-3 py-1.5 bg-[#fbf5cd] border-t border-[#e8dfb0]/80">
          <button
            onClick={handlePrevNote}
            disabled={history.length === 0 || historyIndex >= history.length - 1}
            title="Previous Note"
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 stroke-[1.8]" />
          </button>

          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            title="History"
            className="relative w-7 h-7 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 transition-all cursor-pointer"
          >
            <Mail className="w-4 h-4 stroke-[1.8]" />
            {history.length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#991b1b]" />
            )}
          </button>

          <button
            onClick={handleRequestClearNote}
            disabled={!note.content.trim()}
            title="Clear Note"
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4 stroke-[1.8]" />
          </button>

          <button
            onClick={handleNextNote}
            disabled={historyIndex <= 0}
            title="Next Note"
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 stroke-[1.8]" />
          </button>

          <button
            onClick={handlePaste}
            title="Paste"
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 transition-all cursor-pointer"
          >
            {pasted ? <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.2]" /> : <Clipboard className="w-3.5 h-3.5 stroke-[1.8]" />}
          </button>

          <button
            onClick={handleCopy}
            disabled={!note.content.trim()}
            title="Copy"
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.2]" /> : <Copy className="w-3.5 h-3.5 stroke-[1.8]" />}
          </button>
        </footer>
      </main>

      {/* 4. SLIDE-IN SIDEBAR DRAWER FOR HISTORY BELOW HEADER (NEVER COVERED BY WINDOWS CONTROLS) */}
      {isHistoryOpen && (
        <div
          className={`fixed left-0 right-0 bottom-0 z-40 flex justify-end bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150 ${
            isWidgetMode ? 'top-[36px]' : 'top-[38px]'
          }`}
          onClick={() => setIsHistoryOpen(false)}
        >
          <aside
            className="w-[265px] max-w-[85vw] h-full flex flex-col bg-gradient-to-b from-[#452315] via-[#34180c] to-[#240f06] border-l border-black/40 shadow-2xl p-3.5 text-[#faf3e0] space-y-3 animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar Header: Title + SwiftUI Pill Actions */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#faf3e0]/95 tracking-tight">
                  History
                </span>
                <span className="px-2 py-0.5 bg-black/25 rounded-full text-[10px] font-medium text-[#faf3e0]/80">
                  {history.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsClearModalOpen(true)}
                    className="px-2.5 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 active:scale-95 text-[11px] font-medium text-red-300 transition-all cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="px-2.5 py-1 rounded-full bg-black/25 hover:bg-white/10 active:scale-95 text-[11px] font-medium text-[#faf3e0]/90 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* SwiftUI Search Bar */}
            {history.length > 1 && (
              <div className="relative">
                <Search className="w-3 h-3 text-[#faf3e0]/50 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full bg-black/25 rounded-xl pl-7 pr-2.5 py-1 text-xs text-[#faf3e0] placeholder:text-[#faf3e0]/45 outline-none focus:bg-black/35 transition-colors"
                />
              </div>
            )}

            {/* SwiftUI Grouped Note Cards */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {filteredHistory.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-xs text-[#faf3e0]/50">
                  No saved notes
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onRestoreClip(item.content);
                      setIsHistoryOpen(false);
                    }}
                    className="p-2.5 bg-black/25 hover:bg-black/35 active:scale-[0.99] rounded-xl cursor-pointer transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#faf3e0]/60">
                      <span className="text-[#faf3e0]/85 font-medium truncate max-w-[120px]">{item.device}</span>
                      <div className="flex items-center gap-2">
                        <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClip(item.id);
                          }}
                          className="text-[#faf3e0]/50 hover:text-red-300 p-0.5 cursor-pointer transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#faf3e0]/95 line-clamp-2 whitespace-pre-wrap leading-snug">
                      {item.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Confirm Clear Current Note Modal (Saves to History + Asks Yes or No) */}
      {isClearNoteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsClearNoteModalOpen(false)}
        >
          <div
            className="w-full max-w-[230px] bg-gradient-to-b from-[#452315] via-[#34180c] to-[#240f06] border border-black/40 rounded-2xl shadow-2xl p-4 text-[#faf3e0] space-y-3 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-[#faf3e0]/95 tracking-tight">
                Delete Note?
              </p>
              <p className="text-[11px] text-[#faf3e0]/70 leading-snug">
                Are you sure you want to delete this note?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setIsClearNoteModalOpen(false)}
                className="py-1.5 rounded-xl bg-black/25 hover:bg-white/10 active:scale-[0.98] text-xs font-medium text-[#faf3e0]/90 transition-all cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmClearNote}
                className="py-1.5 rounded-xl bg-red-500/25 hover:bg-red-500/35 active:scale-[0.98] text-xs font-semibold text-red-300 transition-all cursor-pointer"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ClearHistoryModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={onClearHistory}
        itemCount={history.length}
      />
    </div>
  );
};
