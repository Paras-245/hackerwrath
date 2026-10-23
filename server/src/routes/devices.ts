import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { store } from '../services/store.js';
import { checkDeviceConnectivity } from '../services/network.js';
import { detectLocalSubnet, scanSubnet } from '../services/scanner.js';
import { Device } from '../types.js';

const router = Router();

// GET all devices
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    devices: store.getDevices(),
  });
});

// GET detected local subnet information
router.get('/subnet', (_req: Request, res: Response) => {
  const subnet = detectLocalSubnet();
  res.json({
    success: true,
    subnet,
  });
});

// POST scan subnet for live devices
router.post('/scan', async (_req: Request, res: Response) => {
  try {
    const discovered = await scanSubnet();
    res.json({
      success: true,
      discoveredCount: discovered.length,
      discovered,
      devices: store.getDevices(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Subnet scan failed',
    });
  }
});

// POST add new device
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, host, type, role, isLocal, ssh, webUrl, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Device name is required' });
    }

    if (!host || typeof host !== 'string' || !host.trim()) {
      return res.status(400).json({ success: false, error: 'Host or IP address is required' });
    }

    const id = `dev-${crypto.randomBytes(4).toString('hex')}`;
    const newDevice: Device = {
      id,
      name: name.trim(),
      host: host.trim(),
      type: (type && typeof type === 'string' ? type.trim() : 'Linux') || 'Linux',
      role: (role && typeof role === 'string' ? role.trim() : 'Generic node') || 'Generic node',
      isLocal: Boolean(isLocal || host === '127.0.0.1' || host === 'localhost'),
      ssh: ssh
        ? {
            port: Number(ssh.port) || 22,
            username: ssh.username || 'root',
            configured: Boolean(ssh.configured),
            authMethod: ssh.authMethod || 'agent',
            password: ssh.password,
            privateKey: ssh.privateKey,
          }
        : undefined,
      webUrl: webUrl && typeof webUrl === 'string' ? webUrl.trim() : undefined,
      description: description && typeof description === 'string' ? description.trim() : undefined,
      status: 'unknown',
      statusMessage: 'Configured — testing connectivity...',
      lastChecked: new Date().toISOString(),
    };

    store.addDevice(newDevice);

    // Run async check
    checkDeviceConnectivity(newDevice).then((result) => {
      store.updateDevice(id, {
        status: result.status,
        statusMessage: result.message,
        lastChecked: new Date().toISOString(),
      });
    });

    return res.status(201).json({
      success: true,
      device: newDevice,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH edit device
router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = store.getDevice(id);

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }

  const { name, host, type, role, isLocal, ssh, webUrl, description } = req.body;
  const updates: Partial<Device> = {};

  if (name !== undefined) updates.name = String(name).trim();
  if (host !== undefined) updates.host = String(host).trim();
  if (type !== undefined) updates.type = String(type).trim();
  if (role !== undefined) updates.role = String(role).trim();
  if (isLocal !== undefined) updates.isLocal = Boolean(isLocal);
  if (webUrl !== undefined) updates.webUrl = webUrl ? String(webUrl).trim() : undefined;
  if (description !== undefined) updates.description = description ? String(description).trim() : undefined;

  if (ssh !== undefined) {
    updates.ssh = {
      port: Number(ssh.port) || 22,
      username: ssh.username || 'root',
      configured: Boolean(ssh.configured),
      authMethod: ssh.authMethod || 'agent',
      password: ssh.password,
      privateKey: ssh.privateKey,
    };
  }

  const updated = store.updateDevice(id, updates);
  return res.json({ success: true, device: updated });
});

// DELETE remove device
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = store.deleteDevice(id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  return res.json({ success: true, message: 'Device removed' });
});

// POST test connectivity for single device
router.post('/:id/check', async (req: Request, res: Response) => {
  const { id } = req.params;
  const device = store.getDevice(id);
  if (!device) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }

  const result = await checkDeviceConnectivity(device);
  const updated = store.updateDevice(id, {
    status: result.status,
    statusMessage: result.message,
    lastChecked: new Date().toISOString(),
  });

  return res.json({
    success: true,
    device: updated,
    result,
  });
});

// POST check all devices
router.post('/check-all', async (_req: Request, res: Response) => {
  const devices = store.getDevices();
  const results = await Promise.all(
    devices.map(async (device) => {
      const result = await checkDeviceConnectivity(device);
      store.updateDevice(device.id, {
        status: result.status,
        statusMessage: result.message,
        lastChecked: new Date().toISOString(),
      });
      return { id: device.id, ...result };
    })
  );

  return res.json({
    success: true,
    devices: store.getDevices(),
    results,
  });
});

// GET export fleet config as JSON
router.get('/export/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    exportedAt: new Date().toISOString(),
    devices: store.getDevices(),
    frigate: store.getFrigateConfig(),
  });
});

// POST import fleet config from JSON
router.post('/import/config', (req: Request, res: Response) => {
  const { devices, frigate } = req.body;
  if (!Array.isArray(devices)) {
    return res.status(400).json({ success: false, error: 'Expected devices array' });
  }
  for (const d of devices) {
    if (d && d.id && d.name && d.host) {
      store.addDevice(d);
    }
  }
  if (frigate && frigate.url) {
    store.setFrigateUrl(frigate.url);
  }
  return res.json({
    success: true,
    devices: store.getDevices(),
    frigate: store.getFrigateConfig(),
  });
});

export default router;

