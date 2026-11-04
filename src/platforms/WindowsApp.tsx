import React, { useRef, useState, useEffect } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Mail, 
  Trash2, 
  Copy, 
  Check, 
  Clipboard, 
  Search, 
  X, 
  Minus, 
  Square, 
  QrCode, 
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { NoteState, StickyColor, ClipItem, ConnectedDevice } from '../types';
import { ClearHistoryModal } from '../components/ClearHistoryModal';

interface WindowsAppProps {
  note: NoteState;
  sessionId: string;
  connectedDevices: ConnectedDevice[];
  history: ClipItem[];
  lanIp: string;
  lanPort: number;
  onTextChange: (newContent: string) => void;
  onColorChange: (newColor: StickyColor) => void;
  onFontSizeChange: (newSize: 'sm' | 'base' | 'lg') => void;
  onSaveToHistory: (content: string) => void;
  onRestoreClip: (content: string) => void;
  onDeleteClip: (id: string) => void;
  onClearHistory: () => void;
  onBuzzDevices: () => void;
  onOpenLanModal: () => void;
  onNewNote: () => void;
  remoteTypingDevice?: string | null;
}

export const WindowsApp: React.FC<WindowsAppProps> = ({
  note,
  connectedDevices,
  history,
  lanIp,
  lanPort,
  onTextChange,
  onSaveToHistory,
  onRestoreClip,
  onDeleteClip,
  onClearHistory,
  onOpenLanModal,
  onNewNote,
  remoteTypingDevice,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [detectedUrls, setDetectedUrls] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 = active draft

  // Extract URLs
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = note.content.match(urlRegex) || [];
    setDetectedUrls(Array.from(new Set(matches)).slice(0, 3));
  }, [note.content]);

  // Format header date / time e.g. "Apr 20 12:33 PM"
  const formattedDateTime = React.useMemo(() => {
    const d = new Date(note.updatedAt || Date.now());
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, [note.updatedAt]);

  // Smart truncated label for LAN Wi-Fi button
  const displayLanLabel = React.useMemo(() => {
    if (!lanIp || lanIp === '127.0.0.1' || lanIp === 'localhost') return 'Local';
    // If standard IPv4 address, show IP
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(lanIp);
    if (isIp) return lanIp;
    // Otherwise show smart compact Wi-Fi label
    return 'Wi-Fi';
  }, [lanIp]);

  const handleCopy = async () => {
    if (!note.content) return;
    try {
      await navigator.clipboard.writeText(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onTextChange(text);
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleClearNote = () => {
    if (!note.content.trim()) return;
    if (window.confirm('Clear this note? It will remain safely saved in your History.')) {
      onSaveToHistory(note.content);
      onTextChange('');
    }
  };

  // Previous Note Navigation
  const handlePrevNote = () => {
    if (history.length === 0) return;
    const nextIdx = historyIndex + 1;
    if (nextIdx < history.length) {
      setHistoryIndex(nextIdx);
      onTextChange(history[nextIdx].content);
    }
  };

  // Next Note Navigation
  const handleNextNote = () => {
    if (historyIndex <= 0) return;
    const prevIdx = historyIndex - 1;
    setHistoryIndex(prevIdx);
    onTextChange(history[prevIdx].content);
  };

  // Electron Window Controls
  const handleMinimize = () => {
    if ((window as any).electronAPI?.minimize) {
      (window as any).electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if ((window as any).electronAPI?.maximize) {
      (window as any).electronAPI.maximize();
    }
  };

  const handleClose = () => {
    if ((window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    }
  };

  const filteredHistory = history.filter((item) =>
    item.content.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.device.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#241006] select-none rounded-lg border border-[#4a2414] shadow-2xl">
      {/* 1. CLASSIC STITCHED LEATHER HEADER BAR (Draggable in Electron) */}
      <header
        className="relative z-20 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-[#482517] via-[#381a0e] to-[#240e06] border-b-2 border-[#150702] shadow-[0_4px_10px_rgba(0,0,0,0.5)] cursor-move select-none"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* Subtle decorative top stitched seam line */}
        <div className="absolute top-1 left-2 right-2 border-t border-dashed border-[#683925]/60 pointer-events-none" />

        {/* Left Section: Compact Smart LAN QR Pairing Pill */}
        <div className="flex items-center gap-1.5 z-10 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={onOpenLanModal}
            title={`LAN Server: ${lanIp}:${lanPort} (Click to show Mobile QR)`}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a0a04]/80 hover:bg-[#1a0a04] active:scale-95 border border-[#5a2e1a] rounded text-[#f3e8d2] text-xs font-semibold shadow-inner transition-all cursor-pointer max-w-[130px]"
          >
            <QrCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono text-[11px] truncate">{displayLanLabel}</span>
            {connectedDevices.length > 0 && (
              <span className="flex items-center gap-1 ml-0.5 text-emerald-400 text-[10px] font-bold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {connectedDevices.length}
              </span>
            )}
          </button>
        </div>

        {/* Embossed Leather Title: Always clean "Notes" without echoing typed keystrokes */}
        <div className="flex-1 text-center px-2 truncate pointer-events-none">
          <h1 className="text-base sm:text-lg font-bold text-[#faf3e0] tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] truncate font-serif">
            Notes
          </h1>
          {remoteTypingDevice && (
            <p className="text-[10px] text-amber-300 font-sans animate-pulse">
              {remoteTypingDevice} is typing...
            </p>
          )}
        </div>

        {/* Right Section: New Note (+) and Window Controls */}
        <div className="flex items-center gap-2 z-10 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {/* Recessed Dark Leather Button with White Plus (New Note) */}
          <button
            onClick={() => {
              setHistoryIndex(-1);
              onNewNote();
            }}
            title="New Note (Preserves current to history)"
            className="w-7 h-7 flex items-center justify-center bg-[#180903] hover:bg-[#120602] active:scale-90 border border-[#582b17] rounded shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_1px_1px_rgba(255,255,255,0.1)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
          </button>

          {/* Windows Minimize / Maximize / Close Buttons */}
          <div className="flex items-center ml-1 border-l border-[#542816] pl-1.5">
            <button
              onClick={handleMinimize}
              title="Minimize"
              className="p-1 hover:bg-white/10 rounded text-[#d6c7b2] hover:text-white transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMaximize}
              title="Maximize"
              className="p-1 hover:bg-white/10 rounded text-[#d6c7b2] hover:text-white transition-colors"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              title="Close to Tray"
              className="p-1 hover:bg-red-600/80 rounded text-[#d6c7b2] hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtle decorative bottom stitched seam line */}
        <div className="absolute bottom-1 left-2 right-2 border-b border-dashed border-[#552c1b]/60 pointer-events-none" />
      </header>

      {/* 2. CANARY YELLOW LINED LEGAL PAD BODY */}
      <main className="relative flex-1 flex flex-col overflow-hidden bg-[#fbf5cd] text-neutral-900 shadow-inner">
        {/* Paper Subheader Metadata Line (Today | Date & Time) */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1 border-b border-[#e5dcab] text-xs">
          <span className="font-serif font-bold text-[#991b1b] tracking-wider text-sm">
            Today
          </span>
          <span className="text-[#854d0e] font-sans text-xs tracking-tight">
            {formattedDateTime}
          </span>
        </div>

        {/* Lined Paper Canvas with Left Red Margin Rule */}
        <div className="relative flex-1 flex overflow-hidden">
          {/* Vertical Red Margin Rule Line */}
          <div className="absolute top-0 bottom-0 left-[44px] w-px bg-red-400/40 pointer-events-none z-10" />

          {/* Ruled lines & Textarea */}
          <div
            className="flex-1 h-full w-full overflow-y-auto px-4 pl-[54px] pr-4 py-2 relative"
            style={{
              background: 'repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(148, 163, 184, 0.35) 27px, rgba(148, 163, 184, 0.35) 28px)',
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
              className="w-full h-full min-h-[300px] bg-transparent resize-none border-none outline-none font-['Patrick_Hand',cursive,sans-serif] text-[20px] text-[#1c1917] placeholder:text-[#a8a29e] select-text focus:ring-0 leading-[28px]"
              autoFocus
              spellCheck="false"
            />
          </div>
        </div>

        {/* Detected URL Quick Access Pill */}
        {detectedUrls.length > 0 && (
          <div className="px-6 py-1.5 bg-[#f5ecc0] border-t border-[#e2d69b] flex items-center gap-2 overflow-x-auto z-10">
            <span className="text-[10px] uppercase font-bold text-[#854d0e] tracking-wider shrink-0">Link:</span>
            {detectedUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#0369a1] hover:underline bg-white/70 px-2 py-0.5 rounded border border-[#cbd5e1] truncate max-w-[260px]"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        )}

        {/* 3. TACTILE SEPIA BOTTOM TOOLBAR */}
        <footer className="relative z-20 flex items-center justify-around px-4 py-2.5 bg-[#fbf5cd] border-t border-[#e8dfb0]">
          {/* Previous Note Button */}
          <button
            onClick={handlePrevNote}
            disabled={history.length === 0 || historyIndex >= history.length - 1}
            title="Previous Note in History"
            className="p-2 rounded-full text-[#853828] hover:bg-[#eedf9c]/60 active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
          </button>

          {/* Mail / History Drawer Button */}
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            title="Notes History & Clips"
            className="relative p-2 rounded-full text-[#853828] hover:bg-[#eedf9c]/60 active:scale-90 transition-all cursor-pointer"
          >
            <Mail className="w-6 h-6 stroke-[2.2]" />
            {history.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#991b1b]" />
            )}
          </button>

          {/* Trash / Clear Button */}
          <button
            onClick={handleClearNote}
            disabled={!note.content.trim()}
            title="Clear Current Note"
            className="p-2 rounded-full text-[#853828] hover:bg-[#eedf9c]/60 active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <Trash2 className="w-6 h-6 stroke-[2.2]" />
          </button>

          {/* Next Note Button */}
          <button
            onClick={handleNextNote}
            disabled={historyIndex <= 0}
            title="Next Note in History"
            className="p-2 rounded-full text-[#853828] hover:bg-[#eedf9c]/60 active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.2]" />
          </button>

          {/* Quick Paste Button */}
          <button
            onClick={handlePaste}
            title="Paste from PC Clipboard"
            className="p-2 rounded-full text-[#853828] hover:bg-[#eedf9c]/60 active:scale-90 transition-all cursor-pointer"
          >
            {pasted ? <Check className="w-5 h-5 text-emerald-700 stroke-[2.5]" /> : <Clipboard className="w-5 h-5 stroke-[2.2]" />}
          </button>

          {/* Quick Copy Button */}
          <button
            onClick={handleCopy}
            disabled={!note.content.trim()}
            title="Copy Note Text"
            className="p-2 rounded-full text-[#853828] hover:bg-[#eedf9c]/60 active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-700 stroke-[2.5]" /> : <Copy className="w-5 h-5 stroke-[2.2]" />}
          </button>
        </footer>
      </main>

      {/* 4. HISTORY SIDEBAR / DRAWER FOR WINDOWS */}
      {isHistoryOpen && (
        <div className="absolute inset-y-0 right-0 w-80 z-30 bg-[#241209] border-l-2 border-[#542915] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-3 bg-[#381a0e] border-b border-[#4d2413] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white text-sm">Notes History</h3>
              <span className="text-[11px] text-amber-200/70 bg-[#210c05] px-2 py-0.5 rounded-full border border-[#522514]">
                {history.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {history.length > 0 && (
                <button
                  onClick={() => setIsClearModalOpen(true)}
                  className="text-[11px] text-red-300 hover:text-red-100 px-2.5 py-1 bg-red-950/80 hover:bg-red-900 rounded border border-red-800 transition-colors cursor-pointer font-semibold shadow-sm"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-2.5 bg-[#2d150b] border-b border-[#452010]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-amber-400/60 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history..."
                className="w-full bg-[#1b0a04] border border-[#522514] rounded pl-8 pr-2.5 py-1 text-xs text-[#f5eedc] placeholder:text-[#8a7260] outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-[#9c826c]">
                <p className="text-xs">No notes in history yet.</p>
                <p className="text-[11px] text-[#705a49] mt-1">
                  Notes are auto-saved on 3s pause and when creating new notes.
                </p>
              </div>
            ) : (
              filteredHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onRestoreClip(item.content);
                    setIsHistoryOpen(false);
                  }}
                  className="p-2.5 bg-[#1d0b04] hover:bg-[#2e1307] border border-[#4d2311] rounded-lg cursor-pointer transition-all flex flex-col gap-1 shadow"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#9c826c]">
                    <span className="font-semibold text-amber-300/90">{item.device}</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-[#f5eedc] font-['Patrick_Hand',cursive,sans-serif] text-[16px] line-clamp-3 whitespace-pre-wrap leading-tight">
                    {item.content}
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#3b190c]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClip(item.id);
                      }}
                      className="text-[11px] text-[#a37060] hover:text-red-400 p-0.5"
                      title="Delete note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestoreClip(item.content);
                        setIsHistoryOpen(false);
                      }}
                      className="text-[11px] text-amber-300 font-medium flex items-center gap-1 hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal: User must type 'clear' to clear all history */}
      <ClearHistoryModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={onClearHistory}
        itemCount={history.length}
      />
    </div>
  );
};
