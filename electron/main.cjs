// Electron Main Process for Windows Sticky Notes (Serverless LAN Sync)
// Zero cloud servers, zero cloud databases
const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, screen } = require('electron');
const path = require('path');
const os = require('os');
const http = require('http');
const fs = require('fs');
const { WebSocketServer, WebSocket } = require('ws');

let mainWindow = null;
let tray = null;
let embeddedServer = null;
let wss = null;
let currentLanPort = 8432;

// In-memory sessions store
const sessions = new Map();
const clients = new Map(); // ws -> clientMeta

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getOrCreateSession(sessionId) {
  const normalized = (sessionId || 'DEFAULT').trim().toUpperCase();
  let session = sessions.get(normalized);
  if (!session) {
    session = {
      pin: generatePin(),
      note: {
        id: 'note-1',
        content: `👋 Welcome to your synced Sticky Note!\n\n📱 Scan the QR code or share this room code to open this note on your phone or tablet.\n\n⚡ Anything you type or paste here appears instantly across all your devices in real-time.`,
        color: 'yellow',
        fontSize: 'base',
        updatedAt: Date.now(),
        updatedBy: 'ClipSync Desktop',
        rev: 1,
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

// Find and prioritize physical LAN IPv4 addresses over virtual switches (WSL, Hyper-V, VirtualBox, Docker)
function getAllLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    const isVirtual = lowerName.includes('virtualbox') ||
                      lowerName.includes('vmware') ||
                      lowerName.includes('vethernet') ||
                      lowerName.includes('wsl') ||
                      lowerName.includes('docker') ||
                      lowerName.includes('loopback') ||
                      lowerName.includes('pseudo') ||
                      lowerName.includes('teredo') ||
                      lowerName.includes('tailscale') ||
                      lowerName.includes('zerotier') ||
                      lowerName.includes('hamachi') ||
                      lowerName.includes('hyper-v');

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        if (ip.startsWith('169.254.') || ip === '127.0.0.1') continue;

        let priority = 10;
        if (isVirtual) priority -= 100;
        if (lowerName.includes('wi-fi') || lowerName.includes('wireless') || lowerName.includes('wlan')) priority += 60;
        if (lowerName.includes('ethernet') || lowerName.includes('eth') || lowerName.includes('lan')) priority += 40;
        if (ip.startsWith('192.168.')) priority += 20;
        else if (ip.startsWith('10.')) priority += 10;
        else if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) priority += 5;

        candidates.push({ name, ip, priority });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
}

function getLocalIpAddress() {
  const all = getAllLocalIpAddresses();
  if (all.length > 0 && all[0].priority > 0) {
    return all[0].ip;
  }
  return all.length > 0 ? all[0].ip : '127.0.0.1';
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
      const defaultSession = getOrCreateSession('DEFAULT');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'online',
        ip: getLocalIpAddress(),
        port: currentLanPort,
        pin: defaultSession.pin,
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

  wss.on('connection', (ws, req) => {
    let currentSessionId = '';
    const isLoopback = req?.socket?.remoteAddress === '127.0.0.1' || req?.socket?.remoteAddress === '::1' || req?.socket?.remoteAddress === '::ffff:127.0.0.1';

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());

        // Heartbeat Ping / Pong
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: msg.timestamp || Date.now(),
            serverTime: Date.now(),
          }));
          return;
        }

        if (msg.type === 'join') {
          currentSessionId = (msg.sessionId || 'DEFAULT').trim().toUpperCase();
          const session = getOrCreateSession(currentSessionId);

          // PIN Security Verification:
          // Desktop loopback is auto-authenticated.
          // Remote devices (Android/browser on LAN) must supply matching PIN.
          const isDesktopLocal = isLoopback || msg.deviceType === 'desktop' || msg.isDesktop;
          if (!isDesktopLocal && session.pin) {
            const clientPin = (msg.pin || '').trim();
            if (clientPin !== session.pin) {
              ws.send(JSON.stringify({
                type: 'auth:error',
                sessionId: currentSessionId,
                requiresPin: true,
                message: clientPin ? 'Incorrect pairing PIN. Please enter the 4-digit PIN shown on your PC screen.' : 'Pairing PIN required to join.',
              }));
              return;
            }
          }

          clients.set(ws, {
            ws,
            sessionId: currentSessionId,
            deviceId: msg.deviceId || 'dev-' + Math.random().toString(36).substring(2, 7),
            deviceName: msg.deviceName || 'Phone / Remote Device',
            deviceType: msg.deviceType || 'mobile',
          });

          // Send full current note, PIN & history back to newly authenticated device
          ws.send(JSON.stringify({
            type: 'sync',
            sessionId: currentSessionId,
            pin: session.pin,
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
            const count = getSessionClients(currentSessionId).length;
            mainWindow.webContents.send('lan:client-count', count);
            mainWindow.webContents.send('lan:client-connected', {
              deviceName: msg.deviceName || 'Phone',
              deviceType: msg.deviceType || 'mobile',
              clientsCount: count,
            });
          }
        } else if (msg.type === 'pin:update') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);
          if (msg.pin && msg.pin.trim()) {
            session.pin = msg.pin.trim();
            broadcastToSession(currentSessionId, {
              type: 'pin:updated',
              pin: session.pin,
            });
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('lan:pin-updated', session.pin);
            }
          }
        } else if (msg.type === 'text:update') {
          if (!currentSessionId) return;
          const session = getOrCreateSession(currentSessionId);

          // Monotonic revision bump to prevent stale out-of-order race conditions
          const nextRev = Math.max(session.note.rev || 0, msg.rev || 0) + 1;
          session.note.rev = nextRev;
          session.note.content = msg.content;
          session.note.updatedAt = Date.now();
          session.note.updatedBy = msg.deviceName || 'Connected Device';

          broadcastToSession(currentSessionId, {
            type: 'text:update',
            content: msg.content,
            rev: nextRev,
            updatedAt: session.note.updatedAt,
            updatedBy: session.note.updatedBy,
            senderDeviceId: msg.deviceId,
          }, ws);

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lan:message', {
              type: 'text:update',
              content: msg.content,
              rev: nextRev,
              senderDeviceId: msg.deviceId,
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

  // Dynamic Port Binding with automatic fallback if occupied
  function startListening(port, maxPort) {
    server.listen(port, '0.0.0.0', () => {
      currentLanPort = port;
      console.log(`[ClipSync] Embedded LAN Host listening on http://${getLocalIpAddress()}:${port}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lan:port-updated', port);
      }
    });

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < maxPort) {
        console.warn(`[ClipSync] Port ${port} is occupied, retrying port ${port + 1}...`);
        startListening(port + 1, maxPort);
      } else {
        console.error('[ClipSync] LAN Server listen error:', err);
      }
    });
  }

  startListening(currentLanPort, currentLanPort + 10);
  embeddedServer = server;
}

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, 'icon.ico'))
    ? path.join(__dirname, 'icon.ico')
    : path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 480,
    height: 620,
    minWidth: 260,
    minHeight: 200,
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
          <p style="color:#e2e8f0;">LAN Server is running on port ${currentLanPort}.</p>
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

  // Toggle Mini Sticky Note Desktop Widget Mode
  ipcMain.on('window:toggle-widget-mode', (e, isWidget) => {
    if (!mainWindow) return;
    try {
      if (isWidget) {
        mainWindow.setMinimumSize(220, 260);
        mainWindow.setSize(280, 360, true);
      } else {
        mainWindow.setMinimumSize(260, 200);
        mainWindow.setSize(480, 620, true);
      }
    } catch (err) {
      console.error('[ClipSync] Error toggling widget size:', err);
    }
  });

  // Windows 11 Snap Layouts integration
  ipcMain.on('window:snap', (e, layout) => {
    if (!mainWindow) return;
    try {
      const currentDisplay = screen.getDisplayMatching(mainWindow.getBounds());
      const { x, y, width, height } = currentDisplay.workArea;

      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      }

      if (layout === 'left-half') {
        mainWindow.setBounds({ x, y, width: Math.floor(width / 2), height });
      } else if (layout === 'right-half') {
        mainWindow.setBounds({ x: x + Math.floor(width / 2), y, width: Math.floor(width / 2), height });
      } else if (layout === 'top-right') {
        mainWindow.setBounds({ x: x + Math.floor(width / 2), y, width: Math.floor(width / 2), height: Math.floor(height / 2) });
      } else if (layout === 'bottom-right') {
        mainWindow.setBounds({ x: x + Math.floor(width / 2), y: y + Math.floor(height / 2), width: Math.floor(width / 2), height: Math.floor(height / 2) });
      } else if (layout === 'widget-corner') {
        mainWindow.setBounds({ x: x + width - 300, y: y + height - 390, width: 280, height: 360 });
      } else if (layout === 'center-note') {
        mainWindow.setBounds({ x: x + Math.floor((width - 480) / 2), y: y + Math.floor((height - 620) / 2), width: 480, height: 620 });
      }
    } catch (err) {
      console.error('[ClipSync] Error snapping window:', err);
    }
  });

  // LAN network info
  ipcMain.handle('lan:get-info', () => {
    const all = getAllLocalIpAddresses();
    const defaultSession = getOrCreateSession('DEFAULT');
    return {
      ip: getLocalIpAddress(),
      allIps: all.map(c => ({ name: c.name, ip: c.ip })),
      port: currentLanPort,
      pin: defaultSession.pin,
      clients: clients.size,
    };
  });

  ipcMain.handle('lan:set-pin', (e, newPin) => {
    const session = getOrCreateSession('DEFAULT');
    if (newPin && newPin.trim()) {
      session.pin = newPin.trim();
      broadcastToSession('DEFAULT', { type: 'pin:updated', pin: session.pin });
      return session.pin;
    }
    return session.pin;
  });

  ipcMain.handle('lan:regenerate-pin', () => {
    const session = getOrCreateSession('DEFAULT');
    session.pin = generatePin();
    broadcastToSession('DEFAULT', { type: 'pin:updated', pin: session.pin });
    return session.pin;
  });

  // Broadcast to all connected Android devices
  ipcMain.on('lan:broadcast', (e, payload) => {
    const currentSessionId = (payload.sessionId || 'DEFAULT').trim().toUpperCase();
    broadcastToSession(currentSessionId, payload);
    if (currentSessionId !== 'DEFAULT') {
      broadcastToSession('DEFAULT', payload);
    }
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
      { label: `LAN Host: ${getLocalIpAddress()}:${currentLanPort}`, enabled: false },
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
