const express = require('express');
const router = express.Router();
const translationController = require('../controllers/translationController');
const { protect } = require('../middleware/auth');

router.post('/', protect, translationController.translateContent);

module.exports = router;
