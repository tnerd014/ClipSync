// Electron Main Process for Windows Sticky Notes (Serverless LAN Sync)
// Zero cloud servers, zero cloud databases
const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const os = require('os');
const http = require('http');
const fs = require('fs');
const { WebSocketServer, WebSocket } = require('ws');

let mainWindow = null;
let tray = null;
let embeddedServer = null;
let wss = null;
const LAN_PORT = 8432;

// In-memory sessions store
const sessions = new Map();
const clients = new Map(); // ws -> clientMeta

function getOrCreateSession(sessionId) {
  const normalized = (sessionId || 'DEFAULT').trim().toUpperCase();
  let session = sessions.get(normalized);
  if (!session) {
    session = {
      note: {
        id: 'note-1',
        content: `👋 Welcome to your synced Sticky Note!\n\n📱 Scan the QR code or share this room code to open this note on your phone or tablet.\n\n⚡ Anything you type or paste here appears instantly across all your devices in real-time.`,
        color: 'yellow',
        fontSize: 'base',
        updatedAt: Date.now(),
        updatedBy: 'ClipSync Desktop',
      },
      history: [],
    };
    sessions.set(normalized, session);
  }
  return session;
}

function getSessionClients(sessionId) {
  const result = [];
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

function broadcastToSession(sessionId, payload, senderWs) {
  const json = JSON.stringify(payload);
  for (const [ws, meta] of clients.entries()) {
    if (meta.sessionId === sessionId && ws.readyState === WebSocket.OPEN) {
      if (!senderWs || ws !== senderWs) {
        ws.send(json);
      }
    }
  }
}

// Get local network IPv4 address (e.g. 192.168.1.50)
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address !== '127.0.0.1') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// MIME types for serving static web files over LAN
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Start embedded local HTTP + WebSocket server inside Electron
function startEmbeddedLanServer() {
  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // API: Health / LAN Info
    if (pathname === '/api/lan-info' || pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'online',
        ip: getLocalIpAddress(),
        port: LAN_PORT,
        device: 'Windows Desktop (ClipSync)',
        clients: clients.size,
      }));
      return;
    }

    // Static Web App Serving over LAN
    const distDir = path.join(__dirname, 'dist');
    let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);

    // Security check: ensure path is within distDir
    if (!filePath.startsWith(distDir)) {
      filePath = path.join(distDir, 'index.html');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA client-side routing
        const indexPath = path.join(distDir, 'index.html');
        fs.readFile(indexPath, (readErr, content) => {
          if (readErr) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ClipSync Windows LAN Host Active');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content);
          }
        });
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500);
          res.end('Server Error');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    });
  });

  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let currentSessionId = '';

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());

        if (msg.type === 'join') {
          currentSessionId = (msg.sessionId || 'DEFAULT').trim().toUpperCase();
          const session = getOrCreateSession(currentSessionId);

          clients.set(ws, {
            ws,
            sessionId: currentSessionId,
            deviceId: msg.deviceId || 'dev-' + Math.random().toString(36).substring(2, 7),
            deviceName: msg.deviceName || 'Phone / Remote Device',
            deviceType: msg.deviceType || 'mobile',
          });

          // Send full current note & history back to newly connected device
          ws.send(JSON.stringify({
            type: 'sync',
            sessionId: currentSessionId,
            note: session.note,
            history: session.history,
            clients: getSessionClients(currentSessionId),
          }));

          // Notify everyone in session
          broadcastToSession(currentSessionId, {
            type: 'presence',
            clients: getSessionClients(currentSessionId),
            event: 'joined',
            deviceName: msg.deviceName,
          });

          // Notify Electron UI
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lan:client-count', getSessionClients(currentSessionId).length);
          }
        } else if (msg.type === 'text:update') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);
          session.note.content = msg.content;
          session.note.updatedAt = Date.now();
          session.note.updatedBy = msg.deviceName || 'Connected Device';

          broadcastToSession(currentSessionId, {
            type: 'text:update',
            content: msg.content,
            updatedAt: session.note.updatedAt,
            updatedBy: session.note.updatedBy,
            senderDeviceId: msg.deviceId,
          }, ws);

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lan:message', {
              type: 'text:update',
              content: msg.content,
              deviceName: msg.deviceName,
            });
          }
        } else if (msg.type === 'style:update') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);
          if (msg.color) session.note.color = msg.color;
          if (msg.fontSize) session.note.fontSize = msg.fontSize;

          broadcastToSession(currentSessionId, {
            type: 'style:update',
            color: msg.color,
            fontSize: msg.fontSize,
          }, ws);
        } else if (msg.type === 'history:add') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);
          if (msg.clip) {
            session.history.unshift(msg.clip);
            if (session.history.length > 50) session.history.pop();
            broadcastToSession(currentSessionId, {
              type: 'history:update',
              history: session.history,
            });
          }
        } else if (msg.type === 'ping:buzz') {
          if (!currentSessionId) return;
          broadcastToSession(currentSessionId, {
            type: 'ping:notify',
            fromDevice: msg.deviceName || 'Device',
          }, ws);
        }
      } catch (err) {
        console.error('[ClipSync] Error parsing WS message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      if (currentSessionId) {
        broadcastToSession(currentSessionId, {
          type: 'presence',
          clients: getSessionClients(currentSessionId),
          event: 'left',
        });
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lan:client-count', clients.size);
      }
    });
  });

  server.listen(LAN_PORT, '0.0.0.0', () => {
    console.log(`[ClipSync] Embedded LAN Host listening on http://${getLocalIpAddress()}:${LAN_PORT}`);
  });

  embeddedServer = server;
}

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, 'icon.ico'))
    ? path.join(__dirname, 'icon.ico')
    : path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 480,
    height: 620,
    minWidth: 320,
    minHeight: 400,
    frame: false, // Windows 11 frameless sticky note
    transparent: false,
    show: false, // Prevent white/transparent flash before HTML finishes loading
    backgroundColor: '#171717',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows seamless local LAN asset loading
    },
  });

  // Gracefully show window once DOM is painted
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Safety fallback: if ready-to-show does not fire within 2.5s, force display
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 2500);

  // Robust HTML location resolution for both development and packaged .exe modes
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // Check possible dist locations
    const candidatePaths = [
      path.join(__dirname, 'dist', 'index.html'),
      path.join(__dirname, '../dist', 'index.html'),
      path.join(app.getAppPath(), 'dist', 'index.html'),
      path.join(__dirname, 'index.html'),
    ];

    let found = false;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        console.log('[ClipSync] Loading HTML from:', p);
        mainWindow.loadFile(p);
        found = true;
        break;
      }
    }

    if (!found) {
      console.error('[ClipSync] CRITICAL: Could not find index.html in candidates:', candidatePaths);
      mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head><title>ClipSync</title></head>
        <body style="background:#171717;color:#fde047;font-family:sans-serif;padding:30px;text-align:center;">
          <h2>ClipSync Windows Host</h2>
          <p style="color:#e2e8f0;">LAN Server is running on port ${LAN_PORT}.</p>
          <p style="color:#94a3b8;font-size:12px;">Local IP: ${getLocalIpAddress()}</p>
        </body>
        </html>
      `));
    }
  }

  // Window control IPC handlers
  ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow && mainWindow.hide());
  ipcMain.on('window:set-always-on-top', (e, flag) => mainWindow && mainWindow.setAlwaysOnTop(flag));

  // LAN network info
  ipcMain.handle('lan:get-info', () => {
    return {
      ip: getLocalIpAddress(),
      port: LAN_PORT,
      clients: clients.size,
    };
  });

  // Broadcast to all connected Android devices
  ipcMain.on('lan:broadcast', (e, payload) => {
    const currentSessionId = payload.sessionId || 'DEFAULT';
    broadcastToSession(currentSessionId, payload);
  });
}

function createTray() {
  try {
    const iconPath = fs.existsSync(path.join(__dirname, 'icon.ico'))
      ? path.join(__dirname, 'icon.ico')
      : path.join(__dirname, 'icon.png');

    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Show Sticky Note', 
        click: () => { 
          if (mainWindow) { 
            mainWindow.show(); 
            mainWindow.focus(); 
          } 
        } 
      },
      { label: `LAN Host: ${getLocalIpAddress()}:${LAN_PORT}`, enabled: false },
      { type: 'separator' },
      { label: 'Quit ClipSync', click: () => app.quit() },
    ]);
    tray.setToolTip('ClipSync - Local Clipboard Sync');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  } catch (err) {
    console.warn('[ClipSync] Tray icon initialization skipped:', err.message);
  }
}

// Single instance lock (prevent multiple background instances)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startEmbeddedLanServer();
    createWindow();
    createTray();

    // Global hotkey: Ctrl+Alt+S to toggle Sticky Note
    try {
      globalShortcut.register('CommandOrControl+Alt+S', () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
    } catch {
      // Hotkey registration optional
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch {}
  if (embeddedServer) {
    embeddedServer.close();
  }
});
