import os from 'os';
import net from 'net';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Device } from '../types.js';
import { store } from './store.js';

const execAsync = promisify(exec);

export interface SubnetInfo {
  iface: string;
  ip: string;
  netmask: string;
  cidr: string;
  networkPrefix: string;
}

interface ArpEntry {
  ip: string;
  mac: string;
  iface: string;
}

// In-memory cache for OUI vendor lookup
const ouiCache: Map<string, string> = new Map();

/**
 * Looks up hardware vendor using IEEE OUI database
 */
function getMacVendor(mac: string): string | null {
  if (!mac) return null;
  const clean = mac.toUpperCase().slice(0, 8).replace(/:/g, '-');
  if (ouiCache.has(clean)) return ouiCache.get(clean) || null;

  try {
    const ouiPaths = ['/usr/share/ieee-data/oui.txt', '/var/lib/ieee-data/oui.txt'];
    for (const p of ouiPaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        const idx = content.indexOf(clean);
        if (idx !== -1) {
          const line = content.slice(idx, content.indexOf('\n', idx));
          const vendor = line.split('\t').pop()?.trim() || null;
          if (vendor) {
            ouiCache.set(clean, vendor);
            return vendor;
          }
        }
      }
    }
  } catch {}

  ouiCache.set(clean, '');
  return null;
}

/**
 * Detects the active non-virtual primary network interface and CIDR
 */
export function detectLocalSubnet(): SubnetInfo | null {
  const ifaces = os.networkInterfaces();

  for (const [name, list] of Object.entries(ifaces)) {
    if (!list) continue;
    if (
      name.startsWith('docker') ||
      name.startsWith('br-') ||
      name.startsWith('veth') ||
      name === 'lo'
    ) {
      continue;
    }

    for (const info of list) {
      if (info.family === 'IPv4' && !info.internal && info.netmask === '255.255.255.0') {
        const parts = info.address.split('.');
        const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
        return {
          iface: name,
          ip: info.address,
          netmask: info.netmask,
          cidr: `${prefix}.0/24`,
          networkPrefix: prefix,
        };
      }
    }
  }

  for (const [name, list] of Object.entries(ifaces)) {
    if (!list) continue;
    for (const info of list) {
      if (info.family === 'IPv4' && !info.internal && name !== 'lo') {
        const parts = info.address.split('.');
        const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
        return {
          iface: name,
          ip: info.address,
          netmask: info.netmask,
          cidr: `${prefix}.0/24`,
          networkPrefix: prefix,
        };
      }
    }
  }

  return null;
}

/**
 * Gets default gateway IP
 */
async function getDefaultGateway(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("ip route | grep default | awk '{print $3}'");
    const gw = stdout.trim().split('\n')[0]?.trim();
    return gw || null;
  } catch {
    return null;
  }
}

/**
 * Probes a TCP port with latency measurement
 */
function probePortWithLatency(
  host: string,
  port: number,
  timeoutMs = 800
): Promise<{ open: boolean; latencyMs?: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let done = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      done = true;
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({ open: true, latencyMs });
    });

    socket.on('timeout', () => {
      if (!done) {
        done = true;
        socket.destroy();
        resolve({ open: false });
      }
    });

    socket.on('error', () => {
      if (!done) {
        done = true;
        resolve({ open: false });
      }
    });

    try {
      socket.connect(port, host);
    } catch {
      if (!done) {
        done = true;
        resolve({ open: false });
      }
    }
  });
}

/**
 * Grabs the SSH identification banner (contains OS and OpenSSH version)
 */
function getSshBanner(host: string, timeoutMs = 1500): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let banner = '';
    let done = false;

    socket.setTimeout(timeoutMs);

    socket.on('data', (d) => {
      banner += d.toString('utf-8');
      if (banner.includes('\n')) {
        done = true;
        socket.destroy();
        resolve(banner.trim());
      }
    });

    socket.on('timeout', () => {
      if (!done) {
        done = true;
        socket.destroy();
        resolve(banner.trim() || null);
      }
    });

    socket.on('error', () => {
      if (!done) {
        done = true;
        resolve(null);
      }
    });

    try {
      socket.connect(22, host);
    } catch {
      if (!done) {
        done = true;
        resolve(null);
      }
    }
  });
}

/**
 * Grabs HTTP page title and server header
 */
function getHttpMetadata(
  urlStr: string,
  timeoutMs = 1500
): Promise<{ title?: string; server?: string } | null> {
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
          rejectUnauthorized: false,
          headers: { 'User-Agent': 'Reboot-Scanner/1.0' },
        },
        (res) => {
          let body = '';
          const server = res.headers['server'] as string | undefined;

          res.on('data', (chunk) => {
            body += chunk.toString();
            if (body.length > 4096) res.destroy(); // only need head
          });

          res.on('end', () => {
            const match = body.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = match ? match[1].trim() : undefined;
            resolve({ title, server });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => resolve(null));
      req.end();
    } catch {
      resolve(null);
    }
  });
}

