import { Router } from 'express';
import { ApiController } from '../controllers/apiController';

const router = Router();

// Test processing via API directly
router.post('/process-job', ApiController.processJob);

// Webhook for telegram in production
router.post('/telegram/webhook', ApiController.telegramWebhook);

export default router;
