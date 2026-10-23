import React from 'react';
import {
  Server,
  Rocket,
  Camera,
  ExternalLink,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldAlert,
  Terminal as TerminalIcon,
  Sparkles,
  Radio,
} from 'lucide-react';
import { Device, Deployment, FrigateConfig, NavTab } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface OverviewProps {
  devices: Device[];
  deployments: Deployment[];
  frigateConfig: FrigateConfig;
  onNavigate: (tab: NavTab) => void;
  onCheckDevice: (id: string) => void;
  onOpenAddDevice: () => void;
  onScanSubnet?: () => void;
  isScanning?: boolean;
}

export const Overview: React.FC<OverviewProps> = ({
  devices,
  deployments,
  frigateConfig,
  onNavigate,
  onCheckDevice,
  onOpenAddDevice,
  onScanSubnet,
  isScanning,
}) => {
  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const offlineOrUnknownCount = devices.filter((d) => d.status !== 'online').length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero / Header Section */}
      <div className="border-b border-border-subtle pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-accent-light mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Distributed Home Lab Fleet</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            Your hardware, working together.
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-text-secondary max-w-2xl leading-relaxed">
            Reboot brings repurposed devices into one manageable system. Deploy applications across
            nodes, inspect remote health, and access live SSH consoles right in your browser.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('ssh')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full border border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent-light transition-colors"
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>SSH Console</span>
          </button>
          <button
            onClick={() => onNavigate('deployments')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-accent hover:bg-accent-hover text-white transition-colors shadow-sm"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Deploy App</span>
          </button>
        </div>
      </div>

      {/* Metric Cards - Honest stats only */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-canvas-card border border-border-subtle flex items-center justify-between shadow-xs hover:border-border transition-all">
          <div>
            <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">
              Configured Devices
            </div>
            <div className="text-2xl font-bold text-text-primary mt-1 font-mono">
              {devices.length}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-canvas-muted text-text-secondary">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-canvas-card border border-border-subtle flex items-center justify-between shadow-xs hover:border-emerald-800/40 transition-all">
          <div>
            <div className="text-xs text-emerald-400 font-medium uppercase tracking-wider">
              Online & Responsive
            </div>
            <div className="text-2xl font-bold text-emerald-300 mt-1 font-mono">
              {onlineCount}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-canvas-card border border-border-subtle flex items-center justify-between shadow-xs hover:border-border transition-all">
          <div>
            <div className="text-xs text-text-muted font-medium uppercase tracking-wider">
              Offline / Unverified
            </div>
            <div className="text-2xl font-bold text-text-secondary mt-1 font-mono">
              {offlineOrUnknownCount}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-canvas-muted text-text-muted">
            <Server className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Devices & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Compact Device Summary */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-accent-light" />
              <h2 className="text-sm font-semibold text-text-primary">Configured Hardware Fleet</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onScanSubnet || (() => onNavigate('devices'))}
                disabled={isScanning}
                className="flex items-center gap-1 text-xs text-accent-light hover:text-white px-2.5 py-1 rounded-full border border-accent/40 bg-accent/15 hover:bg-accent/25 transition-colors disabled:opacity-50"
                title="Scan local subnet for active hardware"
              >
                <Radio className={`w-3.5 h-3.5 ${isScanning ? 'animate-pulse text-emerald-400' : ''}`} />
                <span>{isScanning ? 'Scanning...' : 'Scan Subnet'}</span>
              </button>
              <button
                onClick={onOpenAddDevice}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-white px-2.5 py-1 rounded-full border border-border-subtle bg-canvas hover:bg-canvas-subtle transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Device</span>
              </button>
              <button
                onClick={() => onNavigate('devices')}
                className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-canvas-card divide-y divide-border-subtle overflow-hidden">
            {devices.map((device) => {
              const hasSsh = device.isLocal || (device.ssh && device.ssh.configured);

              return (
                <div
                  key={device.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-canvas-subtle/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-text-primary">{device.name}</span>
                      <span className="font-mono text-xs text-text-muted">({device.host})</span>
                      {device.isLocal && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/20 text-accent-light border border-accent/30">
                          Host
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-canvas-muted text-[11px] text-text-muted">
                        {device.type}
                      </span>
                      <span>·</span>
                      <span>{device.role}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <StatusBadge status={device.status} size="sm" />
                    
                    {hasSsh && (
                      <button
                        onClick={() => onNavigate('ssh')}
                        className="px-2 py-1 rounded-lg border border-accent/30 bg-accent/10 hover:bg-accent/20 text-accent-light text-xs font-mono flex items-center gap-1 transition-colors"
                        title="Open SSH Console"
                      >
                        <TerminalIcon className="w-3 h-3" />
                        <span>SSH</span>
                      </button>
                    )}

                    <button
                      onClick={() => onCheckDevice(device.id)}
                      className="p-1.5 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:bg-canvas transition-colors"
                      title="Test connectivity"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    
                    {device.webUrl && (
                      <a
                        href={device.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:bg-canvas transition-colors"
                        title="Open Web Interface"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Quick Actions & Frigate Shortcut */}
        <div className="space-y-4">
          {/* Web SSH Portal Shortcut Card */}
          <div className="p-5 rounded-2xl border border-border-subtle bg-canvas-card relative overflow-hidden shadow-sm hover:border-border transition-all space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-semibold">
                  Direct Node Access
                </span>
                <h3 className="text-base font-semibold text-text-primary mt-0.5">
                  Web SSH Terminal
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-canvas-muted text-accent-light">
                <TerminalIcon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Launch interactive shell sessions directly into PS4 Linux, Reboot Host, or any connected lab node right inside your browser.
            </p>
            <button
              onClick={() => onNavigate('ssh')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-full bg-canvas-subtle hover:bg-canvas border border-border text-text-primary hover:text-white transition-colors"
            >
              <span>Launch SSH Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Deploy Application CTA Card */}
          <div className="p-5 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 via-canvas-card to-canvas-card relative overflow-hidden shadow-lg space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-semibold">
                  Deployment Hub
                </span>
                <h3 className="text-base font-semibold text-text-primary mt-0.5">
                  Deploy to Node
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-accent/20 text-accent-light">
                <Rocket className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Clone any GitHub repository and execute a build or service startup command directly on PS4 Linux or your local host.
            </p>
            <button
              onClick={() => onNavigate('deployments')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-full bg-accent hover:bg-accent-hover text-white transition-colors mt-2"
            >
              <span>Launch Deployment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Frigate Shortcut Card */}
          <div className="p-5 rounded-2xl border border-border-subtle bg-canvas-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-canvas-muted text-text-secondary">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Frigate NVR</h3>
                  <div className="text-xs text-text-muted">Local Security System</div>
                </div>
              </div>
              <StatusBadge status={frigateConfig.status} size="sm" />
            </div>

            <p className="text-xs text-text-secondary font-mono truncate bg-canvas px-2.5 py-1.5 rounded-lg border border-border-subtle">
              {frigateConfig.url}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={frigateConfig.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-canvas-subtle hover:bg-canvas border border-border text-text-primary hover:text-white transition-colors"
              >
                <span>Open Frigate</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => onNavigate('frigate')}
                className="px-3 py-1.5 text-xs rounded-full border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors"
              >
                Configure
              </button>
            </div>
          </div>

          {/* In-Memory Persistence Notice */}
          <div className="p-3.5 rounded-xl bg-canvas-subtle border border-border-subtle/80 flex items-start gap-2.5 text-text-muted text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-400/80 flex-shrink-0 mt-0.5" />
            <p className="leading-snug">
              Reboot operates without databases. Configuration and active deployment logs are held in memory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