/**
 * Reads hosts and MACs from the system ARP cache table
 */
function getArpEntries(ifaceName?: string): Map<string, ArpEntry> {
  const map = new Map<string, ArpEntry>();
  try {
    if (!fs.existsSync('/proc/net/arp')) return map;
    const content = fs.readFileSync('/proc/net/arp', 'utf-8');
    const lines = content.trim().split('\n').slice(1);

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const ip = parts[0];
      const flags = parts[2];
      const mac = parts[3];
      const dev = parts[5];

      if (flags !== '0x0' && (!ifaceName || dev === ifaceName)) {
        map.set(ip, { ip, mac, iface: dev });
      }
    }
  } catch {}
  return map;
}

/**
 * Scans the local subnet for active devices with deep fingerprinting
 */
export async function scanSubnet(): Promise<Device[]> {
  const subnet = detectLocalSubnet();
  if (!subnet) {
    throw new Error('No active local IPv4 network interface found to scan.');
  }

  const liveIps = new Set<string>();
  const defaultGateway = await getDefaultGateway();

  // 1. Initial ARP cache
  const arpEntries = getArpEntries(subnet.iface);
  arpEntries.forEach((_, ip) => {
    if (ip.startsWith(subnet.networkPrefix)) {
      liveIps.add(ip);
    }
  });

  // 2. Perform fast subnet sweep using fping
  try {
    const { stdout } = await execAsync(
      `fping -a -g -r 1 -t 150 ${subnet.cidr} 2>/dev/null`
    );
    const fpingIps = stdout.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    fpingIps.forEach((ip) => liveIps.add(ip));
  } catch (err: any) {
    if (err.stdout) {
      const fpingIps = err.stdout.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
      fpingIps.forEach((ip: string) => liveIps.add(ip));
    }
  }

  // 3. Fresh ARP inspection after sweep
  const freshArp = getArpEntries(subnet.iface);
  freshArp.forEach((_, ip) => {
    if (ip.startsWith(subnet.networkPrefix)) {
      liveIps.add(ip);
    }
  });

  // Include local host IP
  liveIps.add(subnet.ip);

  const discoveredDevices: Device[] = [];

  // 4. Detailed fingerprinting per discovered host
  for (const ip of Array.from(liveIps)) {
    const isLocalHost = ip === subnet.ip || ip === '127.0.0.1';
    const arp = freshArp.get(ip) || arpEntries.get(ip);
    const mac = arp?.mac || '';
    const vendor = getMacVendor(mac);

    // Concurrently probe ports, SSH banner, and HTTP titles
    const [
      p22,
      p80,
      p443,
      p8971,
      p5000,
      p8080,
      p3000,
      sshBanner,
    ] = await Promise.all([
      probePortWithLatency(ip, 22),
      probePortWithLatency(ip, 80),
      probePortWithLatency(ip, 443),
      probePortWithLatency(ip, 8971),
      probePortWithLatency(ip, 5000),
      probePortWithLatency(ip, 8080),
      probePortWithLatency(ip, 3000),
      probePortWithLatency(ip, 22).then((res) => (res.open ? getSshBanner(ip) : null)),
    ]);

    // Check for web metadata if web ports open
    let httpMeta: { title?: string; server?: string } | null = null;
    let webUrl: string | undefined = undefined;

    if (p8971.open) {
      webUrl = `https://${ip}:8971/`;
      httpMeta = await getHttpMetadata(webUrl);
    } else if (p5000.open) {
      webUrl = `http://${ip}:5000/`;
      httpMeta = await getHttpMetadata(webUrl);
    } else if (p80.open) {
      webUrl = `http://${ip}/`;
      httpMeta = await getHttpMetadata(webUrl);
    } else if (p443.open) {
      webUrl = `https://${ip}/`;
      httpMeta = await getHttpMetadata(webUrl);
    } else if (p3000.open) {
      webUrl = `http://${ip}:3000/`;
      httpMeta = await getHttpMetadata(webUrl);
    } else if (p8080.open) {
      webUrl = `http://${ip}:8080/`;
      httpMeta = await getHttpMetadata(webUrl);
    }

    // Determine latency
    const latency = [
      p22.latencyMs,
      p80.latencyMs,
      p8971.latencyMs,
      p443.latencyMs,
      p5000.latencyMs,
    ].find((l) => l !== undefined);

    const latencyStr = latency !== undefined ? `${latency}ms` : '<5ms';

    // Parse SSH Banner
    let osHint = 'Linux';
    let sshVersion = '';
    if (sshBanner) {
      sshVersion = sshBanner.replace('SSH-2.0-', '');
      if (sshBanner.toLowerCase().includes('debian')) {
        osHint = 'Debian Linux';
      } else if (sshBanner.toLowerCase().includes('ubuntu')) {
        osHint = 'Ubuntu Linux';
      } else if (sshBanner.toLowerCase().includes('raspbian') || sshBanner.toLowerCase().includes('raspberry')) {
        osHint = 'Raspberry Pi OS';
      } else if (sshBanner.toLowerCase().includes('dropbear')) {
        osHint = 'Embedded Linux (Dropbear)';
      } else if (sshBanner.toLowerCase().includes('freebsd')) {
        osHint = 'FreeBSD';
      }
    }

    // Determine smart name, type, and role
    let name = `Node (${ip})`;
    let type = osHint;
    let role = 'Generic compute node';

    if (isLocalHost) {
      name = `Reboot Host (${os.hostname() || 'Local'})`;
      role = 'Management & Dashboard Host';
      type = `${os.type()} (${os.arch()})`;
      webUrl = 'http://127.0.0.1:5173';
    } else if (ip === defaultGateway) {
      name = `Default Gateway Router (${ip})`;
      role = 'Network Gateway';
      type = vendor ? `Router (${vendor})` : 'Network Gateway Router';
    } else if (p8971.open || p5000.open || httpMeta?.title?.toLowerCase().includes('frigate')) {
      name = `Frigate NVR (${ip})`;
      role = 'NVR Surveillance Host';
      type = 'Frigate Container';
    } else if (httpMeta?.title) {
      name = `${httpMeta.title.slice(0, 24)} (${ip})`;
      role = 'Web Service';
      type = httpMeta.server ? `${httpMeta.server}` : 'Web Appliance';
    } else if (p22.open) {
      if (osHint === 'Debian Linux') {
        name = `Debian Linux Node (${ip})`;
        type = `Debian (${sshVersion || 'OpenSSH'})`;
      } else if (vendor) {
        // e.g. AzureWave, Intel, Raspberry Pi
        name = `${vendor.split(' ')[0]} Linux Node (${ip})`;
        type = `Linux · ${sshVersion || 'SSH'}`;
      } else {
        name = `Linux Server (${ip})`;
        type = `Linux (${sshVersion || 'OpenSSH'})`;
      }
      role = 'Compute node';
    } else if (vendor) {
      name = `${vendor.split(' ')[0]} Device (${ip})`;
      type = `${vendor}`;
      role = 'Network Hardware';
    }

    // Build rich informative description
    const descParts: string[] = [];
    if (vendor) descParts.push(`Hardware: ${vendor}`);
    if (mac) descParts.push(`MAC: ${mac}`);
    if (sshVersion) descParts.push(`SSH: ${sshVersion}`);
    if (httpMeta?.server) descParts.push(`Web: ${httpMeta.server}`);
    if (latencyStr) descParts.push(`Ping: ${latencyStr}`);

    const description = descParts.join(' · ') || `Subnet node on ${subnet.cidr}`;

    // Status message
    const statusDetails: string[] = [];
    if (p22.open) statusDetails.push(sshVersion ? `SSH (${sshVersion})` : 'SSH open');
    if (p8971.open || p5000.open) statusDetails.push('Frigate active');
    if (p80.open || p443.open) statusDetails.push('Web responsive');
    if (latencyStr) statusDetails.push(latencyStr);

    const statusMessage = statusDetails.length > 0 ? statusDetails.join(', ') : 'Host reachable';

    const deviceId = isLocalHost ? 'local-reboot' : `dev-${ip.replace(/\./g, '-')}`;
    const existing = store.getDevice(deviceId);

    const device: Device = {
      id: deviceId,
      name: existing?.name && !existing.name.startsWith('Node (') && !existing.name.startsWith('SSH Node (')
        ? existing.name
        : name,
      host: ip,
      type: existing?.type || type,
      role: existing?.role || role,
      isLocal: isLocalHost,
      description: existing?.description || description,
      webUrl: existing?.webUrl || webUrl,
      ssh: {
        port: existing?.ssh?.port || 22,
        username: existing?.ssh?.username || 'root',
        configured: existing?.ssh?.configured ?? p22.open,
        authMethod: existing?.ssh?.authMethod || 'agent',
        password: existing?.ssh?.password,
        privateKey: existing?.ssh?.privateKey,
      },
      status: 'online',
      statusMessage,
      lastChecked: new Date().toISOString(),
    };

    store.addDevice(device);
    discoveredDevices.push(device);
  }

  return discoveredDevices;
}
