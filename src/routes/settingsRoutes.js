const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const verifyToken = require('../middleware/authMiddleware'); // Panggil penjaga pintu

// Terapkan middleware di rute ini
router.get('/', settingsController.getSettings);
router.post('/', verifyToken, settingsController.updateSetting);

module.exports = router;