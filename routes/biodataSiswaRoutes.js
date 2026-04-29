// routes/biodataSiswaRoutes.js
// GET /api/get-biodata-siswa-new - get siswa for attendance with formatted structure
const express = require('express');
const router = express.Router();
const optionalAuth = require('../middlewares/optionalLimiter');
const sequelize = require('../config/database');

// GET /api/get-biodata-siswa-new - get biodata siswa for attendance table
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { schoolId, className, search = '', limit = 100 } = req.query;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    const sId = parseInt(schoolId);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 100));

    let where = `WHERE s.schoolId = ${sId} AND s.isActive = 1`;
    if (className) where += ` AND s.class = '${className.replace(/'/g, "''")}'`;
    if (search) where += ` AND (s.name LIKE '%${search.replace(/'/g, "''")}%' OR s.nis LIKE '%${search.replace(/'/g, "''")}%')`;

    const [rows] = await sequelize.query(`
      SELECT s.id, s.name, s.nis, s.nisn, s.class, s.batch, s.photoUrl,
             s.gender, s.statusKehadiran, s.createdAt
      FROM siswa s
      ${where}
      ORDER BY s.name ASC
      LIMIT ${limitNum}
    `);

    // Format as expected by attendance table
    const data = rows.map((s) => ({
      user: {
        name: s.name,
        nisn: s.nisn || 'N/A',
        image: s.photoUrl || '/defaultProfile.png',
      },
      kelas: s.class,
      className: s.class,
      studentId: s.id,
      statusKehadiran: s.statusKehadiran || 'Belum Hadir',
      absensis: [],
    }));

    res.json({
      success: true,
      data,
      pagination: { totalItems: rows.length, limit: limitNum }
    });
  } catch (err) {
    console.error('biodata-siswa-new error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/get-biodata-siswa-new/:id - get single siswa biodata
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await sequelize.query(`
      SELECT s.*, k.namaKelas
      FROM siswa s
      LEFT JOIN kelas k ON s.class = k.namaKelas AND s.schoolId = k.schoolId
      WHERE s.id = ${parseInt(id)}
    `);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Siswa not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('biodata-siswa-new/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
