import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { store } from '../services/store.js';
import { validateRepoUrl, runDeployment } from '../services/deployer.js';
import { Deployment, DeploymentLogEntry, DeploymentStatus } from '../types.js';

const router = Router();

// GET all deployments
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    deployments: store.getDeployments(),
  });
});

// POST start new deployment
router.post('/', async (req: Request, res: Response) => {
  try {
    const { repoUrl, targetDeviceId, command } = req.body;

    // 1. Check if another deployment is currently running
    const activeDeployments = store.getDeployments().filter((d) => d.status === 'running');
    if (activeDeployments.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Another deployment (${activeDeployments[0].id}) is currently in progress. Please wait for it to complete or stop it.`,
      });
    }

    // 2. Validate URL
    const urlCheck = validateRepoUrl(repoUrl);
    if (!urlCheck.valid) {
      return res.status(400).json({ success: false, error: urlCheck.error });
    }

    // 3. Validate command
    if (!command || typeof command !== 'string' || !command.trim()) {
      return res.status(400).json({ success: false, error: 'Build/deploy command is required' });
    }

    // 4. Validate target device
    if (!targetDeviceId || typeof targetDeviceId !== 'string') {
      return res.status(400).json({ success: false, error: 'Target device must be selected' });
    }

    const device = store.getDevice(targetDeviceId);
    if (!device) {
      return res.status(400).json({ success: false, error: 'Selected target device does not exist' });
    }

    // If remote, verify SSH configuration is present
    if (!device.isLocal && (device.host !== '127.0.0.1' && device.host !== 'localhost')) {
      if (!device.ssh || !device.ssh.configured) {
        return res.status(400).json({
          success: false,
          error: `Remote device "${device.name}" does not have SSH configured. Remote deployment requires SSH configuration.`,
        });
      }
    }

    const id = `dep-${crypto.randomBytes(4).toString('hex')}`;
    const newDeployment: Deployment = {
      id,
      repoUrl: repoUrl.trim(),
      targetDeviceId: device.id,
      targetDeviceName: device.name,
      command: command.trim(),
      status: 'queued',
      createdAt: new Date().toISOString(),
      logs: [
        {
          timestamp: new Date().toISOString(),
          stream: 'system',
          text: `Deployment ${id} queued for target "${device.name}" (${device.host})`,
        },
      ],
    };

    store.createDeployment(newDeployment);

    // Trigger execution asynchronously
    runDeployment(newDeployment).catch((err) => {
      console.error('Deployment execution error:', err);
    });

    return res.status(201).json({
      success: true,
      deployment: newDeployment,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET single deployment
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deployment = store.getDeployment(id);
  if (!deployment) {
    return res.status(404).json({ success: false, error: 'Deployment not found' });
  }
  return res.json({ success: true, deployment });
});

// GET Server-Sent Events (SSE) live logs stream
router.get('/:id/logs', (req: Request, res: Response) => {
  const { id } = req.params;
  const deployment = store.getDeployment(id);
  if (!deployment) {
    return res.status(404).json({ success: false, error: 'Deployment not found' });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connected event with existing logs and current status
  res.write(
    `data: ${JSON.stringify({
      type: 'init',
      status: deployment.status,
      exitCode: deployment.exitCode,
      logs: deployment.logs,
    })}\n\n`
  );

  // Listener for ongoing logs and status changes
  const listener = (log: DeploymentLogEntry, status?: DeploymentStatus, exitCode?: number | null) => {
    res.write(
      `data: ${JSON.stringify({
        type: 'log',
        log,
        status,
        exitCode,
      })}\n\n`
    );
  };

  store.addDeploymentListener(id, listener);

  req.on('close', () => {
    store.removeDeploymentListener(id, listener);
    res.end();
  });
});

// POST stop deployment
router.post('/:id/stop', (req: Request, res: Response) => {
  const { id } = req.params;
  const deployment = store.getDeployment(id);
  if (!deployment) {
    return res.status(404).json({ success: false, error: 'Deployment not found' });
  }

  if (deployment.status !== 'running' && deployment.status !== 'queued') {
    return res.status(400).json({
      success: false,
      error: `Deployment is not currently active (status: ${deployment.status})`,
    });
  }

  const stopped = store.stopDeploymentProcess(id);
  return res.json({
    success: true,
    message: stopped ? 'Stop signal dispatched to active deployment process' : 'Deployment marked stopped',
  });
});

export default router;
