import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import { env } from '../config/env';
import { logger } from '../logs/logger';
import { JobProcessorService } from '../services/jobProcessor';

// Initialize the bot (polling for dev, but can be switched to webhook)
const isDev = env.NODE_ENV === 'development';
const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: isDev });

if (!isDev && env.TELEGRAM_WEBHOOK_URL) {
  bot.setWebHook(`${env.TELEGRAM_WEBHOOK_URL}/api/telegram/webhook`);
}

// Extract URL from message
const urlRegex = /(https?:\/\/[^\s]+)/g;

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  if (text.startsWith('/start')) {
    return bot.sendMessage(chatId, 'Welcome to the AI Resume Tailor! Send me a job posting URL to get started.');
  }

  const urls = text.match(urlRegex);
  if (!urls) {
    return bot.sendMessage(chatId, 'Please send a valid job posting URL.');
  }

  const jobUrl = urls[0];
  
  // Acknowledge receipt
  await bot.sendMessage(chatId, '⏳ Processing your resume tailoring request... This may take up to a minute.');

  // Process the job URL
  const result = await JobProcessorService.processJobUrl(jobUrl);

  if (!result.success) {
    return bot.sendMessage(chatId, `❌ Sorry, an error occurred while processing the job: ${result.error}`);
  }

  // Send the tailored resume in chunks if it exceeds Telegram's 4096 char limit
  const resumeText = String(result.tailoredResume);
  const chunkSize = 4000;
  const chunks = [];
  for (let i = 0; i < resumeText.length; i += chunkSize) {
    chunks.push(resumeText.substring(i, i + chunkSize));
  }
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const prefix = i === 0 ? '*Tailored Resume Summary (Plain Text):*\n\n' : '';
      await bot.sendMessage(chatId, prefix + chunk, { parse_mode: 'Markdown' });
    } catch (err: any) {
      logger.warn('Markdown parsing failed for Telegram chunk, sending as raw text.');
      const prefix = i === 0 ? 'Tailored Resume Summary (Plain Text):\n\n' : '';
      await bot.sendMessage(chatId, prefix + chunk);
    }
  }

  // Send the PDF and LaTeX documents as frictionless attachments
  if (result.pdfPath) {
    try {
      // 1. Send compiled PDF
      if (fs.existsSync(result.pdfPath)) {
        await bot.sendDocument(chatId, result.pdfPath);
      }

      // 2. Send LaTeX source file
      const texPath = result.pdfPath.replace('.pdf', '.tex');
      if (fs.existsSync(texPath)) {
        await bot.sendDocument(chatId, texPath);
      }
    } catch (err: any) {
      logger.error(`Failed to send PDF or LaTeX documents over Telegram: ${err.message}`);
    }
  }
});

export { bot };
