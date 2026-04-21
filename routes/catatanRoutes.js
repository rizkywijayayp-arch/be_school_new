const express = require('express');
const router = express.Router();
const catatanController = require('../controllers/catatanController');
const { protect } = require('../middlewares/protect');
const optionalAuth = require('../middlewares/optionalLimiter');

// Catatan siswa routes
router.get('/siswa/:siswaId', optionalAuth, catatanController.getCatatanSiswa);
router.post('/siswa', protect, catatanController.createCatatanSiswa);
router.get('/guru/:guruId', optionalAuth, catatanController.getCatatanGuru);
router.post('/guru', protect, catatanController.createCatatanGuru);
router.get('/bk/:siswaId', optionalAuth, catatanController.getBkAssessments);
router.post('/bk', protect, catatanController.createBkAssessment);

module.exports = router;