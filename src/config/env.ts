import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TELEGRAM_BOT_TOKEN: z.string(),
  GROQ_API_KEY: z.string().optional(), // Make optional if using Ollama
  GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),
  OLLAMA_MODEL: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  FIRECRAWL_API_KEY: z.string(),
  COHERE_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
