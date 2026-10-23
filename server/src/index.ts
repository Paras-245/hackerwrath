import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import devicesRouter from './routes/devices.js';
import deploymentsRouter from './routes/deployments.js';
import frigateRouter from './routes/frigate.js';
import { store } from './services/store.js';
import { setupSshWebSocket } from './services/sshSession.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || '127.0.0.1';

// Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// API health endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Reboot Backend',
    version: '1.1.0',
    uptime: process.uptime(),
    deviceCount: store.getDevices().length,
    deploymentCount: store.getDeployments().length,
  });
});

// Mount modular routes
app.use('/api/devices', devicesRouter);
app.use('/api/deployments', deploymentsRouter);
app.use('/api/frigate', frigateRouter);

// Global 404 handler for API routes
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Setup SSH WebSocket Server on same HTTP server
setupSshWebSocket(server);

// Start listening
server.listen(PORT, HOST, () => {
  console.log(`[Reboot] Server running at http://${HOST}:${PORT}`);
  console.log(`[Reboot] Security: Bound to ${HOST} by default (trusted local-first environment).`);
});
