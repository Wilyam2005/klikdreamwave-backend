const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/printers', verifyToken, deviceController.getPrinters);
router.get('/cameras', verifyToken, deviceController.getCameras);
router.get('/settings', deviceController.getDeviceSettings);
router.post('/settings', verifyToken, deviceController.saveDeviceSettings);
router.get('/files', verifyToken, deviceController.getFiles);
router.delete('/files/:sessionId', verifyToken, deviceController.deleteFiles);

module.exports = router;
