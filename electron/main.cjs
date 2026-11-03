// Electron Main Process for Windows Sticky Notes (Serverless LAN Sync)
// Zero cloud servers, zero cloud databases
const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const os = require('os');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

let mainWindow = null;
let tray = null;
let embeddedServer = null;
let wss = null;
const LAN_PORT = 8432;

// In-memory sessions store on local PC
const localSessions = new Map();
const connectedSockets = new Set();

// Get local network IPv4 address (e.g. 192.168.1.50)
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-ipv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Start embedded local WebSocket server inside Electron
function startEmbeddedLanServer() {
  const server = http.createServer((req, res) => {
    // Basic CORS & health check
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/api/lan-info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'online',
        ip: getLocalIpAddress(),
        port: LAN_PORT,
        device: 'Windows Desktop (Electron)',
      }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ClipSync Local LAN Host Active');
  });

  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    connectedSockets.add(ws);

    // Send connected devices update to Electron renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('lan:client-count', connectedSockets.size);
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Broadcast to all other connected clients (Android phone, other laptops)
        for (const client of connectedSockets) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        }

        // Forward to Electron UI
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('lan:message', data);
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    });

    ws.on('close', () => {
      connectedSockets.delete(ws);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lan:client-count', connectedSockets.size);
      }
    });
  });

  server.listen(LAN_PORT, '0.0.0.0', () => {
    console.log(`[ClipSync] Embedded LAN server listening on http://${getLocalIpAddress()}:${LAN_PORT}`);
  });

  embeddedServer = server;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 620,
    minWidth: 320,
    minHeight: 400,
    frame: false, // Windows 11 frameless sticky note
    transparent: false,
    alwaysOnTop: false,
    backgroundColor: '#171717',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load app from local build (or dev server)
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Window control IPC handlers
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow.hide()); // Hide to system tray instead of exiting
  ipcMain.on('window:set-always-on-top', (e, flag) => mainWindow.setAlwaysOnTop(flag));

  // LAN network info
  ipcMain.handle('lan:get-info', () => {
    return {
      ip: getLocalIpAddress(),
      port: LAN_PORT,
      clients: connectedSockets.size,
    };
  });

  // Send message from Electron renderer to all connected Android devices
  ipcMain.on('lan:broadcast', (e, payload) => {
    const json = JSON.stringify(payload);
    for (const client of connectedSockets) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    }
  });
}

function createTray() {
  // System tray icon for background operation
  try {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Sticky Note', click: () => { mainWindow.show(); mainWindow.focus(); } },
      { label: 'LAN IP: ' + getLocalIpAddress() + ':' + LAN_PORT, enabled: false },
      { type: 'separator' },
      { label: 'Quit ClipSync', click: () => app.quit() },
    ]);
    tray.setToolTip('ClipSync - Local Clipboard Sync');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
  } catch {
    // Ignore tray icon missing in dev
  }
}

app.whenReady().then(() => {
  startEmbeddedLanServer();
  createWindow();
  createTray();

  // Global hotkey: Ctrl+Alt+S to summon Sticky Note from anywhere in Windows
  globalShortcut.register('CommandOrControl+Alt+S', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (embeddedServer) embeddedServer.close();
});
