import { Router } from 'express';
import productRoutes from './product.routes';
import cartRoutes from './cart.routes';
import { testDbConnection } from '../db';

const router = Router();

// Health check endpoint
router.get('/health', async (_req, res) => {
  const isDbHealthy = await testDbConnection();
  const status = isDbHealthy ? 'healthy' : 'degraded';
  res.status(isDbHealthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    database: isDbHealthy ? 'connected' : 'disconnected',
  });
});

// Resource routes
router.use('/products', productRoutes);
router.use('/carts', cartRoutes);

export default router;
