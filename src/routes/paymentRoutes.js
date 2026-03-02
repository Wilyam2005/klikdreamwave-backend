const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Create payment via Xendit
router.post('/create-xendit', paymentController.createXenditPayment);

// Webhook for Xendit callbacks
router.post('/xendit-webhook', paymentController.xenditWebhook);

// Check payment status from frontend polling
router.get('/status/:sessionId', paymentController.checkPaymentStatus);

module.exports = router;