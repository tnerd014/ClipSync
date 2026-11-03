import React, { useRef, useState, useEffect } from 'react';
import { 
  Clipboard, 
  Copy, 
  Check, 
  BookmarkPlus, 
  ExternalLink, 
  Minus, 
  Square, 
  X, 
  History as HistoryIcon,
  Search,
  Wifi,
  Pin,
  Plus
} from 'lucide-react';
import { NoteState, StickyColor, ClipItem, ConnectedDevice } from '../types';
import { COLOR_SCHEMES } from '../utils/device';
import { AppLogo } from '../components/AppLogo';

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
  onTextChange,
  onColorChange,
  onFontSizeChange,
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
  const [savedClip, setSavedClip] = useState(false);
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
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

  const handleSave = () => {
    if (!note.content.trim()) return;
    onSaveToHistory(note.content);
    setSavedClip(true);
    setTimeout(() => setSavedClip(false), 1500);
  };

  const toggleAlwaysOnTop = () => {
    const next = !isPinned;
    setIsPinned(next);
    if ((window as any).electronAPI?.setAlwaysOnTop) {
      (window as any).electronAPI.setAlwaysOnTop(next);
    }
  };

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

  const fontSizeClass = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base sm:text-lg leading-relaxed',
    lg: 'text-lg sm:text-xl leading-relaxed font-medium',
  }[note.fontSize || 'base'];

  const filteredHistory = history.filter((item) =>
    item.content.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.device.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col ${colorScheme.bgLight} ${colorScheme.bgDark} ${colorScheme.textLight} ${colorScheme.textDark} transition-colors duration-200 select-none`}>
      {/* Windows 11 Titlebar */}
      <header className={`h-10 px-3 flex items-center justify-between border-b ${colorScheme.borderLight} ${colorScheme.borderDark} ${colorScheme.headerLight} ${colorScheme.headerDark} select-none shrink-0`}>
        {/* Left: + New Note Button (authentic Windows Sticky Note icon), App Logo & Title */}
        <div className="flex items-center gap-2">
          <button
            onClick={onNewNote}
            className="w-6 h-6 rounded hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title="New note (+)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          <AppLogo size="xs" />
          <span className="text-xs font-bold tracking-tight">Write your note</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Connected"></span>
        </div>

        {/* Center: Remote typing */}
        {remoteTypingDevice && (
          <div className="text-xs text-amber-700 dark:text-amber-300 font-medium animate-pulse">
            Typing...
          </div>
        )}

        {/* Right: Wi-Fi Settings, Pin, Window Controls */}
        <div className="flex items-center gap-0.5">
          {/* Wi-Fi Settings */}
          <button
            onClick={onOpenLanModal}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer mr-0.5"
            title="Wi-Fi Settings"
          >
            <Wifi className="w-3.5 h-3.5" />
          </button>

          {/* Pin */}
          <button
            onClick={toggleAlwaysOnTop}
            className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer mr-1 ${
              isPinned ? 'text-amber-500 font-bold' : 'opacity-60 hover:opacity-100'
            }`}
            title={isPinned ? 'Pinned on top' : 'Pin on top'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* Window Titlebar Controls */}
          <div className="flex items-center">
            <button 
              onClick={handleMinimize}
              className="w-8 h-7 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button 
              onClick={handleMaximize}
              className="w-8 h-7 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button 
              onClick={handleClose}
              className="w-8 h-7 flex items-center justify-center hover:bg-red-500 hover:text-white text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* Minimalist Command Strip */}
      <div className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 ${colorScheme.borderLight} ${colorScheme.borderDark} bg-black/5 dark:bg-white/5 select-none shrink-0`}>
        {/* Colors & Size */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {(Object.keys(COLOR_SCHEMES) as StickyColor[]).map((cKey) => {
              const isSelected = note.color === cKey;
              return (
                <button
                  key={cKey}
                  onClick={() => onColorChange(cKey)}
                  className={`w-4 h-4 rounded-full transition-all cursor-pointer border ${
                    isSelected ? 'ring-2 ring-neutral-900 dark:ring-white scale-110' : 'opacity-65 hover:opacity-100'
                  } ${
                    cKey === 'yellow' ? 'bg-amber-300 border-amber-400' :
                    cKey === 'mint' ? 'bg-emerald-300 border-emerald-400' :
                    cKey === 'lavender' ? 'bg-purple-300 border-purple-400' :
                    cKey === 'blue' ? 'bg-sky-300 border-sky-400' :
                    cKey === 'peach' ? 'bg-rose-300 border-rose-400' :
                    'bg-neutral-800 border-neutral-600'
                  }`}
                  title={COLOR_SCHEMES[cKey].name}
                />
              );
            })}
          </div>

          <div className="flex items-center bg-black/10 dark:bg-white/10 rounded p-0.5 text-xs">
            {(['sm', 'base', 'lg'] as const).map((size) => (
              <button
                key={size}
                onClick={() => onFontSizeChange(size)}
                className={`px-1.5 py-0.2 rounded text-[11px] transition-colors ${
                  note.fontSize === size
                    ? 'bg-white dark:bg-neutral-800 font-bold shadow-xs'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                {size === 'sm' ? 'S' : size === 'base' ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions (Paste, Copy, History) */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={onNewNote}
            className="px-2 py-0.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded flex items-center gap-1 transition-colors cursor-pointer text-xs"
            title="New note"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <span>New</span>
          </button>

          <button
            onClick={handlePaste}
            className="px-2 py-0.5 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 font-medium rounded flex items-center gap-1 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            title="Paste (Ctrl+V)"
          >
            {pasted ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
            <span>{pasted ? 'Pasted' : 'Paste'}</span>
          </button>

          <button
            onClick={handleCopy}
            disabled={!note.content}
            className="px-2 py-0.5 bg-black/10 dark:bg-white/15 hover:bg-black/15 disabled:opacity-40 rounded flex items-center gap-1 transition-colors cursor-pointer"
            title="Copy (Ctrl+C)"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => setIsHistorySidebarOpen(!isHistorySidebarOpen)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isHistorySidebarOpen ? 'bg-amber-400 text-neutral-950' : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-75'
            }`}
            title="History"
          >
            <HistoryIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Body: Writing Area + Collapsible History */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className="flex-1 p-5 sm:p-6 flex flex-col min-h-0 overflow-hidden relative">
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Write your note..."
            className={`w-full flex-1 h-full bg-transparent resize-none border-none outline-none focus:ring-0 ${fontSizeClass} placeholder:opacity-35 leading-relaxed overflow-y-auto`}
            spellCheck="true"
            autoFocus
          />

          {detectedUrls.length > 0 && (
            <div className="pt-2 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center gap-1.5 mt-2 shrink-0">
              {detectedUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/10 dark:bg-white/15 text-xs hover:underline font-mono truncate max-w-xs"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{url}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Minimalist History Sidebar */}
        {isHistorySidebarOpen && (
          <div className="w-72 border-l border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col min-h-0 select-none animate-in slide-in-from-right duration-150">
            <div className="p-2.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <span className="text-xs font-semibold">History ({history.length})</span>
              <button
                onClick={() => setIsHistorySidebarOpen(false)}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-2 border-b border-black/10 dark:border-white/10">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1 bg-black/10 dark:bg-white/10 rounded text-xs outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredHistory.length === 0 ? (
                <div className="py-8 text-center text-xs opacity-50">
                  No clippings.
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded bg-black/5 dark:bg-white/5 space-y-1 group"
                  >
                    <p className="text-xs font-mono whitespace-pre-wrap break-all line-clamp-2 select-all">
                      {item.content}
                    </p>

                    <div className="flex items-center justify-end gap-1 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(item.content);
                        }}
                        className="px-2 py-0.5 bg-black/10 dark:bg-white/10 rounded text-[11px] cursor-pointer"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => onRestoreClip(item.content)}
                        className="px-2 py-0.5 bg-amber-400 text-neutral-950 font-bold rounded text-[11px] cursor-pointer"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Clean Status Footer */}
      <footer className={`h-6 px-3 border-t ${colorScheme.borderLight} ${colorScheme.borderDark} bg-black/5 dark:bg-white/5 flex items-center justify-between text-[11px] font-mono opacity-60 select-none shrink-0`}>
        <span>{note.content.length} chars · {note.content.trim() ? note.content.trim().split(/\s+/).length : 0} words</span>
        <span>Synced</span>
      </footer>
    </div>
  );
};
