import React, { useState, useEffect } from 'react';
import { X, Server, Sparkles, Key, Globe, ShieldAlert } from 'lucide-react';
import { Device } from '../types';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deviceData: Partial<Device>) => Promise<void>;
  initialDevice?: Device | null;
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialDevice,
}) => {
  const isEditing = Boolean(initialDevice);

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [type, setType] = useState('Linux');
  const [role, setRole] = useState('Compute node');
  const [isLocal, setIsLocal] = useState(false);
  const [webUrl, setWebUrl] = useState('');
  const [description, setDescription] = useState('');

  // SSH settings
  const [enableSsh, setEnableSsh] = useState(false);
  const [sshPort, setSshPort] = useState(22);
  const [sshUser, setSshUser] = useState('root');
  const [sshAuthMethod, setSshAuthMethod] = useState<'agent' | 'key' | 'password'>('agent');
  const [sshPassword, setSshPassword] = useState('');
  const [sshKey, setSshKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDevice) {
      setName(initialDevice.name || '');
      setHost(initialDevice.host || '');
      setType(initialDevice.type || 'Linux');
      setRole(initialDevice.role || 'Compute node');
      setIsLocal(Boolean(initialDevice.isLocal));
      setWebUrl(initialDevice.webUrl || '');
      setDescription(initialDevice.description || '');

      if (initialDevice.ssh) {
        setEnableSsh(Boolean(initialDevice.ssh.configured));
        setSshPort(initialDevice.ssh.port || 22);
        setSshUser(initialDevice.ssh.username || 'root');
        setSshAuthMethod(initialDevice.ssh.authMethod || 'agent');
        setSshPassword(initialDevice.ssh.password || '');
        setSshKey(initialDevice.ssh.privateKey || '');
      } else {
        setEnableSsh(false);
      }
    } else {
      // Reset
      setName('');
      setHost('');
      setType('Linux');
      setRole('Compute node');
      setIsLocal(false);
      setWebUrl('');
      setDescription('');
      setEnableSsh(false);
      setSshPort(22);
      setSshUser('root');
      setSshAuthMethod('agent');
      setSshPassword('');
      setSshKey('');
    }
    setError(null);
  }, [initialDevice, isOpen]);

  if (!isOpen) return null;

  // Preset loaders
  const loadPreset = (presetName: 'ps4' | 'debian' | 'nethunter') => {
    if (presetName === 'ps4') {
      setName('PS4 Linux');
      setHost('192.168.1.140');
      setType('Linux (PS4 VPS)');
      setRole('Compute node');
      setIsLocal(false);
      setWebUrl('http://192.168.1.140:3000');
      setDescription('Lightweight VPS hosting applications and web services');
      setEnableSsh(true);
      setSshPort(22);
      setSshUser('ps4user');
      setSshAuthMethod('agent');
    } else if (presetName === 'debian') {
      setName('Debian Laptop (NVR)');
      setHost('192.168.1.150');
      setType('Debian 12');
      setRole('NVR / Frigate Host');
      setIsLocal(false);
      setWebUrl('https://localhost:8971/');
      setDescription('Dedicated laptop running Frigate NVR and processing local video');
      setEnableSsh(false);
    } else if (presetName === 'nethunter') {
      setName('Android NetHunter (Camera)');
      setHost('192.168.1.160');
      setType('Kali NetHunter');
      setRole('Camera node');
      setIsLocal(false);
      setWebUrl('http://192.168.1.160:8080');
      setDescription('Broken screen phone running Kali NetHunter repurposed as IP camera');
      setEnableSsh(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Device name is required');
      return;
    }
    if (!host.trim()) {
      setError('IP address or hostname is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const deviceData: Partial<Device> = {
        name: name.trim(),
        host: host.trim(),
        type: type.trim(),
        role: role.trim(),
        isLocal,
        webUrl: webUrl.trim() || undefined,
        description: description.trim() || undefined,
        ssh: enableSsh
          ? {
              port: Number(sshPort) || 22,
              username: sshUser.trim() || 'root',
              configured: true,
              authMethod: sshAuthMethod,
              password: sshPassword || undefined,
              privateKey: sshKey || undefined,
            }
          : undefined,
      };

      await onSave(deviceData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save device');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-canvas-card p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent-light">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {isEditing ? 'Edit Device' : 'Add New Hardware'}
              </h2>
              <p className="text-xs text-text-secondary">
                Configure connectivity and deployment parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-canvas-subtle transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Presets Bar (only when creating) */}
        {!isEditing && (
          <div className="mt-4 p-3 rounded-xl bg-canvas-muted/50 border border-border-subtle">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-2">
              <Sparkles className="w-3.5 h-3.5 text-accent-light" />
              <span>Fill from Demo Hardware Presets:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => loadPreset('ps4')}
                className="px-2.5 py-1 text-xs rounded-full bg-canvas border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-white transition-colors"
              >
                PS4 Linux (VPS)
              </button>
              <button
                type="button"
                onClick={() => loadPreset('debian')}
                className="px-2.5 py-1 text-xs rounded-full bg-canvas border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-white transition-colors"
              >
                Debian Laptop (NVR)
              </button>
              <button
                type="button"
                onClick={() => loadPreset('nethunter')}
                className="px-2.5 py-1 text-xs rounded-full bg-canvas border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-white transition-colors"
              >
                Android NetHunter (Camera)
              </button>
            </div>
          </div>
        )}

        {/* Error notice */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Device Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PS4 Linux"
                className="w-full px-3 py-2 text-sm rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                IP Address or Hostname <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="e.g. 192.168.1.140"
                className="w-full px-3 py-2 text-sm rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Operating System / Type
              </label>
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. Linux (VPS), Debian, Kali"
                className="w-full px-3 py-2 text-sm rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Role / Function
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Compute node, Camera node"
                className="w-full px-3 py-2 text-sm rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Web Interface URL <span className="text-text-muted">(Optional)</span>
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-text-muted absolute left-3 top-3" />
              <input
                type="url"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                placeholder="http://192.168.1.140:3000"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Description / Notes <span className="text-text-muted">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Discarded hardware running self-hosted container"
              className="w-full px-3 py-2 text-sm rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isLocal"
              checked={isLocal}
              onChange={(e) => setIsLocal(e.target.checked)}
              className="rounded border-border bg-canvas text-accent focus:ring-accent"
            />
            <label htmlFor="isLocal" className="text-xs text-text-secondary cursor-pointer">
              This device is the local machine running Reboot
            </label>
          </div>

          {/* SSH Configuration Section */}
          <div className="p-3.5 rounded-xl border border-border-subtle bg-canvas-muted/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-accent-light" />
                <span className="text-xs font-medium text-text-primary">SSH Remote Deployment</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSsh}
                  onChange={(e) => setEnableSsh(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-canvas peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white"></div>
              </label>
            </div>

            {enableSsh && (
              <div className="pt-2 border-t border-border-subtle/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">SSH Port</label>
                    <input
                      type="number"
                      value={sshPort}
                      onChange={(e) => setSshPort(parseInt(e.target.value, 10) || 22)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Username</label>
                    <input
                      type="text"
                      value={sshUser}
                      onChange={(e) => setSshUser(e.target.value)}
                      placeholder="e.g. ps4user"
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-text-secondary mb-1">Auth Method</label>
                  <div className="flex gap-2">
                    {(['agent', 'password', 'key'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSshAuthMethod(m)}
                        className={`px-3 py-1 text-xs rounded-lg border capitalize transition-colors ${
                          sshAuthMethod === m
                            ? 'bg-accent/20 border-accent/50 text-accent-light font-medium'
                            : 'bg-canvas border-border-subtle text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {m === 'agent' ? 'SSH Agent / Default Key' : m}
                      </button>
                    ))}
                  </div>
                </div>

                {sshAuthMethod === 'password' && (
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Password</label>
                    <input
                      type="password"
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                      placeholder="SSH Password"
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary font-mono"
                    />
                  </div>
                )}

                {sshAuthMethod === 'key' && (
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Private Key PEM</label>
                    <textarea
                      value={sshKey}
                      onChange={(e) => setSshKey(e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                      rows={3}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary font-mono resize-none"
                    />
                  </div>
                )}
                <p className="text-[11px] text-text-muted">
                  Note: Credentials are kept strictly in-memory during this session and never logged.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-medium rounded-full bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEditing ? 'Update Device' : 'Save Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
