import express, { Express } from 'express';
import cors from 'cors';
import { apiReference } from '@scalar/express-api-reference';
import { requestIdMiddleware } from './middlewares/request-id';
import { httpLogger } from './middlewares/http-logger';
import { errorHandler } from './middlewares/error-handler';
import routes from './routes';
import { openApiDocument } from './docs/openapi';
import { AppError } from './utils/app-error';

const app: Express = express();

// 1. Tracing Middleware (Must run first to attach req.id and set X-Request-Id header)
app.use(requestIdMiddleware);

// 2. Structured HTTP Request Logging (Pino)
app.use(httpLogger);

// 3. Security & Parser Middlewares
app.use(cors());
app.use(express.json());

// 4. OpenAPI Specification Raw JSON Endpoint
app.get('/openapi.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiDocument);
});

// 5. Interactive API Documentation via Scalar UI
app.use(
  '/docs',
  apiReference({
    spec: {
      content: openApiDocument,
    },
    theme: 'purple',
    pageTitle: 'Cart RESTful API Reference',
  })
);

// 6. Mount Application Routes
app.use('/', routes);

// 7. 404 Handler for Undefined Routes
app.use((req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
});

// 8. Centralized Global Error Handler (Conforms to Error Contract)
app.use(errorHandler);

export default app;
