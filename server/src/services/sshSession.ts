import { WebSocket, WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { spawn } from 'child_process';
import { Client as SshClient } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { store } from './store.js';

export function setupSshWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/api/ssh/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const deviceId = url.searchParams.get('deviceId');

    if (!deviceId) {
      ws.send('\r\n\x1b[31m[Reboot SSH] Error: No deviceId parameter provided.\x1b[0m\r\n');
      ws.close();
      return;
    }

    const device = store.getDevice(deviceId);
    if (!device) {
      ws.send(`\r\n\x1b[31m[Reboot SSH] Error: Device ${deviceId} not found in configured fleet.\x1b[0m\r\n`);
      ws.close();
      return;
    }

    ws.send(`\r\n\x1b[36m⚡ [Reboot Web SSH Portal]\x1b[0m Connecting to \x1b[1m${device.name}\x1b[0m (${device.host})...\r\n`);

    // 1. Local terminal session
    if (device.isLocal || device.host === '127.0.0.1' || device.host === 'localhost') {
      try {
        const shell = spawn('bash', ['-i'], {
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          },
        });

        ws.send(`\x1b[32m✓ Connected to local shell on Reboot Host (${process.platform}).\x1b[0m\r\n\r\n`);

        shell.stdout?.on('data', (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data.toString('utf-8'));
          }
        });

        shell.stderr?.on('data', (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data.toString('utf-8'));
          }
        });

        shell.on('close', (code) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(`\r\n\x1b[33m[Session closed with code ${code}]\x1b[0m\r\n`);
            ws.close();
          }
        });

        ws.on('message', (msg) => {
          try {
            const str = msg.toString();
            if (str.startsWith('{') && str.endsWith('}')) {
              try {
                const parsed = JSON.parse(str);
                if (parsed.type === 'resize') {
                  return;
                }
              } catch {
                // not json
              }
            }
            shell.stdin?.write(str);
          } catch (err) {
            console.error('Local shell write error:', err);
          }
        });

        ws.on('close', () => {
          try {
            shell.kill('SIGHUP');
          } catch {
            // ignore
          }
        });
      } catch (err: any) {
        ws.send(`\r\n\x1b[31m[Reboot SSH] Failed to spawn local shell: ${err.message}\x1b[0m\r\n`);
        ws.close();
      }
      return;
    }

    // 2. Remote SSH session
    if (!device.ssh || !device.ssh.configured) {
      ws.send(
        `\r\n\x1b[31m[Reboot SSH] Error: SSH is not configured for "${device.name}".\x1b[0m\r\n` +
        `\x1b[33mPlease edit this device in the "Devices" tab and provide SSH port and credentials.\x1b[0m\r\n\r\n`
      );
      ws.close();
      return;
    }

    const sshClient = new SshClient();
    const ssh = device.ssh;
    let remoteStream: any = null;

    // Buffer incoming WebSocket messages before remoteStream is established
    const pendingInput: string[] = [];

    ws.on('message', (msg) => {
      const str = msg.toString();
      if (str.startsWith('{') && str.endsWith('}')) {
        try {
          const parsed = JSON.parse(str);
          if (parsed.type === 'resize' && parsed.cols && parsed.rows && remoteStream) {
            remoteStream.setWindow(parsed.rows, parsed.cols, 0, 0);
            return;
          }
        } catch {
          // not json
        }
      }

      if (remoteStream) {
        try {
          remoteStream.write(str);
        } catch (e) {
          console.error('Remote stream write error:', e);
        }
      } else {
        pendingInput.push(str);
      }
    });

    sshClient
      .on('ready', () => {
        ws.send(`\x1b[32m✓ SSH handshake succeeded. Allocating PTY session...\x1b[0m\r\n`);

        const ptyOpts = {
          term: 'xterm-256color',
          rows: 30,
          cols: 100,
        };

        const setupStream = (stream: any) => {
          remoteStream = stream;

          // Send any buffered user input
          while (pendingInput.length > 0) {
            const input = pendingInput.shift();
            if (input) stream.write(input);
          }

          stream.on('data', (data: Buffer) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data.toString('utf-8'));
            }
          });

          stream.stderr.on('data', (data: Buffer) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data.toString('utf-8'));
            }
          });

          stream.on('close', () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('\r\n\x1b[33m[Remote SSH session ended]\x1b[0m\r\n');
              ws.close();
            }
            sshClient.end();
          });

          stream.on('error', (err: any) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(`\r\n\x1b[31m[Remote stream error: ${err?.message || err}]\x1b[0m\r\n`);
            }
          });

          // Send initial carriage return to trigger prompt display if idle
          try {
            stream.write('\r');
          } catch {}
        };

        sshClient.shell(ptyOpts, (err, stream) => {
          if (err) {
            // If xterm-256color was rejected, retry with plain vt100 or default shell
            sshClient.shell({ term: 'vt100' }, (err2, stream2) => {
              if (err2) {
                // Last fallback: raw shell without PTY
                sshClient.shell(false as any, (err3: any, stream3: any) => {
                  if (err3) {
                    ws.send(`\r\n\x1b[31m[Reboot SSH] PTY allocation failed: ${err.message}\x1b[0m\r\n`);
                    ws.close();
                    return;
                  }
                  setupStream(stream3);
                });
                return;
              }
              setupStream(stream2);
            });
            return;
          }

          setupStream(stream);
        });
      })
      .on('error', (err) => {
        ws.send(`\r\n\x1b[31m[Reboot SSH] Connection failed: ${err.message}\x1b[0m\r\n`);
        ws.close();
      });

    ws.on('close', () => {
      try {
        sshClient.end();
      } catch {
        // ignore
      }
    });

    // Auto-resolve private key if not explicitly entered
    let privateKey: Buffer | undefined = undefined;
    if (ssh.privateKey) {
      privateKey = Buffer.from(ssh.privateKey);
    } else {
      const edKeyPath = path.join(os.homedir(), '.ssh', 'id_ed25519');
      const rsaKeyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
      if (fs.existsSync(edKeyPath)) {
        try {
          privateKey = fs.readFileSync(edKeyPath);
        } catch {}
      } else if (fs.existsSync(rsaKeyPath)) {
        try {
          privateKey = fs.readFileSync(rsaKeyPath);
        } catch {}
      }
    }

    try {
      sshClient.connect({
        host: device.host,
        port: ssh.port || 22,
        username: ssh.username || 'root',
        password: ssh.password || undefined,
        privateKey,
        agent: process.env.SSH_AUTH_SOCK || undefined,
        readyTimeout: 10000,
        keepaliveInterval: 10000,
      });
    } catch (err: any) {
      ws.send(`\r\n\x1b[31m[Reboot SSH] Socket setup error: ${err.message}\x1b[0m\r\n`);
      ws.close();
    }
  });

  console.log('[Reboot] Web SSH WebSocket server initialized on /api/ssh/ws');
}
