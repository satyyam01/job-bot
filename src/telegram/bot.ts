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

  const atsMessage = `🎯 *ATS Score Estimate: ${result.atsScore}%*\n\n` +
    `*How it is calculated:*\n` +
    `• *Semantic Match (25%)*: Cosine similarity between resume vocabulary and job description requirements via Cohere embeddings.\n` +
    `• *Authenticity Check (25%)*: Filters out recruiter buzzwords and generic corporate fluff.\n` +
    `• *Domain Compatibility (20%)*: LLM-in-the-loop plausibility audits to prevent semantic contamination.\n` +
    `• *Systems Tone Calibration (15%)*: Verifies active, systems-engineering action verbs.\n` +
    `• *Conciseness (10%)*: Restricts word footprint expansion and verbal bloat.\n` +
    `• *Keyword Alignment (5%)*: Tracks direct alignment gains for high-signal technical keywords.`;

  try {
    await bot.sendMessage(chatId, atsMessage, { parse_mode: 'Markdown' });
  } catch (err: any) {
    logger.warn('Markdown parsing failed for ATS message, sending as plain text.');
    const plainAtsMessage = atsMessage.replace(/\*/g, '');
    await bot.sendMessage(chatId, plainAtsMessage);
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
