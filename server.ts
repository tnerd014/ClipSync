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
  note: NoteState;
  history: ClipItem[];
}

// In-memory sessions store
const sessions = new Map<string, SessionData>();
const clients = new Map<WebSocket, ClientMeta>();

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getOrCreateSession(sessionId: string): SessionData {
  const normalized = sessionId.trim().toUpperCase() || 'DEFAULT';
  let session = sessions.get(normalized);
  if (!session) {
    session = {
      pin: generatePin(),
      note: {
        id: 'note-1',
        content: `👋 Welcome to your synced Sticky Note!\n\n📱 Scan the QR code or share this room code to open this note on your phone or tablet.\n\n⚡ Anything you type or paste here appears instantly across all your devices in real-time.`,
        color: 'amber',
        fontSize: 'base',
        updatedAt: Date.now(),
        updatedBy: 'ClipSync Bot',
        rev: 1,
      },
      history: [
        {
          id: 'clip-demo-1',
          content: 'https://github.com',
          timestamp: Date.now() - 1000 * 60 * 5,
          device: 'PC Desktop',
          deviceType: 'desktop',
          category: 'url',
        },
        {
          id: 'clip-demo-2',
          content: 'Verification Code: 482-910',
          timestamp: Date.now() - 1000 * 60 * 15,
          device: 'iPhone 15',
          deviceType: 'mobile',
          category: 'number',
        },
      ],
    };
    sessions.set(normalized, session);
  }
  return session;
}

function broadcastToSession(sessionId: string, payload: any, senderWs?: WebSocket) {
  const json = JSON.stringify(payload);
  for (const [ws, meta] of clients.entries()) {
    if (meta.sessionId === sessionId && ws.readyState === WebSocket.OPEN) {
      if (!senderWs || ws !== senderWs) {
        ws.send(json);
      }
    }
  }
}

function getSessionClients(sessionId: string) {
  const result: Array<{ deviceId: string; deviceName: string; deviceType: string; isTyping?: boolean }> = [];
  for (const [, meta] of clients.entries()) {
    if (meta.sessionId === sessionId) {
      result.push({
        deviceId: meta.deviceId,
        deviceName: meta.deviceName,
        deviceType: meta.deviceType,
        isTyping: meta.isTyping,
      });
    }
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
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.get('/api/session/:id', (req, res) => {
    const session = getOrCreateSession(req.params.id);
    res.json({
      sessionId: req.params.id.toUpperCase(),
      note: session.note,
      history: session.history,
      activeDevices: getSessionClients(req.params.id.toUpperCase()).length,
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
    const sessionId = req.params.id.toUpperCase();
    const session = getOrCreateSession(sessionId);
    const text = req.body.text || '';
    const device = req.body.device || 'API / Webhook';

    if (!text.trim()) {
      return res.status(400).json({ error: 'Text cannot be empty' });
    }

    session.note.content = text;
    session.note.updatedAt = Date.now();
    session.note.updatedBy = device;

    // Detect category
    let category: 'note' | 'code' | 'url' | 'number' = 'note';
    if (/^https?:\/\//i.test(text.trim())) {
      category = 'url';
    } else if (text.includes('\n') && (text.includes('function') || text.includes('import ') || text.includes('const '))) {
      category = 'code';
    } else if (/^\d{3,8}$/.test(text.trim()) || /^\d{3}[-\s]\d{3}$/.test(text.trim())) {
      category = 'number';
    }

    const newClip: ClipItem = {
      id: 'clip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      content: text,
      timestamp: Date.now(),
      device: device,
      deviceType: 'desktop',
      category,
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
    let currentSessionId = '';

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
          const rawId = (msg.sessionId || 'DEFAULT').trim().toUpperCase();
          currentSessionId = rawId;
          const session = getOrCreateSession(currentSessionId);

          // If PIN is set and client does not supply matching PIN
          if (session.pin && msg.pin && msg.pin.trim() !== session.pin) {
            ws.send(JSON.stringify({
              type: 'auth:error',
              sessionId: currentSessionId,
              requiresPin: true,
              message: 'Incorrect pairing PIN. Please enter the 4-digit PIN displayed on your PC screen.',
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

          // Send immediate initial sync with PIN
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

          // Broadcast updated presence to all clients in session
          broadcastToSession(currentSessionId, {
            type: 'presence',
            clients: getSessionClients(currentSessionId),
            event: 'joined',
            deviceName: msg.deviceName,
          });
        } else if (msg.type === 'pin:update') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);
          if (msg.pin && msg.pin.trim()) {
            session.pin = msg.pin.trim();
            broadcastToSession(currentSessionId, {
              type: 'pin:updated',
              pin: session.pin,
            });
          }
        } else if (msg.type === 'text:update') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);

          const nextRev = Math.max(session.note.rev || 0, msg.rev || 0) + 1;
          session.note.rev = nextRev;
          session.note.content = msg.content;
          session.note.updatedAt = Date.now();
          session.note.updatedBy = msg.deviceName || 'Connected Device';

          // Broadcast update to others
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
            ws // don't echo back to sender to prevent cursor jumps
          );
        } else if (msg.type === 'style:update') {
          if (!currentSessionId) return;
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
        } else if (msg.type === 'clip:save') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);
          const text = msg.content || '';
          if (!text.trim()) return;

          let category: 'note' | 'code' | 'url' | 'number' = 'note';
          if (/^https?:\/\//i.test(text.trim())) {
            category = 'url';
          } else if (text.includes('\n') && (text.includes('function') || text.includes('import ') || text.includes('const ') || text.includes('def '))) {
            category = 'code';
          } else if (/^\d{3,8}$/.test(text.trim()) || /^\d{3}[-\s]\d{3}$/.test(text.trim())) {
            category = 'number';
          }

          const clip: ClipItem = {
            id: 'clip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            content: text,
            timestamp: Date.now(),
            device: msg.deviceName || 'Device',
            deviceType: msg.deviceType || 'desktop',
            category,
          };
          session.history.unshift(clip);
          if (session.history.length > 50) session.history.pop();

          broadcastToSession(currentSessionId, {
            type: 'history:update',
            history: session.history,
            newClip: clip,
          });
        } else if (msg.type === 'clip:delete') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);
          session.history = session.history.filter((c) => c.id !== msg.clipId);

          broadcastToSession(currentSessionId, {
            type: 'history:update',
            history: session.history,
          });
        } else if (msg.type === 'clip:clear_history') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);
          session.history = [];

          broadcastToSession(currentSessionId, {
            type: 'history:update',
            history: [],
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
