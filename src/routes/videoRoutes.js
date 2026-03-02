const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

// Endpoint untuk memerintahkan backend membuat video
router.post('/generate', videoController.createSlideshow);

module.exports = router;