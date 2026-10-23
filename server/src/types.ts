export interface SshConfig {
  port: number;
  username: string;
  configured: boolean;
  authMethod: 'agent' | 'key' | 'password';
  privateKey?: string;
  password?: string;
}

export interface Device {
  id: string;
  name: string;
  host: string;
  type: string;
  role: string;
  isLocal?: boolean;
  ssh?: SshConfig;
  webUrl?: string;
  description?: string;
  status: 'online' | 'offline' | 'unknown';
  statusMessage?: string;
  lastChecked?: string;
}

export type DeploymentStatus = 'queued' | 'running' | 'successful' | 'failed' | 'stopped';

export interface DeploymentLogEntry {
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
}

export interface Deployment {
  id: string;
  repoUrl: string;
  targetDeviceId: string;
  targetDeviceName: string;
  command: string;
  status: DeploymentStatus;
  exitCode?: number | null;
  error?: string | null;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  logs: DeploymentLogEntry[];
}

export interface FrigateConfig {
  url: string;
  status: 'online' | 'offline' | 'unknown';
  statusMessage?: string;
  lastChecked?: string;
}
