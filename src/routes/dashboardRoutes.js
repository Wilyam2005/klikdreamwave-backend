const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const verifyToken = require('../middleware/authMiddleware');

// Statistik Dashboard
router.get('/', verifyToken, dashboardController.getDashboardStats);

// Status Hardware Realtime
router.get('/status', verifyToken, dashboardController.getHardwareStatus);

// Export Data ke Excel
router.get('/export-excel', verifyToken, dashboardController.exportTransactionsToExcel);

// Bersihkan Riwayat (Gunakan dengan hati-hati!)
router.delete('/clear-history', verifyToken, dashboardController.clearHistory);

module.exports = router;