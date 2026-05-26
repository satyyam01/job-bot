# Backend Architecture - Express, Services & Middleware

This document provides a deep dive into the backend configuration, Express runtime, API endpoints, controller layer, logging infrastructure, and error-handling mechanisms of the **AI Resume Tailor Bot**.

---

## 1. Directory Structure & Module Blueprint

The backend codebase is written in TypeScript and compiled or executed dynamically using `tsx` or `ts-node` during development. Below is a blueprint of the backend folder structure:

```text
src/
├── config/
│   └── env.ts                 # Runtime environment schema validation
├── controllers/
│   └── apiController.ts       # Express router controllers and bot mappings
├── logs/
│   └── logger.ts              # Winston structured logging settings
├── middleware/
│   ├── errorHandler.ts        # Global exception and Zod validation interceptor
│   └── rateLimiter.ts         # express-rate-limit implementation
├── routes/
│   └── index.ts               # REST endpoints router definition
├── services/
│   └── jobProcessor.ts        # Ingestion and tailoring orchestrator service
├── app.ts                     # Main Express server and middleware bindings
```

---

## 2. Express Server Configuration (`app.ts`)

The Express application configuration is designed for security and rate control. The server mounts security middleware at the root to harden API endpoints:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { env } from './config/env';
import { logger } from './logs/logger';
import routes from './routes';
import './telegram/bot'; // Bootstraps and registers Telegram Bot events

const app = express();

// Security Hardening
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply Rate Limiting to REST endpoints
app.use('/api/', apiRateLimiter);

// Health Monitoring Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mounting API Router
app.use('/api', routes);

// Global Exception Interceptor
app.use(errorHandler);

if (require.main === module) {
  const PORT = env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT} in ${env.NODE_ENV} mode`);
  });
}

export default app;
```

---

## 3. Controller Architecture (`ApiController`)

The controller layer (`src/controllers/apiController.ts`) separates HTTP requests from core business services, mapping them to the backend orchestrator:

```typescript
import { Request, Response, NextFunction } from 'express';
import { JobProcessorService } from '../services/jobProcessor';
import { bot } from '../telegram/bot';

export class ApiController {
  /**
   * Directly processes a job URL and returns a tailored resume and ATS score.
   * Path: POST /api/process-job
   */
  static async processJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
      }

      const result = await JobProcessorService.processJobUrl(url);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Telegram Webhook receiver. Processes incoming bot updates in production.
   * Path: POST /api/telegram/webhook
   */
  static async telegramWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  }
}
```

---

## 4. Winston Logging Infrastructure (`logger.ts`)

Logging uses **Winston** to capture system warnings, trace LLM API states, and track errors across both standard output and files:

```typescript
import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize } = winston.format;

// Custom Print Layout
const myFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] : ${message} `;
  if (Object.keys(metadata).length > 0) {
    msg += JSON.stringify(metadata);
  }
  return msg;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: combine(
    timestamp(),
    // Colorize output under development, uncolorize in logs files
    env.NODE_ENV === 'development' ? colorize() : winston.format.uncolorize(),
    myFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

---

## 5. Middleware Stack

### A. Global Error Interceptor (`errorHandler.ts`)
Intercepts server errors and formats them into a clean client-facing JSON structure. It specifically catches Zod validation issues (e.g. invalid request structures or missing environment values) and returns a validation breakdown:

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logs/logger';
import { ZodError } from 'zod';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(err);

  // Return a 400 Bad Request on Zod Validation Failures
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.issues,
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};
```

### B. REST API Rate Limiter (`rateLimiter.ts`)
Protects against brute force and server overload by limiting each IP to 100 requests per 15-minute window:

```typescript
import rateLimit from 'express-rate-limit';

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true, // Return standard RateLimit headers
  legacyHeaders: false, // Disable X-RateLimit headers
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});
```
