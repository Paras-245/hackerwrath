import React, { useState, useEffect, useRef } from 'react';
import {
  Rocket,
  Github,
  Server,
  Terminal as TerminalIcon,
  Play,
  Square,
  AlertCircle,
  HelpCircle,
  Info,
  History,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Device, Deployment, DeploymentLogEntry, DeploymentStatus } from '../types';
import { startDeployment, stopDeployment } from '../lib/api';
import { Terminal } from '../components/Terminal';
import { StatusBadge } from '../components/StatusBadge';

interface DeploymentsProps {
  devices: Device[];
  deployments: Deployment[];
  onRefreshDeployments: () => void;
}

export const Deployments: React.FC<DeploymentsProps> = ({
  devices,
  deployments,
  onRefreshDeployments,
}) => {
  // Form states
  const [repoUrl, setRepoUrl] = useState('https://github.com/octocat/Hello-World');
  const [targetDeviceId, setTargetDeviceId] = useState<string>(
    devices.length > 0 ? devices[0].id : ''
  );
  const [command, setCommand] = useState('cat README || echo "Build completed successfully."');

  // Active deployment and logs
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [currentLogs, setCurrentLogs] = useState<DeploymentLogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<DeploymentStatus | undefined>(undefined);
  const [currentExitCode, setCurrentExitCode] = useState<number | null | undefined>(undefined);
  const [currentError, setCurrentError] = useState<string | null | undefined>(undefined);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Update target device default if not set
  useEffect(() => {
    if (!targetDeviceId && devices.length > 0) {
      setTargetDeviceId(devices[0].id);
    }
  }, [devices, targetDeviceId]);

  // Connect SSE when activeDeploymentId changes
  useEffect(() => {
    if (!activeDeploymentId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/deployments/${activeDeploymentId}/logs`);
    eventSourceRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          setCurrentLogs(data.logs || []);
          if (data.status) setCurrentStatus(data.status);
          if (data.exitCode !== undefined) setCurrentExitCode(data.exitCode);
        } else if (data.type === 'log') {
          if (data.log) {
            setCurrentLogs((prev) => [...prev, data.log]);
          }
          if (data.status) {
            setCurrentStatus(data.status);
            if (data.status === 'successful' || data.status === 'failed' || data.status === 'stopped') {
              onRefreshDeployments();
            }
          }
          if (data.exitCode !== undefined) {
            setCurrentExitCode(data.exitCode);
          }
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    sse.onerror = () => {
      // Stream closed or error
    };

    return () => {
      sse.close();
    };
  }, [activeDeploymentId, onRefreshDeployments]);

  // Select historical deployment to inspect
  const handleSelectHistorical = (dep: Deployment) => {
    setActiveDeploymentId(dep.id);
    setCurrentLogs(dep.logs || []);
    setCurrentStatus(dep.status);
    setCurrentExitCode(dep.exitCode);
    setCurrentError(dep.error);
  };

  const selectedDevice = devices.find((d) => d.id === targetDeviceId);
  const isRunning = currentStatus === 'running' || currentStatus === 'queued';

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!repoUrl.trim()) {
      setFormError('GitHub repository URL is required.');
      return;
    }
    if (!targetDeviceId) {
      setFormError('Please select a target device.');
      return;
    }
    if (!command.trim()) {
      setFormError('Build or deployment command is required.');
      return;
    }

    // Remote device check
    if (selectedDevice && !selectedDevice.isLocal && selectedDevice.host !== '127.0.0.1') {
      if (!selectedDevice.ssh || !selectedDevice.ssh.configured) {
        setFormError(
          `Target "${selectedDevice.name}" has no SSH deployment configured. Please edit the device under "Devices" and enable SSH credentials.`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      setCurrentLogs([]);
      setCurrentStatus('queued');
      setCurrentExitCode(undefined);
      setCurrentError(undefined);

      const deployment = await startDeployment({
        repoUrl: repoUrl.trim(),
        targetDeviceId,
        command: command.trim(),
      });

      setActiveDeploymentId(deployment.id);
      setCurrentStatus(deployment.status);
      onRefreshDeployments();
    } catch (err: any) {
      setFormError(err.message || 'Failed to start deployment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStop = async () => {
    if (!activeDeploymentId) return;
    try {
      await stopDeployment(activeDeploymentId);
      onRefreshDeployments();
    } catch (err: any) {
      alert(`Failed to stop deployment: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-border-subtle pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          GitHub Deployment Orchestrator
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          Deploy code from Git directly to your local node or remote SSH targets (e.g. PS4 Linux).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 5 cols */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-canvas-card border border-border-subtle shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
              <Rocket className="w-4 h-4 text-accent-light" />
              <h2 className="text-sm font-semibold text-text-primary">New Deployment</h2>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleDeploy} className="space-y-4">
              {/* Repository URL */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  GitHub Repository URL
                </label>
                <div className="relative">
                  <Github className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/user/repository"
                    disabled={isRunning}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary font-mono disabled:opacity-50"
                    required
                  />
                </div>
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRepoUrl('https://github.com/octocat/Hello-World');
                      setCommand('cat README || echo "Hello from Octocat"');
                    }}
                    className="text-[11px] text-text-muted hover:text-accent-light"
                  >
                    Demo 1: Octocat Sample
                  </button>
                  <span className="text-[11px] text-text-faint">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRepoUrl('https://github.com/expressjs/express');
                      setCommand('ls -la && node -v');
                    }}
                    className="text-[11px] text-text-muted hover:text-accent-light"
                  >
                    Demo 2: Express Inspection
                  </button>
                </div>
              </div>

              {/* Target Device */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Target Device
                </label>
                <div className="relative">
                  <Server className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                  <select
                    value={targetDeviceId}
                    onChange={(e) => setTargetDeviceId(e.target.value)}
                    disabled={isRunning}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary disabled:opacity-50"
                    required
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.host}) — {d.isLocal ? 'Local Runtime' : d.ssh?.configured ? 'SSH Configured' : 'No SSH'}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedDevice && !selectedDevice.isLocal && !selectedDevice.ssh?.configured && (
                  <p className="mt-1 text-[11px] text-amber-400">
                    Warning: This remote device has no SSH credentials. Configure SSH in "Devices" before deploying remotely.
                  </p>
                )}
              </div>

              {/* Build Command */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-text-secondary">
                    Build / Deployment Command
                  </label>
                  <span className="text-[10px] text-text-muted">Runs inside repo root</span>
                </div>
                <div className="relative">
                  <TerminalIcon className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="e.g. npm install && npm run build"
                    disabled={isRunning}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle focus:border-accent focus:outline-none text-text-primary font-mono disabled:opacity-50"
                    required
                  />
                </div>
                <div className="mt-1 p-2 rounded-lg bg-canvas-muted/50 border border-border-subtle/50 text-[11px] text-text-muted flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 text-accent-light mt-0.5" />
                  <span>
                    <strong>Important:</strong> Build commands (e.g. <code>npm run build</code>) compile artifacts. If running a daemon, append your start command or verify process exit behavior.
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                {isRunning ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors shadow-sm"
                  >
                    <Square className="w-4 h-4" />
                    <span>Stop Active Deployment</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    <span>{submitting ? 'Initiating...' : 'Deploy to Selected Node'}</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Recent Deployments List */}
          <div className="p-4 rounded-2xl bg-canvas-card border border-border-subtle space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary pb-2 border-b border-border-subtle">
              <History className="w-3.5 h-3.5 text-text-muted" />
              <span>Session History ({deployments.length})</span>
            </div>

            {deployments.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-3">
                No deployments recorded during this session.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {deployments.map((dep) => (
                  <button
                    key={dep.id}
                    onClick={() => handleSelectHistorical(dep)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                      activeDeploymentId === dep.id
                        ? 'bg-accent/10 border-accent/40 text-text-primary'
                        : 'bg-canvas border-border-subtle text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="truncate pr-2 space-y-0.5">
                      <div className="font-mono text-[11px] truncate font-medium">
                        {dep.repoUrl.replace('https://github.com/', '')}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        → {dep.targetDeviceName}
                      </div>
                    </div>
                    <StatusBadge status={dep.status} size="sm" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Output: 7 cols */}
        <div className="lg:col-span-7 space-y-4">
          <Terminal
            logs={currentLogs}
            status={currentStatus}
            exitCode={currentExitCode}
            error={currentError}
            onStop={handleStop}
            isRunning={isRunning}
          />
        </div>
      </div>
    </div>
  );
};
