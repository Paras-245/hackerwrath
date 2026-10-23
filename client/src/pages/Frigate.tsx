import React, { useState } from 'react';
import {
  Camera,
  ExternalLink,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Laptop,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { FrigateConfig } from '../types';
import { updateFrigate, checkFrigateStatus } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';

interface FrigateProps {
  config: FrigateConfig;
  onConfigUpdated: (config: FrigateConfig) => void;
}

export const Frigate: React.FC<FrigateProps> = ({ config, onConfigUpdated }) => {
  const [url, setUrl] = useState(config.url || 'https://localhost:8971/');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [embedIframe, setEmbedIframe] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveSuccess(false);
      const updated = await updateFrigate(url.trim());
      onConfigUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error updating Frigate URL: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCheck = async () => {
    try {
      setChecking(true);
      const updated = await checkFrigateStatus();
      onConfigUpdated(updated);
    } catch (err: any) {
      alert(`Health check failed: ${err.message}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="border-b border-border-subtle pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Frigate NVR Gateway
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          Unified access point to your self-hosted Frigate security portal running on repurposed hardware.
        </p>
      </div>

      {/* Main Service Card */}
      <div className="p-6 rounded-2xl bg-canvas-card border border-border-subtle shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-light shadow-sm">
              <Camera className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Frigate Surveillance Portal</h2>
              <div className="text-xs text-text-muted mt-0.5">
                Real-time AI object detection & local video processing
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <StatusBadge status={config.status} size="md" pulse={checking} />
            <button
              onClick={handleCheck}
              disabled={checking}
              className="p-2 rounded-xl border border-border-subtle bg-canvas hover:bg-canvas-subtle text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              title="Verify service availability"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="p-4 rounded-xl bg-canvas border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono text-text-muted">Target Endpoint:</div>
            <div className="text-sm font-mono font-medium text-text-primary">{config.url}</div>
            {config.statusMessage && (
              <div className="text-xs text-text-secondary">
                Status: {config.statusMessage}
              </div>
            )}
          </div>

          <a
            href={config.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-all shadow-md hover:shadow-accent/25"
          >
            <span>Open Frigate</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* URL Configuration Form */}
        <form onSubmit={handleSave} className="space-y-3 pt-2 border-t border-border-subtle">
          <label className="block text-xs font-medium text-text-secondary">
            Configure Frigate Base URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://localhost:8971/"
              className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary font-mono"
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-canvas-muted hover:bg-canvas border border-border-subtle text-text-primary hover:text-white text-xs font-medium transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save URL'}</span>
            </button>
          </div>
          {saveSuccess && (
            <p className="text-xs text-emerald-400 font-medium">✓ Base URL updated in memory.</p>
          )}
        </form>

        {/* Hardware Architecture Context */}
        <div className="pt-4 border-t border-border-subtle grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-canvas-muted/40 border border-border-subtle flex items-start gap-3">
            <div className="p-2 rounded-lg bg-canvas text-accent-light">
              <Laptop className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-text-primary">Debian Laptop Host</div>
              <p className="text-text-muted leading-relaxed">
                Runs the Frigate container locally, ingesting camera streams and running hardware-accelerated detection.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-canvas-muted/40 border border-border-subtle flex items-start gap-3">
            <div className="p-2 rounded-lg bg-canvas text-accent-light">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-text-primary">Android NetHunter Node</div>
              <p className="text-text-muted leading-relaxed">
                Repurposed broken-screen phone acting as a dedicated IP camera, streaming RTSP video to Frigate.
              </p>
            </div>
          </div>
        </div>

        {/* Optional Embedded Portal Preview toggle */}
        <div className="pt-2">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-text-secondary">
              Inline Portal Frame (Optional)
            </span>
            <button
              type="button"
              onClick={() => setEmbedIframe(!embedIframe)}
              className="text-xs text-accent-light hover:underline"
            >
              {embedIframe ? 'Hide Inline View' : 'Show Inline View'}
            </button>
          </div>

          {embedIframe && (
            <div className="mt-2 space-y-2">
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  If Frigate sends strict <code>X-Frame-Options</code> or CSP headers, the frame below may remain blank. Always use the primary "Open Frigate" button for direct access.
                </span>
              </div>
              <div className="h-96 w-full rounded-xl border border-border-subtle overflow-hidden bg-black">
                <iframe
                  src={config.url}
                  title="Frigate Dashboard Preview"
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
