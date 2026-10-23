import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  Terminal as TerminalIcon,
  Server,
  Play,
  Square,
  Maximize2,
  Minimize2,
  Trash2,
  Key,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { Device } from '../types';

interface SshPortalProps {
  devices: Device[];
  initialDeviceId?: string;
  onEditDevice?: (device: Device) => void;
}

export const SshPortal: React.FC<SshPortalProps> = ({
  devices,
  initialDeviceId,
  onEditDevice,
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    initialDeviceId || (devices.length > 0 ? devices[0].id : '')
  );

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Ready to connect');

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#090b0e',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        cursorAccent: '#090b0e',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#1e293b',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#fb7185',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#e879f9',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      scrollback: 2000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[36m╔════════════════════════════════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[36m║\x1b[0m   \x1b[1;37mREBOOT WEB SSH PORTAL\x1b[0m — Direct Node Shell Console               \x1b[36m║\x1b[0m');
    term.writeln('\x1b[36m╚════════════════════════════════════════════════════════════════════╝\x1b[0m');
    term.writeln('Select a target node above and click \x1b[32mConnect\x1b[0m to establish an interactive session.\r\n');

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle connecting to target
  const handleConnect = () => {
    if (!selectedDevice || !xtermInstance.current) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const term = xtermInstance.current;
    setConnecting(true);
    setConnectionStatus(`Connecting to ${selectedDevice.name}...`);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ssh/ws?deviceId=${encodeURIComponent(selectedDevice.id)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
      setConnectionStatus(`Connected (${selectedDevice.host})`);
      term.focus();

      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    ws.binaryType = 'arraybuffer';

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      } else if (event.data instanceof Blob) {
        const text = await event.data.text();
        term.write(text);
      }
    };

    ws.onerror = (err) => {
      setConnecting(false);
      setConnected(false);
      setConnectionStatus('Connection error');
      term.writeln(`\r\n\x1b[31m[WebSocket Error: Unable to reach SSH gateway]\x1b[0m\r\n`);
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
      setConnectionStatus('Disconnected');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setConnected(false);
    setConnecting(false);
    setConnectionStatus('Disconnected');
    if (xtermInstance.current) {
      xtermInstance.current.writeln('\r\n\x1b[33m[Disconnected by user]\x1b[0m\r\n');
    }
  };

  const sendQuickCommand = (cmd: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Please connect to the node before sending commands.');
      return;
    }
    wsRef.current.send(cmd + '\n');
    if (xtermInstance.current) {
      xtermInstance.current.focus();
    }
  };

  const clearTerminal = () => {
    if (xtermInstance.current) {
      xtermInstance.current.clear();
    }
  };

  const hasSshConfig =
    selectedDevice?.isLocal || (selectedDevice?.ssh && selectedDevice.ssh.configured);

  return (
    <div className={`space-y-4 animate-fade-in ${fullscreen ? 'fixed inset-4 z-50 bg-canvas p-4 rounded-2xl border border-border shadow-2xl flex flex-col' : ''}`}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
              <TerminalIcon className="w-6 h-6 text-accent-light" />
              <span>Web SSH Console</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-accent/15 text-accent-light border border-accent/30">
              Interactive PTY
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Zero-install browser SSH terminal connecting directly to your repurposed nodes.
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border ${
              connected
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                : connecting
                ? 'bg-blue-950/50 text-blue-300 border-blue-800/60'
                : 'bg-canvas-card text-text-muted border-border-subtle'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected
                  ? 'bg-emerald-400 animate-pulse'
                  : connecting
                  ? 'bg-blue-400 animate-ping'
                  : 'bg-slate-500'
              }`}
            />
            <span>{connectionStatus}</span>
          </span>

          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-2 rounded-xl border border-border-subtle bg-canvas-card text-text-secondary hover:text-white transition-colors"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Target Selector Bar */}
      <div className="p-3 rounded-2xl bg-canvas-card border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-medium text-text-secondary flex-shrink-0">Target Node:</span>
          {devices.map((device) => {
            const isSelected = device.id === selectedDeviceId;
            return (
              <button
                key={device.id}
                onClick={() => {
                  if (connected) handleDisconnect();
                  setSelectedDeviceId(device.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-canvas text-text-secondary hover:text-text-primary border border-border-subtle'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>{device.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({device.host})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {connected ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting || !hasSshConfig}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{connecting ? 'Connecting...' : 'Connect'}</span>
            </button>
          )}

          <button
            onClick={clearTerminal}
            className="p-1.5 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:bg-canvas transition-colors"
            title="Clear Terminal Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Warning if remote SSH not configured */}
      {selectedDevice && !selectedDevice.isLocal && !selectedDevice.ssh?.configured && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>
              Target <strong>{selectedDevice.name}</strong> ({selectedDevice.host}) has no SSH credentials configured.
            </span>
          </div>
          {onEditDevice && (
            <button
              onClick={() => onEditDevice(selectedDevice)}
              className="px-3 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800 border border-amber-700/60 text-white text-xs font-medium transition-colors"
            >
              Configure SSH
            </button>
          )}
        </div>
      )}

      {/* Quick Diagnostics Toolbar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] text-text-muted font-medium mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-accent-light" />
          <span>Quick Commands:</span>
        </span>
        {[
          { label: 'System Info', cmd: 'uname -a' },
          { label: 'Uptime & Load', cmd: 'uptime' },
          { label: 'Disk Space', cmd: 'df -h' },
          { label: 'Memory', cmd: 'free -m' },
          { label: 'IP Config', cmd: 'ip a || ifconfig' },
          { label: 'Top Procs', cmd: 'ps aux | head -n 12' },
          { label: 'Docker Status', cmd: 'docker ps 2>/dev/null || echo "Docker not running"' },
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={() => sendQuickCommand(item.cmd)}
            disabled={!connected}
            className="px-2.5 py-1 rounded-lg bg-canvas-card hover:bg-canvas-subtle border border-border-subtle text-text-secondary hover:text-white transition-colors text-[11px] font-mono whitespace-nowrap disabled:opacity-40"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Terminal Viewport */}
      <div className={`relative rounded-2xl border border-border-subtle bg-[#090b0e] shadow-2xl overflow-hidden p-3 ${fullscreen ? 'flex-1 min-h-0' : 'h-[500px]'}`}>
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
};
