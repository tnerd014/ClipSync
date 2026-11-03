# Architecture Plan: Serverless Electron Desktop & Android P2P Sync

## Core Requirement
The user will be building:
1. An **Electron Desktop App** (Windows)
2. An **Android App** (Mobile)
- **Zero Cloud Servers & Zero Cloud Databases**: The app will not be hosted on any cloud server or database.
- **Direct Exchange**: Both the desktop app and mobile app must discover each other and exchange text/clipboard data directly over the Local Area Network (LAN Wi-Fi) or direct peer-to-peer protocol.

---

## Technical Architecture for Direct Desktop-to-Mobile Sync

### 1. Embedded Host Architecture (The LocalSend / KDE Connect Model)
Because Electron runs a full Node.js runtime on the user's PC, it can act as the **Local Host**:
- **Desktop (Electron)**:
  - Spawns an internal, lightweight WebSocket & HTTP listener directly on the PC's local Wi-Fi network interface (`0.0.0.0:PORT`, e.g., `8432`).
  - Auto-detects the PC's local IP address (e.g., `192.168.1.x`) via Node's `os.networkInterfaces()`.
  - Displays a LAN pairing QR code containing `ws://192.168.1.x:8432`.
- **Mobile (Android)**:
  - Connects directly to the PC's local Wi-Fi address (via QR scan or manual local IP entry).
  - No data ever leaves the local router; no internet connection, cloud host, or cloud database is needed.
  - Sub-millisecond latency and total privacy.

---

## Implementation Workflows

### Phase 1: Electron Host & Embedded Server Engine
- Provide `electron/main.js` and `electron/preload.js` integrating the embedded WebSocket listener.
- Add an in-app **LAN Connection Hub**:
  - Displays local IP address detection (e.g., `192.168.x.x:8432`).
  - Generates offline LAN QR codes that directly encode the local PC's endpoint.
  - Allows the user to change ports or toggle between embedded host mode and client mode.

### Phase 2: Android Direct LAN Client & Pairing
- Add a direct **Connect to Local PC** dialog in the Android app:
  - QR Code scanner using camera or quick IP/Port input (`192.168.1.X:8432`).
  - Local auto-discovery via mDNS/broadcast ping on the local subnet.
  - Direct bi-directional clipboard sync over the local network.

### Phase 3: WebRTC Direct P2P Fallback (Offline / Zero-Router)
- Support WebRTC DataChannel signaling via QR code for true peer-to-peer direct encryption when operating on separate networks without a central server.

### Phase 4: Production Export Files
- Supply complete, copyable setup files:
  - `electron/main.js` (with system tray, sticky note frameless window, always-on-top toggle, and embedded server)
  - `electron/package.json` build scripts for Windows installer (`electron-builder`)
  - Android client source code & manifests.

---

## Verification & Testing Plan
1. **Local Loopback & LAN Test**: Connect a local mobile browser or secondary window to `localhost:8432` / `192.168.x.x` to verify direct data transmission.
2. **Offline Simulation**: Disconnect internet access and verify clipboard syncing continues uninterrupted across local Wi-Fi.
3. **Electron Packaging Validation**: Confirm `electron/main.js` correctly exposes clipboard and local network APIs.
