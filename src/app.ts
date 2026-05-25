import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { env } from './config/env';
import { logger } from './logs/logger';
import routes from './routes';
import './telegram/bot'; // Initialize telegram bot

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiRateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import and use routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

if (require.main === module) {
  const PORT = env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT} in ${env.NODE_ENV} mode`);
  });
}

export default app;
