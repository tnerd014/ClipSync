import React, { useRef, useState, useEffect } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Mail, 
  Trash2, 
  Copy, 
  Check, 
  Camera, 
  ShieldCheck, 
  Search, 
  X, 
  RotateCcw,
  ExternalLink,
  Lock,
  HelpCircle
} from 'lucide-react';
import { NoteState, StickyColor, ClipItem, ConnectedDevice } from '../types';
import { triggerHaptic } from '../utils/device';
import { ClearHistoryModal } from '../components/ClearHistoryModal';

interface AndroidAppProps {
  note: NoteState;
  sessionId: string;
  connectedDevices: ConnectedDevice[];
  history: ClipItem[];
  pin?: string;
  onTextChange: (newContent: string) => void;
  onColorChange: (newColor: StickyColor) => void;
  onSaveToHistory: (content: string) => void;
  onRestoreClip: (content: string) => void;
  onDeleteClip: (id: string) => void;
  onClearHistory: () => void;
  onBuzzDevices: () => void;
  onOpenScanner: () => void;
  onOpenPinModal?: () => void;
  onOpenTroubleshoot?: () => void;
  onNewNote: () => void;
  onOpenPermissions?: () => void;
  remoteTypingDevice?: string | null;
}

export const AndroidApp: React.FC<AndroidAppProps> = ({
  note,
  connectedDevices,
  history,
  pin,
  onTextChange,
  onSaveToHistory,
  onRestoreClip,
  onDeleteClip,
  onClearHistory,
  onOpenScanner,
  onOpenPinModal,
  onOpenTroubleshoot,
  onNewNote,
  onOpenPermissions,
  remoteTypingDevice,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [detectedUrls, setDetectedUrls] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 = active draft

  // Extract URLs for easy opening
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

  const handleCopy = async () => {
    if (!note.content) return;
    triggerHaptic();
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

  const handleClearNote = () => {
    if (!note.content.trim()) return;
    triggerHaptic();
    onSaveToHistory(note.content);
    onTextChange('');
  };

  // Previous Note Navigation
  const handlePrevNote = () => {
    if (history.length === 0) return;
    triggerHaptic();
    const nextIdx = historyIndex + 1;
    if (nextIdx < history.length) {
      setHistoryIndex(nextIdx);
      onTextChange(history[nextIdx].content);
    }
  };

  // Next Note Navigation
  const handleNextNote = () => {
    if (historyIndex <= 0) return;
    triggerHaptic();
    const prevIdx = historyIndex - 1;
    setHistoryIndex(prevIdx);
    onTextChange(history[prevIdx].content);
  };

  const filteredHistory = history.filter((item) =>
    item.content.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.device.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#2a1309] select-none pb-[env(safe-area-inset-bottom,0px)]">
      {/* 1. MINIMALIST SWIFTUI HEADER ON WARM LEATHER */}
      <header className="relative z-20 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-[#452315] to-[#281107] border-b border-black/40 shadow-sm">
        {/* Left Action Capsule: SwiftUI Minimalist Segmented Pill */}
        <div className="flex items-center gap-0.5 p-0.5 bg-black/25 backdrop-blur-md rounded-full z-10 shrink-0">
          <button
            onClick={() => {
              triggerHaptic();
              onOpenScanner();
            }}
            title="Scan QR"
            className="flex items-center gap-1 px-2.5 py-1 hover:bg-white/10 active:scale-95 rounded-full text-[#faf3e0]/95 text-[11px] font-medium tracking-tight transition-all shrink-0 cursor-pointer"
          >
            <Camera className="w-3 h-3 text-[#faf3e0]/80 stroke-[1.8] shrink-0" />
            <span>Scan</span>
            {connectedDevices.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            )}
          </button>

          {onOpenPinModal && (
            <button
              onClick={() => {
                triggerHaptic();
                onOpenPinModal();
              }}
              title="PIN"
              className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 active:scale-95 rounded-full text-[#faf3e0]/85 text-[11px] font-mono font-medium shrink-0 cursor-pointer transition-all"
            >
              <Lock className="w-2.5 h-2.5 text-[#faf3e0]/70 stroke-[1.8]" />
              <span>{pin || 'PIN'}</span>
            </button>
          )}

          {onOpenTroubleshoot && (
            <button
              onClick={() => {
                triggerHaptic();
                onOpenTroubleshoot();
              }}
              title="Connection"
              className="w-6 h-6 flex items-center justify-center hover:bg-white/10 active:scale-95 rounded-full text-[#faf3e0]/75 hover:text-white transition-all shrink-0 cursor-pointer"
            >
              <HelpCircle className="w-3 h-3 stroke-[1.8] shrink-0" />
            </button>
          )}

          {onOpenPermissions && (
            <button
              onClick={() => {
                triggerHaptic();
                onOpenPermissions();
              }}
              title="Permissions"
              className="w-6 h-6 flex items-center justify-center hover:bg-white/10 active:scale-95 rounded-full text-[#faf3e0]/75 hover:text-white transition-all shrink-0 cursor-pointer"
            >
              <ShieldCheck className="w-3 h-3 stroke-[1.8] shrink-0" />
            </button>
          )}
        </div>

        {/* Center Title */}
        <div className="flex-1 text-center px-2 truncate pointer-events-none">
          <h1 className="text-sm sm:text-base font-semibold text-[#faf3e0]/95 tracking-tight truncate font-serif">
            Notes
          </h1>
          {remoteTypingDevice && (
            <p className="text-[10px] text-[#faf3e0]/70 font-sans animate-pulse leading-none">
              {remoteTypingDevice} typing...
            </p>
          )}
        </div>

        {/* Right Action: SwiftUI Circular Capsule (+) */}
        <div className="flex items-center z-10 shrink-0">
          <button
            onClick={() => {
              triggerHaptic();
              setHistoryIndex(-1);
              onNewNote();
            }}
            title="New Note"
            className="w-7 h-7 flex items-center justify-center bg-black/25 hover:bg-white/15 active:scale-90 rounded-full text-[#faf3e0]/95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </header>

      {/* 2. CANARY YELLOW LINED LEGAL PAD BODY */}
      <main className="relative flex-1 flex flex-col overflow-hidden bg-[#fbf5cd] text-neutral-900 shadow-inner">
        <div className="flex items-center justify-between px-6 pt-2.5 pb-1 border-b border-[#e5dcab]/80 text-xs">
          <span className="font-serif font-semibold text-[#991b1b] tracking-tight text-xs">
            Today
          </span>
          <span className="text-[#854d0e]/80 font-sans text-[11px] tracking-tight">
            {formattedDateTime}
          </span>
        </div>

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
              placeholder="Write your note or paste text here... Syncs instantly with PC"
              className="w-full h-full min-h-[300px] bg-transparent resize-none border-none outline-none font-['Patrick_Hand',cursive,sans-serif] text-[20px] text-[#1c1917] placeholder:text-[#a8a29e] select-text focus:ring-0 leading-[28px]"
              autoFocus
              spellCheck="false"
            />
          </div>
        </div>

        {detectedUrls.length > 0 && (
          <div className="px-5 py-1.5 bg-[#f5ecc0]/80 border-t border-[#e2d69b]/70 flex items-center gap-1.5 overflow-x-auto z-10">
            {detectedUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1c1917] bg-black/[0.06] hover:bg-black/[0.1] px-2.5 py-0.5 rounded-full truncate max-w-[220px] transition-colors"
              >
                <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        )}

        {/* 3. SWIFTUI MINIMALIST BOTTOM TOOLBAR */}
        <footer className="relative z-20 flex items-center justify-around px-4 py-2 bg-[#fbf5cd] border-t border-[#e8dfb0]/80">
          <button
            onClick={handlePrevNote}
            disabled={history.length === 0 || historyIndex >= history.length - 1}
            title="Previous Note"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 stroke-[1.8]" />
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setShowHistorySheet(true);
            }}
            title="History"
            className="relative w-8 h-8 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 transition-all cursor-pointer"
          >
            <Mail className="w-[18px] h-[18px] stroke-[1.8]" />
            {history.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#991b1b]" />
            )}
          </button>

          <button
            onClick={handleClearNote}
            disabled={!note.content.trim()}
            title="Clear Note"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <Trash2 className="w-[18px] h-[18px] stroke-[1.8]" />
          </button>

          <button
            onClick={handleNextNote}
            disabled={historyIndex <= 0}
            title="Next Note"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 stroke-[1.8]" />
          </button>

          <button
            onClick={handleCopy}
            disabled={!note.content.trim()}
            title="Copy"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#6e3b26] hover:bg-black/[0.06] active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-700 stroke-[2.2]" /> : <Copy className="w-4 h-4 stroke-[1.8]" />}
          </button>
        </footer>
      </main>

      {/* 4. SLIDE-IN SIDEBAR DRAWER FOR HISTORY WITH HEADER COLOR SCHEME & SWIFTUI UI/UX */}
      {showHistorySheet && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setShowHistorySheet(false)}
        >
          <aside
            className="w-[275px] max-w-[82vw] h-full flex flex-col bg-gradient-to-b from-[#452315] via-[#34180c] to-[#240f06] border-l border-black/40 shadow-2xl p-3.5 text-[#faf3e0] space-y-3 animate-in slide-in-from-right duration-200"
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
                  onClick={() => setShowHistorySheet(false)}
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
                      triggerHaptic();
                      onRestoreClip(item.content);
                      setShowHistorySheet(false);
                    }}
                    className="p-2.5 bg-black/25 hover:bg-black/35 active:scale-[0.99] rounded-xl cursor-pointer transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#faf3e0]/60">
                      <span className="text-[#faf3e0]/85 font-medium truncate max-w-[130px]">{item.device}</span>
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
