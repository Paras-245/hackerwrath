import { Router, Request, Response } from 'express';
import { store } from '../services/store.js';
import { checkFrigateConnectivity } from '../services/network.js';

const router = Router();

// GET Frigate config
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    frigate: store.getFrigateConfig(),
  });
});

// PUT update Frigate URL
router.put('/', async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ success: false, error: 'Frigate URL is required' });
  }

  const trimmedUrl = url.trim();
  try {
    new URL(trimmedUrl);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL format' });
  }

  const updatedConfig = store.setFrigateUrl(trimmedUrl);

  // Run check asynchronously
  checkFrigateConnectivity(trimmedUrl).then((result) => {
    store.updateFrigateStatus(result.status, result.message);
  });

  return res.json({
    success: true,
    frigate: updatedConfig,
  });
});

// GET force check Frigate status
router.get('/status', async (_req: Request, res: Response) => {
  const config = store.getFrigateConfig();
  const result = await checkFrigateConnectivity(config.url);
  store.updateFrigateStatus(result.status, result.message);

  return res.json({
    success: true,
    frigate: store.getFrigateConfig(),
    result,
  });
});

export default router;
