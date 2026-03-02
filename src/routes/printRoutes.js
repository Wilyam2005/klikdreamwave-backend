const express = require('express');
const router = express.Router();
const printController = require('../controllers/printController');

router.post('/add', printController.addToQueue);

module.exports = router;