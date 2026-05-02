/**
 * Arsip Surat Routes
 * API endpoints for letter archive management
 */
const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/protect');
const arsipSuratController = require('../controllers/arsipSuratController');

// Auth required — schoolId dari JWT/header wajib
router.get('/', protect, arsipSuratController.getArsipSurat);
router.get('/stats', protect, arsipSuratController.getStats);
router.get('/next-nomor', protect, arsipSuratController.getNextNomor);
router.get('/klasifikasi', protect, arsipSuratController.getKlasifikasi);
router.get('/:id', protect, arsipSuratController.getDetail);

// Admin only
router.post('/', protect, arsipSuratController.create);
router.put('/:id', protect, arsipSuratController.update);
router.delete('/:id', protect, arsipSuratController.remove);

// Disposisi
router.post('/:id/disposisi', protect, arsipSuratController.addDisposisi);

// Auto-create from permohonan
router.post('/from-permohonan/:id', protect, arsipSuratController.createFromPermohonan);

module.exports = router;