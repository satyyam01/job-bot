import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
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

  // Save and send the tailored resume documents as attachments
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const txtPath = path.join(logsDir, `tailored_resume_${timestamp}.txt`);
    const texPath = path.join(logsDir, `tailored_resume_${timestamp}.tex`);

    // 1. Always write and send the TXT file containing plain text resume
    fs.writeFileSync(txtPath, result.tailoredResume || '', 'utf-8');
    if (fs.existsSync(txtPath)) {
      await bot.sendDocument(chatId, txtPath);
    }

    // 2. Always write and send the TEX file containing LaTeX source code
    fs.writeFileSync(texPath, result.tailoredLatex || '', 'utf-8');
    if (fs.existsSync(texPath)) {
      await bot.sendDocument(chatId, texPath);
    }

    // 3. Send compiled PDF if available and compilation succeeded
    if (result.pdfPath && fs.existsSync(result.pdfPath)) {
      await bot.sendDocument(chatId, result.pdfPath);
    } else {
      logger.warn('[Telegram Bot] PDF path not found or compilation failed, skipping PDF attachment.');
    }
  } catch (err: any) {
    logger.error(`Failed to send tailored resume documents over Telegram: ${err.message}`);
  }
});

export { bot };
