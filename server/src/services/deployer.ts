import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { Client as SshClient } from 'ssh2';
import { store } from './store.js';
import { Deployment, Device } from '../types.js';

/**
 * Validates GitHub repository URL
 */
export function validateRepoUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Repository URL is required' };
  }

  const trimmed = url.trim();

  // Basic sanity check against shell metacharacters
  if (/[\s;`$|&><\\]/.test(trimmed)) {
    return { valid: false, error: 'Repository URL contains invalid characters' };
  }

  // GitHub HTTPS / SSH patterns
  const httpsRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/;
  const sshRegex = /^git@github\.com:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/;

  if (!httpsRegex.test(trimmed) && !sshRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid repository URL. Must be a valid GitHub HTTPS URL (e.g. https://github.com/user/repo)' };
  }

  return { valid: true };
}

/**
 * Safely removes a directory tree
 */
async function cleanWorkspace(dirPath: string) {
  try {
    if (fs.existsSync(dirPath)) {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to cleanup workspace ${dirPath}:`, err);
  }
}

/**
 * Executes deployment on local host
 */
async function deployLocal(deployment: Deployment) {
  const deploymentId = deployment.id;
  const workspaceDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `reboot-${deploymentId}-`));
  const repoDir = path.join(workspaceDir, 'repo');

  let activeChildProcess: any = null;
  let isStopped = false;

  const killFn = () => {
    isStopped = true;
    if (activeChildProcess) {
      try {
        process.kill(-activeChildProcess.pid, 'SIGTERM');
      } catch {
        try {
          activeChildProcess.kill('SIGTERM');
        } catch {
          // ignore
        }
      }
    }
    store.appendLog(deploymentId, {
      timestamp: new Date().toISOString(),
      stream: 'system',
      text: 'Deployment process received STOP signal.',
    });
    store.notifyDeploymentStatus(deploymentId, 'stopped', -1);
    store.updateDeployment(deploymentId, {
      status: 'stopped',
      completedAt: new Date().toISOString(),
      exitCode: -1,
      error: 'Deployment stopped by user.',
    });
  };

  store.registerDeploymentProcess(deploymentId, killFn);

  try {
    store.appendLog(deploymentId, {
      timestamp: new Date().toISOString(),
      stream: 'system',
      text: `[1/3] Created isolated workspace: ${workspaceDir}`,
    });

    // 1. Clone repository
    store.appendLog(deploymentId, {
      timestamp: new Date().toISOString(),
      stream: 'system',
      text: `[2/3] Cloning repository ${deployment.repoUrl} ...`,
    });

    const cloneExitCode = await new Promise<number>((resolve, reject) => {
      const gitClone = spawn('git', ['clone', '--depth', '1', deployment.repoUrl, repoDir], {
        detached: true,
      });
      activeChildProcess = gitClone;

      gitClone.stdout?.on('data', (data) => {
        store.appendLog(deploymentId, {
          timestamp: new Date().toISOString(),
          stream: 'stdout',
          text: data.toString(),
        });
      });

      gitClone.stderr?.on('data', (data) => {
        store.appendLog(deploymentId, {
          timestamp: new Date().toISOString(),
          stream: 'stderr',
          text: data.toString(),
        });
      });

      gitClone.on('close', (code) => {
        activeChildProcess = null;
        resolve(code ?? 1);
      });

      gitClone.on('error', (err) => {
        activeChildProcess = null;
        reject(err);
      });
    });

    if (isStopped) return;

    if (cloneExitCode !== 0) {
      store.appendLog(deploymentId, {
        timestamp: new Date().toISOString(),
        stream: 'stderr',
        text: `Git clone failed with exit code ${cloneExitCode}`,
      });
      store.notifyDeploymentStatus(deploymentId, 'failed', cloneExitCode);
      store.updateDeployment(deploymentId, {
        status: 'failed',
        exitCode: cloneExitCode,
        error: `Git clone failed with code ${cloneExitCode}`,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // 2. Execute user build/deploy command
    store.appendLog(deploymentId, {
      timestamp: new Date().toISOString(),
      stream: 'system',
      text: `[3/3] Executing deployment command: ${deployment.command}`,
    });

    const commandExitCode = await new Promise<number>((resolve, reject) => {
      // Execute in bash with explicit working directory inside cloned repo
      const proc = spawn('bash', ['-c', deployment.command], {
        cwd: repoDir,
        detached: true,
        env: {
          ...process.env,
          CI: 'true',
          NODE_ENV: 'production',
        },
      });
      activeChildProcess = proc;

      proc.stdout?.on('data', (data) => {
        store.appendLog(deploymentId, {
          timestamp: new Date().toISOString(),
          stream: 'stdout',
          text: data.toString(),
        });
      });

      proc.stderr?.on('data', (data) => {
        store.appendLog(deploymentId, {
          timestamp: new Date().toISOString(),
          stream: 'stderr',
          text: data.toString(),
        });
      });

      proc.on('close', (code) => {
        activeChildProcess = null;
        resolve(code ?? 0);
      });

      proc.on('error', (err) => {
        activeChildProcess = null;
        reject(err);
      });
    });

    if (isStopped) return;

    if (commandExitCode === 0) {
      store.appendLog(deploymentId, {
        timestamp: new Date().toISOString(),
        stream: 'system',
        text: '✓ Deployment completed successfully.',
      });
      store.notifyDeploymentStatus(deploymentId, 'successful', 0);
      store.updateDeployment(deploymentId, {
        status: 'successful',
        exitCode: 0,
        completedAt: new Date().toISOString(),
      });
    } else {
      store.appendLog(deploymentId, {
        timestamp: new Date().toISOString(),
        stream: 'stderr',
        text: `✗ Deployment command failed with exit code ${commandExitCode}.`,
      });
      store.notifyDeploymentStatus(deploymentId, 'failed', commandExitCode);
      store.updateDeployment(deploymentId, {
        status: 'failed',
        exitCode: commandExitCode,
        error: `Process exited with code ${commandExitCode}`,
        completedAt: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    if (!isStopped) {
      store.appendLog(deploymentId, {
        timestamp: new Date().toISOString(),
        stream: 'stderr',
        text: `Deployment error: ${err.message}`,
      });
      store.notifyDeploymentStatus(deploymentId, 'failed', -1);
      store.updateDeployment(deploymentId, {
        status: 'failed',
        exitCode: -1,
        error: err.message,
        completedAt: new Date().toISOString(),
      });
    }
  } finally {
    store.unregisterDeploymentProcess(deploymentId);
    // Cleanup temporary workspace after 60 seconds to allow inspecting if needed
    setTimeout(() => {
      cleanWorkspace(workspaceDir);
    }, 60000);
  }
}

/**
 * Executes deployment on remote target using SSH
 */
async function deployRemoteSsh(deployment: Deployment, targetDevice: Device) {
  const deploymentId = deployment.id;

  if (!targetDevice.ssh || !targetDevice.ssh.configured) {
    const errorMsg = `Deployment rejected: Target device "${targetDevice.name}" (${targetDevice.host}) has no SSH credentials configured. Configure SSH settings under Devices before deploying.`;
    store.appendLog(deploymentId, {
      timestamp: new Date().toISOString(),
      stream: 'stderr',
      text: errorMsg,
    });
    store.notifyDeploymentStatus(deploymentId, 'failed', 1);
    store.updateDeployment(deploymentId, {
      status: 'failed',
      exitCode: 1,
      error: errorMsg,
      completedAt: new Date().toISOString(),
    });
    return;
  }

  const sshConfig = targetDevice.ssh;
  const sshClient = new SshClient();
  let isStopped = false;
  let remoteStream: any = null;

  const killFn = () => {
    isStopped = true;
    if (remoteStream) {
      try {
        remoteStream.signal('TERM');
      } catch {
        // ignore
      }
    }
    try {
      sshClient.end();
    } catch {
      // ignore
    }
    store.appendLog(deploymentId, {
      timestamp: new Date().toISOString(),
      stream: 'system',
      text: 'Remote deployment stopped by user.',
    });
    store.notifyDeploymentStatus(deploymentId, 'stopped', -1);
    store.updateDeployment(deploymentId, {
      status: 'stopped',
      exitCode: -1,
      error: 'Deployment stopped by user.',
      completedAt: new Date().toISOString(),
    });
  };

  store.registerDeploymentProcess(deploymentId, killFn);

  try {
    store.appendLog(deploymentId, {
      timestamp: new Date().toISOString(),
      stream: 'system',
      text: `[1/3] Connecting to remote host ${targetDevice.name} (${targetDevice.host}:${sshConfig.port || 22}) as user "${sshConfig.username}" ...`,
    });

    await new Promise<void>((resolve, reject) => {
      sshClient
        .on('ready', () => {
          store.appendLog(deploymentId, {
            timestamp: new Date().toISOString(),
            stream: 'system',
            text: `✓ Connected to remote device ${targetDevice.name} via SSH.`,
          });
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        })
        .connect({
          host: targetDevice.host,
          port: sshConfig.port || 22,
          username: sshConfig.username,
          password: sshConfig.password,
          privateKey: sshConfig.privateKey ? Buffer.from(sshConfig.privateKey) : undefined,
          readyTimeout: 10000,
        });
    });

    if (isStopped) return;

    // Remote workspace and execute
    const remoteWorkspace = `/tmp/reboot-deploy-${deploymentId}`;
    const remoteScript = `
set -e
mkdir -p "${remoteWorkspace}"
cd "${remoteWorkspace}"
echo "[2/3] Cloning ${deployment.repoUrl} on target device..."
git clone --depth 1 "${deployment.repoUrl}" repo
cd repo
echo "[3/3] Executing build/deploy command..."
${deployment.command}
`;

    store.appendLog(deploymentId, {
      timestamp: new Date().toISOString(),
      stream: 'system',
      text: `Initiating remote deployment workflow on target...`,
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      sshClient.exec(remoteScript, (err, stream) => {
        if (err) return reject(err);
        remoteStream = stream;

        stream.on('close', (code: number) => {
          resolve(code ?? 0);
        });

        stream.on('data', (data: Buffer) => {
          store.appendLog(deploymentId, {
            timestamp: new Date().toISOString(),
            stream: 'stdout',
            text: data.toString(),
          });
        });

        stream.stderr.on('data', (data: Buffer) => {
          store.appendLog(deploymentId, {
            timestamp: new Date().toISOString(),
            stream: 'stderr',
            text: data.toString(),
          });
        });
      });
    });

    if (isStopped) return;

    if (exitCode === 0) {
      store.appendLog(deploymentId, {
        timestamp: new Date().toISOString(),
        stream: 'system',
        text: `✓ Remote deployment finished successfully with exit code 0.`,
      });
      store.notifyDeploymentStatus(deploymentId, 'successful', 0);
      store.updateDeployment(deploymentId, {
        status: 'successful',
        exitCode: 0,
        completedAt: new Date().toISOString(),
      });
    } else {
      store.appendLog(deploymentId, {
        timestamp: new Date().toISOString(),
        stream: 'stderr',
        text: `✗ Remote deployment failed with exit code ${exitCode}.`,
      });
      store.notifyDeploymentStatus(deploymentId, 'failed', exitCode);
      store.updateDeployment(deploymentId, {
        status: 'failed',
        exitCode,
        error: `Remote execution failed with exit code ${exitCode}`,
        completedAt: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    if (!isStopped) {
      store.appendLog(deploymentId, {
        timestamp: new Date().toISOString(),
        stream: 'stderr',
        text: `Remote connection error: ${err.message}`,
      });
      store.notifyDeploymentStatus(deploymentId, 'failed', 1);
      store.updateDeployment(deploymentId, {
        status: 'failed',
        exitCode: 1,
        error: err.message,
        completedAt: new Date().toISOString(),
      });
    }
  } finally {
    try {
      sshClient.end();
    } catch {
      // ignore
    }
    store.unregisterDeploymentProcess(deploymentId);
  }
}

/**
 * Main deployment dispatcher
 */
export async function runDeployment(deployment: Deployment) {
  // Update status to running
  store.updateDeployment(deployment.id, {
    status: 'running',
    startedAt: new Date().toISOString(),
  });
  store.notifyDeploymentStatus(deployment.id, 'running');

  const targetDevice = store.getDevice(deployment.targetDeviceId);
  if (!targetDevice) {
    store.appendLog(deployment.id, {
      timestamp: new Date().toISOString(),
      stream: 'stderr',
      text: `Error: Target device ${deployment.targetDeviceId} not found in configured devices.`,
    });
    store.notifyDeploymentStatus(deployment.id, 'failed', 1);
    store.updateDeployment(deployment.id, {
      status: 'failed',
      exitCode: 1,
      error: 'Device not found',
      completedAt: new Date().toISOString(),
    });
    return;
  }

  if (targetDevice.isLocal || targetDevice.host === '127.0.0.1' || targetDevice.host === 'localhost') {
    await deployLocal(deployment);
  } else {
    await deployRemoteSsh(deployment, targetDevice);
  }
}
