import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../logs/logger';

export class FirecrawlService {
  /**
   * Scrape a job description URL and return markdown content
   */
  static async scrapeJobDescription(url: string, maxRetries = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          'https://api.firecrawl.dev/v1/scrape',
          { url, formats: ['markdown'] },
          {
            headers: {
              'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data && response.data.success) {
           if (response.data.data && response.data.data.markdown) {
             return response.data.data.markdown;
           } else if (response.data.markdown) {
             return response.data.markdown;
           }
        }
        
        throw new Error(`Invalid response structure: ${JSON.stringify(response.data)}`);
      } catch (error: any) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        logger.error(`[Firecrawl] scrape attempt ${attempt} failed for URL ${url}: ${errorMessage}`);
        if (attempt === maxRetries) throw new Error(`Firecrawl Error: ${errorMessage}`);
      }
    }
    return '';
  }
}
