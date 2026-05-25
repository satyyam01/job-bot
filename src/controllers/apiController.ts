import { Request, Response, NextFunction } from 'express';
import { JobProcessorService } from '../services/jobProcessor';
import { bot } from '../telegram/bot';

export class ApiController {
  
  /**
   * Manual endpoint to process a job url
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
   * Telegram Webhook handler
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
