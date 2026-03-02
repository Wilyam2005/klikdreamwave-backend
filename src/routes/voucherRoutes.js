const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const verifyToken = require('../middleware/authMiddleware');

// Route khusus Admin (Harus pakai Token JWT)
router.post('/add', verifyToken, voucherController.createVoucher);
router.get('/', verifyToken, voucherController.getAllVouchers);
router.put('/:id', verifyToken, voucherController.updateVoucher);
router.delete('/:id', verifyToken, voucherController.deleteVoucher);
router.patch('/:id/toggle', verifyToken, voucherController.toggleVoucherStatus);

// Route Publik untuk Layar Kiosk (Pengunjung mengecek voucher)
router.post('/validate', voucherController.validateVoucher);

module.exports = router;