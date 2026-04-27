/**
 * Permohonan Routes
 * API endpoints untuk permohonan surat
 */

const express = require('express');
const router = express.Router();
const permohonanController = require('../controllers/permohonanController');
const { validateApiKey } = require('../middlewares/apiKeyAuth');
const { Op } = require('sequelize');

// ============================================================
// PUBLIC ROUTES (Tenant website - requires API key)
// ============================================================

// Submit permohonan baru
router.post('/', validateApiKey, permohonanController.createPermohonan);

// Track permohonan by ID + email
router.get('/track/:id', permohonanController.trackPermohonan);

// ============================================================
// ADMIN ROUTES (Admin dashboard - requires API key)
// ============================================================

// List permohonan
router.get('/', validateApiKey, permohonanController.getPermohonan);

// Get detail permohonan
router.get('/:id', validateApiKey, permohonanController.getPermohonanDetail);

// Update status (approve/reject/proses)
router.put('/:id/status', validateApiKey, permohonanController.updateStatus);

// Update permohonan
router.put('/:id', validateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const Permohonan = require('../models/permohonan');

    const permohonan = await Permohonan.findByPk(id);

    if (!permohonan) {
      return res.status(404).json({
        success: false,
        message: 'Permohonan tidak ditemukan'
      });
    }

    const { dataPemohon, catatanAdmin, fileSuratUrl, nomorSurat, prioritas } = req.body;

    if (dataPemohon !== undefined) permohonan.dataPemohon = dataPemohon;
    if (catatanAdmin !== undefined) permohonan.catatanAdmin = catatanAdmin;
    if (fileSuratUrl !== undefined) permohonan.fileSuratUrl = fileSuratUrl;
    if (nomorSurat !== undefined) permohonan.nomorSurat = nomorSurat;
    if (prioritas !== undefined) permohonan.prioritas = prioritas;

    await permohonan.save();

    res.json({
      success: true,
      data: permohonan,
      message: 'Permohonan berhasil diupdate'
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete permohonan (soft delete)
router.delete('/:id', validateApiKey, permohonanController.deletePermohonan);

// Get stats
router.get('/stats/summary', validateApiKey, permohonanController.getStats);

module.exports = router;