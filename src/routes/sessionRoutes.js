const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

// Endpoint untuk Kiosk membuat session ID (int) di database
router.post('/create', sessionController.createSession);

// Endpoint update preset filter
router.put('/:id/preset', sessionController.updateSessionPreset);

module.exports = router;
