const express = require('express');
const router = express.Router();
const frameController = require('../controllers/frameController');
const verifyToken = require('../middleware/authMiddleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/assets/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, 'asset-' + Date.now() + path.extname(file.originalname));
    }
});
const uploadAsset = multer({ storage: storage });

const frameStorage = multer.diskStorage({
    destination: 'uploads/frames/',
    filename: (req, file, cb) => cb(null, 'frame-' + Date.now() + path.extname(file.originalname))
});
const uploadFrame = multer({ storage: frameStorage });

router.get('/', frameController.getAllFrames);

router.post('/', verifyToken, uploadFrame.single('frame_image'), frameController.addFrame);
router.put('/:id', verifyToken, uploadFrame.single('frame_image'), frameController.updateFrame);
router.delete('/:id', verifyToken, frameController.deleteFrame);

// Generic asset upload for background etc
router.post('/upload-asset', verifyToken, uploadAsset.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.status(200).json({ file_path: `/uploads/assets/${req.file.filename}` });
});

module.exports = router;