import { Groq } from 'groq-sdk';
import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../logs/logger';

// Initialize Groq client only if key is present
const groq = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

export class InferenceService {
  /**
   * General text generation with retry logic, dynamically routing to Ollama or Groq.
   */
  static async generateText(prompt: string, maxRetries = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (env.OLLAMA_MODEL) {
          // Use Ollama
          const response = await axios.post(`${env.OLLAMA_BASE_URL}/api/generate`, {
            model: env.OLLAMA_MODEL,
            prompt: prompt,
            stream: false,
            options: {
              temperature: 0.7
            }
          });
          return response.data.response || '';
        } else if (groq) {
          // Use Groq
          const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: env.GROQ_MODEL,
            temperature: 0.7,
          });
          return completion.choices[0]?.message?.content || '';
        } else {
          throw new Error('Neither OLLAMA_MODEL nor GROQ_API_KEY is configured.');
        }
      } catch (error: any) {
        logger.error(`[Inference] generateText attempt ${attempt} failed: ${error.message}`);
        if (attempt === maxRetries) throw error;
        
        // Detect 429 rate limits and scale backoff pacing to 3s to let token bucket replenish
        const isRateLimit = error.message.includes('429') || 
                            error.message.toLowerCase().includes('rate limit') || 
                            error.status === 429;
        const waitTime = isRateLimit ? 3000 : 1500;
        
        logger.info(`[Inference] Pacing execution delay for ${waitTime}ms before retry.`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
    return '';
  }

  /**
   * Generates structured JSON output, dynamically routing to Ollama or Groq.
   */
  static async generateStructuredData(prompt: string, maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (env.OLLAMA_MODEL) {
          // Use Ollama with JSON format enforcement
          const response = await axios.post(`${env.OLLAMA_BASE_URL}/api/generate`, {
            model: env.OLLAMA_MODEL,
            prompt: `You are a helpful assistant that outputs strictly in JSON format.\n\n${prompt}`,
            stream: false,
            format: "json", // Enforce JSON mode on Ollama
            options: {
              temperature: 0.2 // Lower temp for deterministic JSON
            }
          });
          
          const content = response.data.response;
          if (!content) throw new Error('Empty response from Ollama');
          return JSON.parse(content);

        } else if (groq) {
          // Use Groq with JSON mode
          const completion = await groq.chat.completions.create({
            messages: [
              { 
                role: 'system', 
                content: 'You are a helpful assistant that outputs strictly in JSON format.' 
              },
              { role: 'user', content: prompt }
            ],
            model: env.GROQ_MODEL,
            temperature: 0.2, 
            response_format: { type: 'json_object' },
          });

          const content = completion.choices[0]?.message?.content;
          if (!content) throw new Error('Empty response from Groq');
          
          return JSON.parse(content);
        } else {
           throw new Error('Neither OLLAMA_MODEL nor GROQ_API_KEY is configured.');
        }
      } catch (error: any) {
        logger.error(`[Inference] generateStructuredData attempt ${attempt} failed: ${error.message}`);
        if (attempt === maxRetries) throw error;
        
        // Detect 429 rate limits and scale backoff pacing to 3s to let token bucket replenish
        const isRateLimit = error.message.includes('429') || 
                            error.message.toLowerCase().includes('rate limit') || 
                            error.status === 429;
        const waitTime = isRateLimit ? 3000 : 1500;
        
        logger.info(`[Inference] Pacing execution delay for ${waitTime}ms before retry.`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
    return {};
  }
}
