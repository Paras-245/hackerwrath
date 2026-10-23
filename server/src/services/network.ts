import * as net from 'net';
import http from 'http';
import https from 'https';
import { Device } from '../types.js';

export interface ConnectivityResult {
  status: 'online' | 'offline' | 'unknown';
  message: string;
}

/**
 * Probes a TCP port with timeout
 */
function probeTcp(host: string, port: number, timeoutMs = 3500): Promise<{ reachable: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let hasReturned = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      hasReturned = true;
      socket.destroy();
      resolve({ reachable: true });
    });

    socket.on('timeout', () => {
      if (!hasReturned) {
        hasReturned = true;
        socket.destroy();
        resolve({ reachable: false, error: 'Connection timed out' });
      }
    });

    socket.on('error', (err) => {
      if (!hasReturned) {
        hasReturned = true;
        socket.destroy();
        resolve({ reachable: false, error: err.message });
      }
    });

    try {
      socket.connect(port, host);
    } catch (err: any) {
      if (!hasReturned) {
        hasReturned = true;
        resolve({ reachable: false, error: err.message });
      }
    }
  });
}

/**
 * Probes an HTTP/HTTPS endpoint with timeout
 */
function probeHttp(urlStr: string, timeoutMs = 3500): Promise<{ reachable: boolean; status?: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request(
        {
          method: 'GET',
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname || '/',
          timeout: timeoutMs,
          rejectUnauthorized: false, // For self-signed certificates in home labs
          headers: {
            'User-Agent': 'Reboot-Dashboard/1.0',
          },
        },
        (res) => {
          // Any HTTP response (including 200, 301, 401, 403, 404, 500) confirms device is reachable and serving HTTP!
          resolve({ reachable: true, status: res.statusCode });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({ reachable: false, error: 'HTTP request timed out' });
      });

      req.on('error', (err) => {
        resolve({ reachable: false, error: err.message });
      });

      req.end();
    } catch (err: any) {
      resolve({ reachable: false, error: err.message });
    }
  });
}

/**
 * Performs connectivity check based on device configuration
 */
export async function checkDeviceConnectivity(device: Device): Promise<ConnectivityResult> {
  // 1. Local host
  if (device.isLocal || device.host === '127.0.0.1' || device.host === 'localhost') {
    return {
      status: 'online',
      message: 'Local machine runtime active',
    };
  }

  // 2. Check HTTP web interface if configured
  if (device.webUrl) {
    const httpRes = await probeHttp(device.webUrl);
    if (httpRes.reachable) {
      return {
        status: 'online',
        message: `HTTP endpoint reachable (${httpRes.status || 200} OK)`,
      };
    }
  }

  // 3. Check SSH if configured
  if (device.ssh && device.ssh.configured) {
    const sshPort = device.ssh.port || 22;
    const tcpRes = await probeTcp(device.host, sshPort);
    if (tcpRes.reachable) {
      return {
        status: 'online',
        message: `SSH service active on port ${sshPort}`,
      };
    } else {
      return {
        status: 'offline',
        message: `SSH port ${sshPort} unreachable: ${tcpRes.error || 'Connection failed'}`,
      };
    }
  }

  // 4. Fallback TCP probe to common ports (80, 22, 443)
  const probe80 = await probeTcp(device.host, 80, 1500);
  if (probe80.reachable) {
    return {
      status: 'online',
      message: 'TCP port 80 responsive',
    };
  }

  const probe22 = await probeTcp(device.host, 22, 1500);
  if (probe22.reachable) {
    return {
      status: 'online',
      message: 'TCP port 22 responsive',
    };
  }

  return {
    status: 'offline',
    message: 'Host unreachable across configured ports',
  };
}

/**
 * Health check for Frigate NVR
 */
export async function checkFrigateConnectivity(url: string): Promise<ConnectivityResult> {
  if (!url) {
    return { status: 'unknown', message: 'No Frigate URL configured' };
  }

  // First try /api/version
  try {
    const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const apiCheck = await probeHttp(`${normalizedUrl}/api/version`, 3000);
    if (apiCheck.reachable && apiCheck.status && apiCheck.status >= 200 && apiCheck.status < 400) {
      return {
        status: 'online',
        message: 'Frigate NVR API responding normally',
      };
    }

    // Try base URL
    const baseCheck = await probeHttp(normalizedUrl, 3000);
    if (baseCheck.reachable) {
      return {
        status: 'online',
        message: `Frigate web portal active (${baseCheck.status || 200})`,
      };
    }

    return {
      status: 'offline',
      message: baseCheck.error || 'Frigate service unreachable at specified address',
    };
  } catch (err: any) {
    return {
      status: 'offline',
      message: err.message || 'Failed to connect to Frigate',
    };
  }
}
