const express = require('express');
const router = express.Router();
const presetController = require('../controllers/presetController');
const verifyToken = require('../middleware/authMiddleware');
const multer = require('multer');

// Gunakan multer untuk upload asset if needed
const upload = multer({ dest: 'uploads/presets/' });

// Route Kiosk / Publik
router.get('/', presetController.getActivePresets);

// Route Admin
router.post('/', verifyToken, upload.fields([{ name: 'file_xmp', maxCount: 1 }, { name: 'file_lut', maxCount: 1 }]), presetController.addPreset);
router.put('/:id', verifyToken, upload.fields([{ name: 'file_xmp', maxCount: 1 }, { name: 'file_lut', maxCount: 1 }]), presetController.updatePreset);
router.delete('/:id', verifyToken, presetController.deletePreset);
// Route get all (including inactive) for admin
router.get('/all', verifyToken, presetController.getAllPresets);

module.exports = router;
