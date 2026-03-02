const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyToken = require('../middleware/authMiddleware');

// Daftar endpoint API khusus admin dengan pengaman JWT
router.get('/', verifyToken, adminController.getAllAdmins);
router.post('/create', verifyToken, adminController.createAdmin);
router.patch('/:id/update', verifyToken, adminController.updateAdmin);
router.delete('/:id/delete', verifyToken, adminController.deleteAdmin);

module.exports = router;
