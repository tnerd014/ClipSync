import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClipItem {
  id: string;
  content: string;
  timestamp: number;
  device: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  category?: 'note' | 'code' | 'url' | 'number';
}

interface NoteState {
  id: string;
  content: string;
  color: string;
  fontSize: 'sm' | 'base' | 'lg';
  updatedAt: number;
  updatedBy: string;
  rev?: number;
}

interface ClientMeta {
  ws: WebSocket;
  sessionId: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  isTyping?: boolean;
}

interface SessionData {
  pin: string;
  note: NoteState & { isDefault?: boolean };
  history: ClipItem[];
  deletedIds: Set<string>;
  deletedContents: Set<string>;
  lastClearedAt: number;
}

// In-memory sessions store
const sessions = new Map<string, SessionData>();
const clients = new Map<WebSocket, ClientMeta>();

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getOrCreateSession(sessionId: string): SessionData {
  const normalized = 'DEFAULT';
  let session = sessions.get(normalized);
  if (!session) {
    session = {
      pin: generatePin(),
      note: {
        id: 'note-1',
        content: '',
        color: 'amber',
        fontSize: 'base',
        updatedAt: 0,
        updatedBy: 'ClipSync',
        rev: 1,
        isDefault: true,
      },
      history: [],
      deletedIds: new Set(),
      deletedContents: new Set(),
      lastClearedAt: 0,
    };
    sessions.set(normalized, session);
  }
  return session;
}

function broadcastToSession(sessionId: string, payload: any, senderWs?: WebSocket) {
  const json = JSON.stringify(payload);
  for (const [ws] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      if (!senderWs || ws !== senderWs) {
        ws.send(json);
      }
    }
  }
}

