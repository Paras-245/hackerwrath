# Reboot

> **Old hardware. New purpose.**

Reboot is a minimal, self-hosted web dashboard designed to give old, discarded, or repurposed hardware a second life by unifying it into a lightweight home lab and distributed infrastructure fleet.

---

## Architecture Overview

```
hackerwrath/
├── client/                 # React + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/     # Terminal console, StatusBadge, Sidebar, DeviceModal
│   │   ├── pages/          # Overview, Devices, Deployments, Frigate
│   │   ├── lib/            # Typed API client
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── server/                 # Node.js + Express + TypeScript + SSH2
│   ├── src/
│   │   ├── routes/         # /api/devices, /api/deployments, /api/frigate
│   │   ├── services/       # Store (in-memory), Network health, Deployer
│   │   ├── types.ts
│   │   └── index.ts
│   └── package.json
├── package.json            # Monorepo dev and build scripts
└── README.md
```

## Core Features

### 1. Unified Device Fleet Dashboard
- Manage and monitor diverse hardware (PS4 Linux VPS, Debian laptop, Android NetHunter camera, local host).
- Real-time honest reachability checks via HTTP endpoints, SSH handshake, and TCP probing (no false ICMP ping assumptions).
- 1-click Demo Presets for instant setup.
- Add, edit, remove devices during the session.

### 2. GitHub Deployment Orchestration
- Clone any GitHub repository into an isolated temporary workspace.
- Run build and startup commands with streaming stdout/stderr in a live terminal-style console via Server-Sent Events (SSE).
- Support for local execution and remote execution over SSH.
- Process cancellation / stop mechanism with graceful signal propagation.
- Output exit code reporting and status tracking (`Queued`, `Running`, `Successful`, `Failed`, `Stopped`).

### 3. Frigate NVR Integration
- Dedicated gateway tab for your local surveillance system.
- One-click **Open Frigate** action in a new browser tab.
- Live HTTP availability health check indicator.
- Configurable base URL with in-memory persistence.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Git installed on host

### Running Locally
```bash
# Install dependencies and start both server (port 3001) and client (port 5173)
npm run dev
```

Visit the dashboard in your browser:
**`http://127.0.0.1:5173/`**

### Building for Production
```bash
npm run build
npm run start
```
