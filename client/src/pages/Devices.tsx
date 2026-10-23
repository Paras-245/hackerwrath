import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  ExternalLink,
  Edit2,
  Trash2,
  Key,
  Globe,
  Download,
  Upload,
  Terminal,
  Radio,
  Wifi,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Device } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { fetchSubnet, scanSubnet } from '../lib/api';

interface DevicesProps {
  devices: Device[];
  onOpenAddModal: () => void;
  onOpenEditModal: (device: Device) => void;
  onDeleteDevice: (id: string) => Promise<void>;
  onCheckDevice: (id: string) => Promise<void>;
  onCheckAllDevices: () => Promise<void>;
  isCheckingAll: boolean;
  onOpenSsh?: (deviceId: string) => void;
  onRefreshData?: () => void;
}

export const Devices: React.FC<DevicesProps> = ({
  devices,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteDevice,
  onCheckDevice,
  onCheckAllDevices,
  isCheckingAll,
  onOpenSsh,
  onRefreshData,
}) => {
  const [checkingIds, setCheckingIds] = useState<Record<string, boolean>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [subnetInfo, setSubnetInfo] = useState<{ iface: string; ip: string; cidr: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load subnet info on mount
  useEffect(() => {
    fetchSubnet()
      .then((info) => {
        if (info) setSubnetInfo(info);
      })
      .catch(() => {});
  }, []);

  const handleSingleCheck = async (id: string) => {
    setCheckingIds((prev) => ({ ...prev, [id]: true }));
    try {
      await onCheckDevice(id);
    } finally {
      setCheckingIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Subnet Scan Action
  const handleScan = async () => {
    try {
      setIsScanning(true);
      setScanMessage(null);
      const res = await scanSubnet();
      setScanMessage(`Scan complete! Discovered ${res.discoveredCount} live devices on subnet.`);
      if (onRefreshData) {
        onRefreshData();
      }
      setTimeout(() => setScanMessage(null), 6000);
    } catch (err: any) {
      alert(`Subnet scan error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Export configuration
  const handleExport = async () => {
    try {
      const res = await fetch('/api/devices/export/config');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reboot-fleet-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Import configuration
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/devices/import/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      const data = await res.json();
      if (data.success && onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Connected Devices
            </h1>
            {subnetInfo && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-accent/15 text-accent-light border border-accent/30">
                <Wifi className="w-3 h-3" />
                <span>{subnetInfo.cidr} ({subnetInfo.iface})</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Real hardware discovered and orchestrated across your local network.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Scan Subnet Button */}
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full border border-accent/50 bg-accent/20 hover:bg-accent/30 text-accent-light transition-all shadow-xs disabled:opacity-50"
            title="Scan local subnet for active hardware"
          >
            <Radio className={`w-3.5 h-3.5 ${isScanning ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>{isScanning ? 'Scanning Subnet...' : 'Scan Subnet'}</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border-subtle bg-canvas-card hover:bg-canvas-subtle text-text-secondary hover:text-text-primary transition-colors"
            title="Download fleet setup as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border-subtle bg-canvas-card hover:bg-canvas-subtle text-text-secondary hover:text-text-primary transition-colors"
            title="Upload previously exported JSON fleet"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            onClick={onCheckAllDevices}
            disabled={isCheckingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border-subtle bg-canvas-card hover:bg-canvas-subtle text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAll ? 'animate-spin' : ''}`} />
            <span>{isCheckingAll ? 'Testing...' : 'Test All'}</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-accent hover:bg-accent-hover text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* Subnet Scan Notification Banner */}
      {scanMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between gap-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{scanMessage}</span>
          </div>
          <button
            onClick={() => setScanMessage(null)}
            className="text-[11px] text-emerald-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Empty State if only local host and user hasn't scanned yet */}
      {devices.length <= 1 && (
        <div className="p-6 rounded-2xl bg-canvas-card border border-accent/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-accent/15 border border-accent/30 text-accent-light">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Discover Devices on Your Subnet
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Automatically sweep your local network {subnetInfo ? `(${subnetInfo.cidr})` : ''} to find active Linux servers, SSH nodes, and Frigate installations.
              </p>
            </div>
          </div>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-all shadow-md whitespace-nowrap disabled:opacity-50"
          >
            <Radio className="w-4 h-4" />
            <span>{isScanning ? 'Scanning Network...' : 'Scan Subnet Now'}</span>
          </button>
        </div>
      )}

      {/* Device List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((device) => {
          const isChecking = checkingIds[device.id] || isCheckingAll;
          const hasSsh = device.isLocal || (device.ssh && device.ssh.configured);

          return (
            <div
              key={device.id}
              className="p-5 rounded-2xl bg-canvas-card border border-border-subtle hover:border-border transition-all flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div>
                {/* Title & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-text-primary">{device.name}</h3>
                      {device.isLocal && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/20 text-accent-light border border-accent/30">
                          Host
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-text-secondary">{device.host}</div>
                  </div>
                  <StatusBadge status={device.status} size="sm" pulse={isChecking} />
                </div>

                {/* Tags & Meta */}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-canvas border border-border-subtle text-text-muted">
                    {device.type}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-canvas border border-border-subtle text-text-secondary">
                    {device.role}
                  </span>
                  {device.ssh && device.ssh.configured && (
                    <span className="px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent-light flex items-center gap-1">
                      <Key className="w-2.5 h-2.5" />
                      <span>SSH :{device.ssh.port || 22}</span>
                    </span>
                  )}
                  {device.webUrl && (
                    <span className="px-2 py-0.5 rounded-md bg-canvas border border-border-subtle text-text-muted flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5" />
                      <span>Web</span>
                    </span>
                  )}
                </div>

                {/* Description & Status message */}
                {device.description && (
                  <p className="mt-3 text-xs text-text-secondary line-clamp-2">
                    {device.description}
                  </p>
                )}

                {device.statusMessage && (
                  <div className="mt-3 p-2 rounded-lg bg-canvas text-[11px] text-text-muted border border-border-subtle/60 flex items-start gap-1.5 font-mono">
                    <span className="text-slate-500">•</span>
                    <span className="truncate">{device.statusMessage}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-border-subtle/70 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleSingleCheck(device.id)}
                    disabled={isChecking}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2.5 py-1 rounded-lg border border-border-subtle bg-canvas hover:bg-canvas-subtle transition-colors disabled:opacity-50"
                    title="Test Reachability"
                  >
                    <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                    <span>Test</span>
                  </button>

                  {hasSsh && onOpenSsh && (
                    <button
                      onClick={() => onOpenSsh(device.id)}
                      className="flex items-center gap-1 text-xs text-accent-light hover:text-white px-2.5 py-1 rounded-lg border border-accent/30 bg-accent/10 hover:bg-accent/20 transition-colors"
                      title="Open Web SSH Terminal"
                    >
                      <Terminal className="w-3 h-3" />
                      <span>SSH</span>
                    </button>
                  )}

                  {device.webUrl && (
                    <a
                      href={device.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2.5 py-1 rounded-lg border border-border-subtle bg-canvas hover:bg-canvas-subtle transition-colors"
                      title="Open Web Interface"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenEditModal(device)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-canvas transition-colors"
                    title="Edit Device"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {!device.isLocal && (
                    <button
                      onClick={() => onDeleteDevice(device.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-canvas transition-colors"
                      title="Delete Device"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
