const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const multer = require('multer');

// Standard Upload (Fallback)
const upload = multer({ dest: 'uploads/photos/' });

// Check DSLR connectivity
router.get('/dslr-status', async (req, res) => {
    const cameraHelper = require('../utils/cameraHelper');
    const installed = cameraHelper.isDigiCamInstalled();
    const connected = await cameraHelper.checkDSLRConnected().catch(() => false);
    console.log(`[DSLR-STATUS] installed=${installed}, connected=${connected}`);
    res.json({ installed, connected });
});

// DSLR Capture Trigger
router.post('/capture-dslr', photoController.captureWithDSLR);

// Webcam Capture via Post (Browser sends Blob/File)
router.post('/capture-webcam', upload.single('image'), photoController.captureWebcam);

// Session Photos (only chosen)
router.get('/session/:sessionId', photoController.getSessionPhotos);

// Mark chosen photo among takes
router.post('/mark-chosen', photoController.markChosen);

// Result QR
router.get('/result-qr/:sessionId', photoController.generateResultQR);

// Generate GIF
router.post('/generate-gif/:sessionId', photoController.generateSessionGif);

module.exports = router;