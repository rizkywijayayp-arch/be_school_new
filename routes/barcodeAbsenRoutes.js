// routes/barcodeAbsenRoutes.js
// POST /api/create-barcode-absen - generate QR code token for attendance
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/protect');
const crypto = require('crypto');

// Simple in-memory store for active tokens (in production, use Redis)
const activeTokens = new Map();

// POST /api/create-barcode-absen - generate barcode token
router.post('/', protect, async (req, res) => {
  try {
    const { schoolId, className, expiresInMinutes = 30 } = req.body;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + (expiresInMinutes * 60 * 1000));

    activeTokens.set(token, {
      schoolId: parseInt(schoolId),
      className: className || null,
      createdBy: req.userId || null,
      createdAt: new Date(),
      expiresAt,
    });

    // Auto-expire after configured time
    setTimeout(() => {
      activeTokens.delete(token);
    }, expiresInMinutes * 60 * 1000);

    res.json({
      success: true,
      data: {
        token,
        expiresAt: expiresAt.toISOString(),
        className: className || 'all',
      }
    });
  } catch (err) {
    console.error('create-barcode-absen error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/create-barcode-absen/verify/:token - verify barcode token
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const record = activeTokens.get(token);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Token not found or expired' });
    }

    if (new Date() > record.expiresAt) {
      activeTokens.delete(token);
      return res.status(410).json({ success: false, message: 'Token expired' });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        schoolId: record.schoolId,
        className: record.className,
        expiresAt: record.expiresAt.toISOString(),
      }
    });
  } catch (err) {
    console.error('verify-barcode error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
