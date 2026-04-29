// routes/userSiswaRoutes.js
// Alias: /api/user-siswa -> forwards to siswa table with user info format
const express = require('express');
const router = express.Router();
const optionalAuth = require('../middlewares/optionalLimiter');
const sequelize = require('../config/database');

// GET /api/user-siswa - get siswa list for admin PDF generation
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { schoolId, search = '', filterClass, filterBatch, page = 1, limit = 100 } = req.query;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    const sId = parseInt(schoolId);

    let where = `WHERE s.schoolId = ${sId}`;
    if (search) where += ` AND (s.name LIKE '%${search.replace(/'/g, "''")}%' OR s.nis LIKE '%${search.replace(/'/g, "''")}%' OR s.nisn LIKE '%${search.replace(/'/g, "''")}%')`;
    if (filterClass) where += ` AND s.class = '${filterClass.replace(/'/g, "''")}'`;
    if (filterBatch) where += ` AND s.batch = '${filterBatch.replace(/'/g, "''")}'`;

    const [rows] = await sequelize.query(`
      SELECT s.id, s.name, s.nis, s.nisn, s.class as className, s.batch, s.gender,
             s.nik, s.birthPlace, s.birthDate, s.photoUrl, s.qrCodeData,
             s.rfidUid, s.parentId, s.statusKehadiran, s.isActive,
             s.createdAt, s.updatedAt
      FROM siswa s
      ${where}
      ORDER BY s.name ASC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM siswa s ${where}`);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: rows,
      pagination: { page: pageNum, limit: limitNum, totalItems: total, totalPages }
    });
  } catch (err) {
    console.error('user-siswa error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/user-siswa/:id - get single siswa
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await sequelize.query(`
      SELECT s.*, p.name as parentName, p.phone as parentPhone
      FROM siswa s
      LEFT JOIN orang_tua p ON s.parentId = p.id
      WHERE s.id = ${parseInt(id)}
    `);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Siswa not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('user-siswa/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
