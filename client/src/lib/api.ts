import { Device, Deployment, FrigateConfig } from '../types';

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

// Devices API
export async function fetchDevices(): Promise<Device[]> {
  const res = await fetch(`${API_BASE}/devices`);
  const data = await res.json();
  return data.devices || [];
}

export async function createDevice(deviceData: Partial<Device>): Promise<Device> {
  const res = await fetch(`${API_BASE}/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create device');
  }
  return data.device;
}

export async function updateDevice(id: string, updates: Partial<Device>): Promise<Device> {
  const res = await fetch(`${API_BASE}/devices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update device');
  }
  return data.device;
}

export async function deleteDevice(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/devices/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete device');
  }
  return true;
}

export async function checkDevice(id: string): Promise<Device> {
  const res = await fetch(`${API_BASE}/devices/${id}/check`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to test connectivity');
  }
  return data.device;
}

export async function checkAllDevices(): Promise<Device[]> {
  const res = await fetch(`${API_BASE}/devices/check-all`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to test all devices');
  }
  return data.devices;
}

export async function fetchSubnet(): Promise<{ iface: string; ip: string; netmask: string; cidr: string } | null> {
  const res = await fetch(`${API_BASE}/devices/subnet`);
  const data = await res.json();
  return data.subnet || null;
}

export async function scanSubnet(): Promise<{ discoveredCount: number; devices: Device[] }> {
  const res = await fetch(`${API_BASE}/devices/scan`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Subnet scan failed');
  }
  return data;
}

// Deployments API
export async function fetchDeployments(): Promise<Deployment[]> {
  const res = await fetch(`${API_BASE}/deployments`);
  const data = await res.json();
  return data.deployments || [];
}

export async function fetchDeployment(id: string): Promise<Deployment> {
  const res = await fetch(`${API_BASE}/deployments/${id}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch deployment');
  }
  return data.deployment;
}

export async function startDeployment(payload: {
  repoUrl: string;
  targetDeviceId: string;
  command: string;
}): Promise<Deployment> {
  const res = await fetch(`${API_BASE}/deployments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to start deployment');
  }
  return data.deployment;
}

export async function stopDeployment(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/deployments/${id}/stop`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to stop deployment');
  }
  return true;
}

// Frigate API
export async function fetchFrigate(): Promise<FrigateConfig> {
  const res = await fetch(`${API_BASE}/frigate`);
  const data = await res.json();
  return data.frigate;
}

export async function updateFrigate(url: string): Promise<FrigateConfig> {
  const res = await fetch(`${API_BASE}/frigate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update Frigate URL');
  }
  return data.frigate;
}

export async function checkFrigateStatus(): Promise<FrigateConfig> {
  const res = await fetch(`${API_BASE}/frigate/status`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to check Frigate status');
  }
  return data.frigate;
}
