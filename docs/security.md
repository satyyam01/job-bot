# Security Architecture - Sanitization, Rate Limiting, & API Protection

This document outlines the security controls, validation rules, rate limit settings, and environment validation strategies implemented to protect the **AI Resume Tailor Bot**.

---

## 1. Express Security Stack Hardening

The Express application incorporates a standard set of security middleware at the root of its lifecycle:

- **Helmet (`v8.2.0`)**: Mounts security headers to protect against cross-site scripting (XSS), clickjacking, and MIME-type sniffing.
- **CORS (`v2.8.6`)**: Configured to restrict or allow cross-origin requests, controlling external domain bindings.
- **Header Sanitization**: Express automatically removes the `X-Powered-By` header to prevent server identification.

---

## 2. Input Validation & Environment Verification (`Zod`)

To prevent malformed configurations or runtime application failures, the system uses **Zod** to validate environment variables at startup:

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TELEGRAM_BOT_TOKEN: z.string(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),
  OLLAMA_MODEL: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  FIRECRAWL_API_KEY: z.string(),
  COHERE_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  TELEGRAM_WEBHOOK_URL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1); // Stop server boot on missing variables
}

export const env = parsedEnv.data;
```

This acts as a strict security barrier, ensuring the server will not boot if critical external keys (like `FIRECRAWL_API_KEY` or `TELEGRAM_BOT_TOKEN`) are missing or invalid.

---

## 3. REST API Rate Limiting (`apiRateLimiter`)

The REST API implements rate limiting via `express-rate-limit` to prevent brute force attacks, denial of service (DoS), and rapid LLM credit consumption:

- **Window Interval**: `15 minutes` (`15 * 60 * 1000` milliseconds).
- **Request Cap**: Maximum of `100 requests` per IP within the window.
- **Headers Exposed**:
  - `RateLimit-Limit`: Maximum requests allowed in the window.
  - `RateLimit-Remaining`: Requests remaining in the current window.
  - `RateLimit-Reset`: Time remaining until the rate limit resets.
- **Custom Payload**: Returns a `429 Too Many Requests` status code with a structured JSON error body:
  ```json
  {
    "success": false,
    "error": "Too many requests, please try again later."
  }
  ```

---

## 4. API Attack Surface Reduction & Webhook Validation

### A. URL Ingestion Sanitization
To prevent injection attacks, malformed inputs, or processing arbitrary text, the Telegram bot filters incoming messages through a strict URL validation regex before dispatching them to the parser:

```typescript
const urlRegex = /(https?:\/\/[^\s]+)/g;
```

Only messages containing a valid `http` or `https` URL pattern are accepted, preventing arbitrary text payloads from entering the processing engine.

### B. Secure Webhook Configurations
In production, standard polling mode is disabled in favor of webhook integration to prevent concurrent polling execution:

```typescript
const isDev = env.NODE_ENV === 'development';
const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: isDev });

if (!isDev && env.TELEGRAM_WEBHOOK_URL) {
  bot.setWebHook(`${env.TELEGRAM_WEBHOOK_URL}/api/telegram/webhook`);
}
```

- **Path Obscurity**: Webhooks are routed through `/api/telegram/webhook` to handle incoming Telegram server requests.
- **Webhook Protection**: Production deployments behind reverse proxies (like Nginx, Cloudflare, or AWS ALBs) should restrict access to this path to Telegram's official IP ranges (`149.154.160.0/20` and `91.108.4.0/22`) to prevent malicious payload injections.
- **Express Exception Handling**: The application uses a global error handler to intercept processing errors. If a validation error is caught, it prevents internal stack traces from leaking to clients, returning a standardized JSON error response instead.
