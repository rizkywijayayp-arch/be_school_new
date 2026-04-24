// routes/kepalaAuthRoutes.js - Self-contained with inline controller
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { loginLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// Import model
const GuruTendik = require('../models/guruTendik');

// ── REGISTER KEPALA SEKOLAH ───────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { nama, email, password, telepon, sekolah, nip } = req.body;

    if (!nama || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nama, email, dan password wajib diisi'
      });
    }

    const schoolId = parseInt(sekolah) || 1;

    // Cek email sudah terdaftar
    const existing = await GuruTendik.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat kepala sekolah
    const kepala = await GuruTendik.create({
      nama,
      email,
      password: hashedPassword,
      telepon: telepon || null,
      role: 'kepala',
      schoolId: schoolId,
      nip: nip || null,
      isActive: true,
      qrCodeData: `QR-KEPALA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      jenisKelamin: 'L'
    });

    res.json({
      success: true,
      message: 'Kepala sekolah berhasil didaftarkan',
      data: {
        id: kepala.id,
        nama: kepala.nama,
        email: kepala.email,
        schoolId: kepala.schoolId,
        role: kepala.role
      }
    });

  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── LOGIN KEPALA SEKOLAH ─────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
    }

    // Cek di guruTendik dengan role 'kepala'
    const kepala = await GuruTendik.findOne({
      where: { email, role: 'kepala' }
    });

    if (!kepala) {
      return res.status(401).json({ success: false, message: 'Akun kepala sekolah tidak ditemukan' });
    }

    // Validasi password
    const isMatch = await bcrypt.compare(password, kepala.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Password salah' });
    }

    // Update last login
    kepala.lastLogin = new Date();
    await kepala.save();

    // Generate token
    const token = jwt.sign(
      { id: kepala.id, schoolId: kepala.schoolId, role: 'kepala' },
      process.env.JWT_SECRET || 'secret_key_anda',
      { expiresIn: '365d' }
    );

    res.json({
      success: true,
      message: 'Login berhasil',
      token,
      data: {
        id: kepala.id,
        nama: kepala.nama,
        email: kepala.email,
        telepon: kepala.telepon,
        foto: kepala.foto,
        schoolId: kepala.schoolId,
        role: 'kepala',
        jabatan: kepala.jabatan || 'Kepala Sekolah',
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;