const express = require('express');
const router = express.Router();
const sosController = require('../controllers/sosController');
const { protect } = require('../middlewares/protect');
const optionalAuth = require('../middlewares/optionalLimiter');

router.post('/panic', protect, sosController.panic);
router.get('/check/:siswaId', optionalAuth, sosController.checkStatus);
router.get('/history/:siswaId', optionalAuth, sosController.getHistory);

module.exports = router;