/**
 * Arsip Surat Routes
 * API endpoints for letter archive management
 */
const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/protect');
const arsipSuratController = require('../controllers/arsipSuratController');

// Public tracking (optional auth)
router.get('/', optionalAuth, arsipSuratController.getArsipSurat);
router.get('/stats', optionalAuth, arsipSuratController.getStats);
router.get('/next-nomor', optionalAuth, arsipSuratController.getNextNomor);
router.get('/klasifikasi', optionalAuth, arsipSuratController.getKlasifikasi);
router.get('/:id', optionalAuth, arsipSuratController.getDetail);

// Admin only
router.post('/', protect, arsipSuratController.create);
router.put('/:id', protect, arsipSuratController.update);
router.delete('/:id', protect, arsipSuratController.remove);

// Disposisi
router.post('/:id/disposisi', protect, arsipSuratController.addDisposisi);

// Auto-create from permohonan
router.post('/from-permohonan/:id', protect, arsipSuratController.createFromPermohonan);

module.exports = router;