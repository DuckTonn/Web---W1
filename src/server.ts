import app from './app';
import { env } from './config/env';
import { pool } from './db';
import { logger } from './utils/logger';

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
      url: `http://localhost:${env.PORT}`,
    },
    '🚀 Cart API Server started successfully'
  );
});

// Graceful Shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await pool.end();
      logger.info('Database pool connections closed.');
      process.exit(0);
    } catch (err) {
      logger.error({ error: err }, 'Error closing database pool');
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Process-level safeguards against unexpected crashes
process.on('unhandledRejection', (reason) => {
  logger.error({ error: reason }, '💥 Unhandled Promise Rejection detected at process level');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, '💥 Uncaught Exception detected at process level');
  process.exit(1);
});

