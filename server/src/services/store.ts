import { Device, Deployment, DeploymentLogEntry, DeploymentStatus, FrigateConfig } from '../types.js';

class Store {
  private devices: Map<string, Device> = new Map();
  private deployments: Map<string, Deployment> = new Map();
  private deploymentProcesses: Map<string, () => void> = new Map();
  private deploymentListeners: Map<string, Set<(log: DeploymentLogEntry, status?: DeploymentStatus, exitCode?: number | null) => void>> = new Map();
  private frigateConfig: FrigateConfig = {
    url: 'https://localhost:8971/',
    status: 'unknown',
    statusMessage: 'Not checked yet',
  };

  constructor() {
    this.seedDefaultDevices();
  }

  private seedDefaultDevices() {
    // 1. Reboot Host (Local machine)
    const localHost: Device = {
      id: 'local-reboot',
      name: 'Reboot Host (Debian/Linux)',
      host: '127.0.0.1',
      type: 'Debian / Linux',
      role: 'Management & Dashboard Host',
      isLocal: true,
      webUrl: 'http://127.0.0.1:5173',
      description: 'Host running Reboot dashboard and local build orchestration',
      status: 'online',
      statusMessage: 'Local runtime environment operational',
      lastChecked: new Date().toISOString(),
    };
    this.devices.set(localHost.id, localHost);
  }


  // Device methods
  getDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  getDevice(id: string): Device | undefined {
    return this.devices.get(id);
  }

  addDevice(device: Device): Device {
    this.devices.set(device.id, device);
    return device;
  }

  updateDevice(id: string, updates: Partial<Device>): Device | undefined {
    const existing = this.devices.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.devices.set(id, updated);
    return updated;
  }

  deleteDevice(id: string): boolean {
    return this.devices.delete(id);
  }

  // Deployment methods
  getDeployments(): Deployment[] {
    return Array.from(this.deployments.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getDeployment(id: string): Deployment | undefined {
    return this.deployments.get(id);
  }

  createDeployment(deployment: Deployment): Deployment {
    this.deployments.set(deployment.id, deployment);
    return deployment;
  }

  updateDeployment(id: string, updates: Partial<Deployment>): Deployment | undefined {
    const existing = this.deployments.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.deployments.set(id, updated);
    return updated;
  }

  appendLog(deploymentId: string, entry: DeploymentLogEntry) {
    const dep = this.deployments.get(deploymentId);
    if (dep) {
      dep.logs.push(entry);
    }
    const listeners = this.deploymentListeners.get(deploymentId);
    if (listeners) {
      listeners.forEach((listener) => listener(entry));
    }
  }

  registerDeploymentProcess(id: string, killFn: () => void) {
    this.deploymentProcesses.set(id, killFn);
  }

  unregisterDeploymentProcess(id: string) {
    this.deploymentProcesses.delete(id);
  }

  stopDeploymentProcess(id: string): boolean {
    const killFn = this.deploymentProcesses.get(id);
    if (killFn) {
      killFn();
      this.deploymentProcesses.delete(id);
      return true;
    }
    return false;
  }

  addDeploymentListener(
    id: string,
    listener: (log: DeploymentLogEntry, status?: DeploymentStatus, exitCode?: number | null) => void
  ) {
    if (!this.deploymentListeners.has(id)) {
      this.deploymentListeners.set(id, new Set());
    }
    this.deploymentListeners.get(id)!.add(listener);
  }

  removeDeploymentListener(
    id: string,
    listener: (log: DeploymentLogEntry, status?: DeploymentStatus, exitCode?: number | null) => void
  ) {
    const listeners = this.deploymentListeners.get(id);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  notifyDeploymentStatus(id: string, status: DeploymentStatus, exitCode?: number | null) {
    const dep = this.deployments.get(id);
    if (dep) {
      dep.status = status;
      if (exitCode !== undefined) dep.exitCode = exitCode;
    }
    const listeners = this.deploymentListeners.get(id);
    if (listeners) {
      const dummyLog: DeploymentLogEntry = {
        timestamp: new Date().toISOString(),
        stream: 'system',
        text: `Deployment transitioned to status: ${status}${exitCode !== undefined ? ` (Exit code: ${exitCode})` : ''}`,
      };
      listeners.forEach((l) => l(dummyLog, status, exitCode));
    }
  }

  // Frigate methods
  getFrigateConfig(): FrigateConfig {
    return this.frigateConfig;
  }

  setFrigateUrl(url: string): FrigateConfig {
    this.frigateConfig.url = url;
    return this.frigateConfig;
  }

  updateFrigateStatus(status: 'online' | 'offline' | 'unknown', message?: string) {
    this.frigateConfig.status = status;
    this.frigateConfig.statusMessage = message;
    this.frigateConfig.lastChecked = new Date().toISOString();
  }
}

export const store = new Store();