function getSessionClients(sessionId: string) {
  const result: Array<{ deviceId: string; deviceName: string; deviceType: string; isTyping?: boolean }> = [];
  for (const [, meta] of clients.entries()) {
    result.push({
      deviceId: meta.deviceId,
      deviceName: meta.deviceName,
      deviceType: meta.deviceType,
      isTyping: meta.isTyping,
    });
  }
  return result;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json({ limit: '10mb' }));

  // API endpoints
  app.get('/api/health', (req, res) => {
    const defaultSession = getOrCreateSession('DEFAULT');
    res.json({ status: 'ok', pin: defaultSession.pin, timestamp: Date.now() });
  });

  app.get('/api/session/:id', (req, res) => {
    const session = getOrCreateSession(req.params.id);
    res.json({
      sessionId: 'DEFAULT',
      note: session.note,
      history: session.history,
      activeDevices: getSessionClients('DEFAULT').length,
    });
  });

  // Direct Binary Downloads for Windows Desktop
  app.get('/api/download/windows-exe', (req, res) => {
    const exePath = path.resolve(__dirname, 'electron/dist-electron/win-unpacked/ClipSync.exe');
    res.download(exePath, 'ClipSync.exe', (err) => {
      if (err) {
        console.error('Error downloading ClipSync.exe:', err);
        res.status(404).send('Executable is being compiled. Please try again in a few moments.');
      }
    });
  });

  app.get('/api/download/windows-bundle', (req, res) => {
    const bundlePath = path.resolve(__dirname, 'electron/dist-electron/ClipSync-Windows-x64.tar.gz');
    res.download(bundlePath, 'ClipSync-Windows-x64.tar.gz', (err) => {
      if (err) {
        console.error('Error downloading Windows bundle:', err);
        res.status(404).send('Bundle not found.');
      }
    });
  });

  // REST paste endpoint for quick webhooks / script integration
  app.post('/api/session/:id/paste', (req, res) => {
    const sessionId = 'DEFAULT';
    const session = getOrCreateSession(sessionId);
    const text = req.body.text || '';
    const device = req.body.device || 'API / Webhook';

    if (!text.trim()) {
      return res.status(400).json({ error: 'Text cannot be empty' });
    }

    session.note.content = text;
    session.note.updatedAt = Date.now();
    session.note.updatedBy = device;
    session.note.isDefault = false;

    const newClip: ClipItem = {
      id: 'clip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      content: text,
      timestamp: Date.now(),
      device: device,
      deviceType: 'desktop',
      category: 'note',
    };
    session.history.unshift(newClip);
    if (session.history.length > 50) session.history.pop();

    broadcastToSession(sessionId, {
      type: 'sync',
      note: session.note,
      history: session.history,
      clients: getSessionClients(sessionId),
    });

    res.json({ success: true, clipId: newClip.id });
  });

  // WebSocket connections
  wss.on('connection', (ws) => {
    let currentSessionId = 'DEFAULT';

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Heartbeat ping/pong
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: msg.timestamp || Date.now(),
            serverTime: Date.now(),
          }));
          return;
        }

        if (msg.type === 'join') {
          currentSessionId = 'DEFAULT';
          const session = getOrCreateSession(currentSessionId);

          if (!msg.isDesktop && session.pin && msg.pin && msg.pin.trim() !== session.pin) {
            ws.send(JSON.stringify({
              type: 'auth:error',
              sessionId: currentSessionId,
              requiresPin: true,
              message: 'Incorrect PIN',
            }));
            return;
          }

          clients.set(ws, {
            ws,
            sessionId: currentSessionId,
            deviceId: msg.deviceId || 'dev-' + Math.random().toString(36).substring(2, 7),
            deviceName: msg.deviceName || 'Browser',
            deviceType: msg.deviceType || 'desktop',
          });

          // 1. Smart Active Note Resolution on Handshake
          if (msg.note && typeof msg.note.content === 'string') {
            const incomingText = msg.note.content.trim();
            const existingText = (session.note.content || '').trim();
            const incomingTime = msg.note.updatedAt || 0;
            const existingTime = session.note.updatedAt || 0;

            if (session.note.isDefault || !existingText) {
              if (incomingText) {
                session.note = {
                  ...session.note,
                  content: msg.note.content,
                  updatedAt: incomingTime || Date.now(),
                  updatedBy: msg.deviceName || 'Device',
                  rev: Math.max(session.note.rev || 1, msg.note.rev || 1),
                  isDefault: false,
                };
              }
            } else if (incomingText && incomingText !== existingText) {
              if (incomingTime > existingTime) {
                const archivedOld: ClipItem = {
                  id: `clip-${Date.now()}-arch`,
                  content: existingText,
                  timestamp: existingTime || Date.now() - 1000,
                  device: session.note.updatedBy || 'PC',
                  deviceType: 'desktop',
                };
                if (!session.history.some((c) => c.content.trim() === existingText)) {
                  session.history = [archivedOld, ...session.history].slice(0, 50);
                }
                session.note = {
                  ...session.note,
                  content: msg.note.content,
                  updatedAt: incomingTime,
                  updatedBy: msg.deviceName || 'Phone',
                  rev: (session.note.rev || 1) + 1,
                  isDefault: false,
                };
              } else {
                const archivedIncoming: ClipItem = {
                  id: `clip-${Date.now()}-arch`,
                  content: incomingText,
                  timestamp: incomingTime || Date.now() - 1000,
                  device: msg.deviceName || 'Phone',
                  deviceType: msg.deviceType || 'mobile',
                };
                if (!session.history.some((c) => c.content.trim() === incomingText)) {
                  session.history = [archivedIncoming, ...session.history].slice(0, 50);
                }
              }
            }
          }

          // 2. 2-Way History Merge with Tombstone Filtering
          if (Array.isArray(msg.history) && msg.history.length > 0) {
            const combined = [...session.history];
            for (const incomingClip of msg.history) {
              if (!incomingClip || !incomingClip.content) continue;
              const cleanContent = incomingClip.content.trim();
              if (!cleanContent) continue;

              if (session.lastClearedAt && (incomingClip.timestamp || 0) <= session.lastClearedAt) continue;
              if (session.deletedIds.has(incomingClip.id) || session.deletedContents.has(cleanContent)) continue;

              if (!combined.some((c) => c.id === incomingClip.id || c.content.trim() === cleanContent)) {
                combined.push(incomingClip);
              }
            }
            combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            session.history = combined.slice(0, 50);

            broadcastToSession(
              currentSessionId,
              {
                type: 'history:update',
                history: session.history,
              },
              ws
            );
          }

          ws.send(
            JSON.stringify({
              type: 'sync',
              sessionId: currentSessionId,
              pin: session.pin,
              note: session.note,
              history: session.history,
              clients: getSessionClients(currentSessionId),
            })
          );

          broadcastToSession(currentSessionId, {
            type: 'presence',
            clients: getSessionClients(currentSessionId),
            event: 'joined',
            deviceName: msg.deviceName,
          });
        } else if (msg.type === 'pin:update') {
          const session = getOrCreateSession(currentSessionId);
          if (msg.pin && msg.pin.trim()) {
            session.pin = msg.pin.trim();
            broadcastToSession(currentSessionId, {
              type: 'pin:updated',
              pin: session.pin,
            });
          }
        } else if (msg.type === 'text:update') {
          const session = getOrCreateSession(currentSessionId);

          const nextRev = Math.max(session.note.rev || 0, msg.rev || 0) + 1;
          session.note.rev = nextRev;
          session.note.content = msg.content;
          session.note.updatedAt = Date.now();
          session.note.updatedBy = msg.deviceName || 'Connected Device';
          session.note.isDefault = false;

          broadcastToSession(
            currentSessionId,
            {
              type: 'text:update',
              content: msg.content,
              rev: nextRev,
              updatedAt: session.note.updatedAt,
              updatedBy: session.note.updatedBy,
              senderDeviceId: msg.deviceId,
            },
            ws
          );
        } else if (msg.type === 'style:update') {
          const session = getOrCreateSession(currentSessionId);
          if (msg.color) session.note.color = msg.color;
          if (msg.fontSize) session.note.fontSize = msg.fontSize;
          session.note.updatedAt = Date.now();

          broadcastToSession(currentSessionId, {
            type: 'style:update',
            color: session.note.color,
            fontSize: session.note.fontSize,
            updatedAt: session.note.updatedAt,
          });
        } else if (msg.type === 'history:add') {
          const session = getOrCreateSession(currentSessionId);
          if (msg.clip && msg.clip.content) {
            const clean = msg.clip.content.trim();
            session.deletedContents.delete(clean);
            session.deletedIds.delete(msg.clip.id);
            session.history = [msg.clip, ...session.history.filter((c) => c.id !== msg.clip.id && c.content.trim() !== clean)].slice(0, 50);
            broadcastToSession(currentSessionId, {
              type: 'history:update',
              history: session.history,
            });
          }
        } else if (msg.type === 'clip:save') {
          const session = getOrCreateSession(currentSessionId);
          const text = msg.content || '';
          if (!text.trim()) return;

          const clip: ClipItem = {
            id: 'clip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            content: text,
            timestamp: Date.now(),
            device: msg.deviceName || 'Device',
            deviceType: msg.deviceType || 'desktop',
            category: 'note',
          };
          session.history.unshift(clip);
          if (session.history.length > 50) session.history.pop();

          broadcastToSession(currentSessionId, {
            type: 'history:update',
            history: session.history,
            newClip: clip,
          });
        } else if (msg.type === 'clip:delete') {
          const session = getOrCreateSession(currentSessionId);
          if (msg.clipId) session.deletedIds.add(msg.clipId);
          if (msg.clipContent) session.deletedContents.add(msg.clipContent.trim());
          for (const c of session.history) {
            if (c.id === msg.clipId) {
              session.deletedContents.add(c.content.trim());
            }
          }
          session.history = session.history.filter((c) => c.id !== msg.clipId && (!msg.clipContent || c.content.trim() !== msg.clipContent.trim()));

          broadcastToSession(currentSessionId, {
            type: 'history:update',
            history: session.history,
          });
        } else if (msg.type === 'history:update' || msg.type === 'clip:clear_history') {
          const session = getOrCreateSession(currentSessionId);
          const nextHistory = Array.isArray(msg.history) ? msg.history : [];
          if (nextHistory.length === 0) {
            session.lastClearedAt = Date.now();
            session.deletedIds.clear();
            session.deletedContents.clear();
          }
          session.history = nextHistory;

          broadcastToSession(currentSessionId, {
            type: 'history:update',
            history: session.history,
          });
        } else if (msg.type === 'ping:notify') {
          if (!currentSessionId) return;
          // Notify other devices (e.g. beep, haptic, visual bounce)
          broadcastToSession(
            currentSessionId,
            {
              type: 'ping:notify',
              fromDevice: msg.deviceName || 'Device',
              timestamp: Date.now(),
            },
            ws
          );
        } else if (msg.type === 'typing') {
          if (!currentSessionId) return;
          const meta = clients.get(ws);
          if (meta) {
            meta.isTyping = !!msg.isTyping;
          }
          broadcastToSession(
            currentSessionId,
            {
              type: 'presence',
              clients: getSessionClients(currentSessionId),
            },
            ws
          );
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      if (meta) {
        const sid = meta.sessionId;
        const name = meta.deviceName;
        clients.delete(ws);
        broadcastToSession(sid, {
          type: 'presence',
          clients: getSessionClients(sid),
          event: 'left',
          deviceName: name,
        });
      }
    });
  });

  // Serve static assets in production or Vite middleware in development
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ClipSync full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
