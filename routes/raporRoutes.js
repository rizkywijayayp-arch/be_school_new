// routes/raporRoutes.js
const express = require('express');
const router = express.Router();
const raporController = require('../controllers/raporController');
const { protect } = require('../middlewares/protect');
const optionalAuth = require('../middlewares/optionalLimiter');

// Routes
router.get('/:siswaId', optionalAuth, raporController.getRaporBySiswa);
router.post('/', protect, raporController.createRapor);
router.put('/nilai/:id', protect, raporController.updateNilai);
router.delete('/:id', protect, raporController.deleteRapor);

module.exports = router;
