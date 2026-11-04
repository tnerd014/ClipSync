import React, { useRef, useState, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  BookmarkPlus, 
  ExternalLink, 
  History as HistoryIcon,
  Palette,
  Search,
  RotateCcw,
  Camera,
  Plus,
  ShieldCheck
} from 'lucide-react';
import { NoteState, StickyColor, ClipItem, ConnectedDevice } from '../types';
import { COLOR_SCHEMES, triggerHaptic } from '../utils/device';
import { AppLogo } from '../components/AppLogo';

interface AndroidAppProps {
  note: NoteState;
  sessionId: string;
  connectedDevices: ConnectedDevice[];
  history: ClipItem[];
  onTextChange: (newContent: string) => void;
  onColorChange: (newColor: StickyColor) => void;
  onSaveToHistory: (content: string) => void;
  onRestoreClip: (content: string) => void;
  onDeleteClip: (id: string) => void;
  onClearHistory: () => void;
  onBuzzDevices: () => void;
  onOpenScanner: () => void;
  onNewNote: () => void;
  onOpenPermissions?: () => void;
  remoteTypingDevice?: string | null;
}

export const AndroidApp: React.FC<AndroidAppProps> = ({
  note,
  connectedDevices,
  history,
  onTextChange,
  onColorChange,
  onSaveToHistory,
  onRestoreClip,
  onDeleteClip,
  onClearHistory,
  onOpenScanner,
  onNewNote,
  onOpenPermissions,
  remoteTypingDevice,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [savedClip, setSavedClip] = useState(false);
  const [showColorSheet, setShowColorSheet] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [detectedUrls, setDetectedUrls] = useState<string[]>([]);

  const colorScheme = COLOR_SCHEMES[note.color] || COLOR_SCHEMES.yellow;

  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = note.content.match(urlRegex) || [];
    setDetectedUrls(Array.from(new Set(matches)).slice(0, 3));
  }, [note.content]);

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

  const handleSave = () => {
    if (!note.content.trim()) return;
    triggerHaptic();
    onSaveToHistory(note.content);
    setSavedClip(true);
    setTimeout(() => setSavedClip(false), 1500);
  };

  const filteredHistory = history.filter((item) =>
    item.content.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.device.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col ${colorScheme.bgLight} ${colorScheme.bgDark} ${colorScheme.textLight} ${colorScheme.textDark} transition-colors duration-200 select-none pb-[env(safe-area-inset-bottom,0px)]`}>
      {/* Android Material 3 Top App Bar */}
      <header className={`h-14 px-4 flex items-center justify-between border-b ${colorScheme.borderLight} ${colorScheme.borderDark} ${colorScheme.headerLight} ${colorScheme.headerDark} shrink-0`}>
        {/* Left: App Logo & Label */}
        <div className="flex items-center gap-2.5">
          <AppLogo size="sm" />
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight leading-none">Write your note</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{connectedDevices.length} online</span>
            </span>
          </div>
        </div>

        {/* Right: Scan PC & Theme (Clear button removed) */}
        <div className="flex items-center gap-1.5">
          {/* Scan PC QR Code (Camera Scanner) */}
          <button
            onClick={() => {
              triggerHaptic();
              onOpenScanner();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Scan PC QR Code"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-600" />
            <span>Scan PC</span>
          </button>

          {/* Permissions Checklist */}
          {onOpenPermissions && (
            <button
              onClick={() => {
                triggerHaptic();
                onOpenPermissions();
              }}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer opacity-80 hover:opacity-100"
              title="App Permissions Checklist"
            >
              <ShieldCheck className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            </button>
          )}

          {/* Theme Color */}
          <button
            onClick={() => {
              triggerHaptic();
              setShowColorSheet(true);
            }}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer opacity-80 hover:opacity-100"
            title="Theme Color"
          >
            <Palette className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Typing indicator */}
      {remoteTypingDevice && (
        <div className="px-4 py-1 bg-amber-400/20 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-center gap-2 animate-pulse shrink-0">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          <span>PC is typing...</span>
        </div>
      )}

      {/* Main Touch-Friendly Writing Canvas */}
      <main className="flex-1 p-4 sm:p-6 flex flex-col min-h-0 overflow-hidden relative">
        <textarea
          ref={textareaRef}
          value={note.content}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Write your note..."
          className="w-full flex-1 h-full bg-transparent resize-none border-none outline-none focus:ring-0 text-base leading-relaxed placeholder:opacity-35 overflow-y-auto"
          spellCheck="true"
        />

        {/* URLs strip */}
        {detectedUrls.length > 0 && (
          <div className="pt-2 border-t border-black/10 dark:border-white/10 flex flex-wrap gap-1.5 shrink-0 mt-2">
            {detectedUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black/10 dark:bg-white/15 text-xs hover:underline font-mono truncate max-w-[240px]"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* "+ New Note" Floating Action Button (Replaced Paste Button) */}
      <div className="fixed bottom-16 right-5 z-20">
        <button
          onClick={() => {
            triggerHaptic();
            onNewNote();
          }}
          className="h-14 px-5 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold shadow-2xl flex items-center gap-2 active:scale-95 transition-all cursor-pointer border border-amber-500/30"
          title="Create a new blank note"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span className="text-sm">New Note</span>
        </button>
      </div>

      {/* Android Bottom Navigation Strip */}
      <footer className={`h-12 px-4 border-t ${colorScheme.borderLight} ${colorScheme.borderDark} bg-black/5 dark:bg-white/5 flex items-center justify-between shrink-0 select-none`}>
        {/* Stats */}
        <div className="flex items-center gap-2 font-mono text-[11px] opacity-60 tabular-nums">
          <span>{note.content.length} chars</span>
          <span>·</span>
          <span>{note.content.trim() ? note.content.trim().split(/\s+/).length : 0} words</span>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              triggerHaptic();
              setShowHistorySheet(true);
            }}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors relative cursor-pointer"
            title="Clipboard History"
          >
            <HistoryIcon className="w-5 h-5 opacity-75" />
            {history.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>

          <button
            onClick={handleCopy}
            disabled={!note.content}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
            title="Copy Note"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 opacity-75" />}
          </button>

          <button
            onClick={handleSave}
            disabled={!note.content.trim()}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
            title="Save to History"
          >
            {savedClip ? <Check className="w-5 h-5 text-emerald-500" /> : <BookmarkPlus className="w-5 h-5 opacity-75" />}
          </button>
        </div>
      </footer>

      {/* Android Bottom Sheet: Theme Colors */}
      {showColorSheet && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end animate-in fade-in"
          onClick={() => setShowColorSheet(false)}
        >
          <div 
            className="bg-neutral-900 border-t border-neutral-800 rounded-t-3xl p-5 text-neutral-100 space-y-3 animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              onClick={() => setShowColorSheet(false)} 
              className="w-12 h-1.5 bg-neutral-600/80 active:bg-neutral-500 rounded-full mx-auto -mt-1 mb-2 cursor-pointer"
              title="Swipe or tap to dismiss"
            />
            <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
              <span className="text-xs font-semibold text-neutral-300">Choose Note Color</span>
            </div>
            <div className="grid grid-cols-6 gap-2.5 py-2">
              {(Object.keys(COLOR_SCHEMES) as StickyColor[]).map((cKey) => {
                const isSelected = note.color === cKey;
                return (
                  <button
                    key={cKey}
                    onClick={() => {
                      triggerHaptic();
                      onColorChange(cKey);
                      setShowColorSheet(false);
                    }}
                    className={`h-11 rounded-2xl border flex items-center justify-center transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-amber-400 scale-105' : 'opacity-80 active:scale-95'
                    } ${
                      cKey === 'yellow' ? 'bg-amber-300 border-amber-400' :
                      cKey === 'mint' ? 'bg-emerald-300 border-emerald-400' :
                      cKey === 'lavender' ? 'bg-purple-300 border-purple-400' :
                      cKey === 'blue' ? 'bg-sky-300 border-sky-400' :
                      cKey === 'peach' ? 'bg-rose-300 border-rose-400' :
                      'bg-neutral-800 border-neutral-600'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Android Bottom Sheet: Clip History */}
      {showHistorySheet && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end animate-in fade-in"
          onClick={() => setShowHistorySheet(false)}
        >
          <div 
            className="bg-neutral-900 border-t border-neutral-800 rounded-t-3xl p-4 text-neutral-100 flex flex-col max-h-[75vh] animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              onClick={() => setShowHistorySheet(false)} 
              className="w-12 h-1.5 bg-neutral-600/80 active:bg-neutral-500 rounded-full mx-auto -mt-1 mb-2 cursor-pointer"
              title="Swipe or tap to dismiss"
            />
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <HistoryIcon className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold">History ({history.length})</span>
              </div>
              <div>
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      triggerHaptic();
                      onClearHistory();
                    }}
                    className="text-xs text-red-400 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="py-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search clippings..."
                  className="w-full pl-8 pr-3 py-1.5 bg-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 outline-none"
                />
              </div>
            </div>

            {/* History list */}
            <div className="flex-1 overflow-y-auto space-y-2 py-1">
              {filteredHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No clippings in history.
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-neutral-800/80 rounded-2xl space-y-1.5 border border-neutral-750"
                  >
                    <p className="text-xs font-mono text-neutral-200 whitespace-pre-wrap break-all line-clamp-3 select-all bg-neutral-900/80 p-2.5 rounded-xl">
                      {item.content}
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-0.5">
                      <button
                        onClick={async () => {
                          triggerHaptic();
                          await navigator.clipboard.writeText(item.content);
                        }}
                        className="px-3 py-1 bg-neutral-700 rounded-lg text-xs font-medium text-neutral-200 cursor-pointer active:scale-95"
                      >
                        Copy
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic();
                          onRestoreClip(item.content);
                          setShowHistorySheet(false);
                        }}
                        className="px-3 py-1 bg-amber-400 text-neutral-950 rounded-lg text-xs font-bold cursor-pointer active:scale-95"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
