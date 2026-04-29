// routes/presenceHistoryRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/protect');
const optionalAuth = require('../middlewares/optionalLimiter');
const Attendance = require('../models/kehadiran');
const Siswa = require('../models/siswa');
const GuruTendik = require('../models/guruTendik');
const sequelize = require('../config/database');

// GET /api/presence/history - get attendance history
router.get('/history', optionalAuth, async (req, res) => {
  try {
    const {
      schoolId,
      userId,
      userType, // 'student' or 'teacher'
      filter = 'harian', // 'harian', 'bulanan', 'tahunan'
      page = 1,
      limit = 20,
      targetUserId,
    } = req.query;

    const actualUserId = targetUserId || userId;
    const actualUserType = userType || 'student';
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    if (!actualUserId) {
      return res.status(400).json({ success: false, message: 'userId or targetUserId required' });
    }

    const where = {};
    if (actualUserType === 'student' || actualUserType === 'student') {
      where.studentId = parseInt(actualUserId);
      where.userRole = 'student';
    } else {
      where.guruId = parseInt(actualUserId);
      where.userRole = 'teacher';
    }

    // Date filtering based on filter type
    let dateWhere = '';
    const today = new Date();

    if (filter === 'harian') {
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      dateWhere = `AND a.createdAt >= '${startOfDay.toISOString().slice(0, 19).replace('T', ' ')}' AND a.createdAt < '${endOfDay.toISOString().slice(0, 19).replace('T', ' ')}'`;
    } else if (filter === 'bulanan') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      dateWhere = `AND a.createdAt >= '${startOfMonth.toISOString().slice(0, 19).replace('T', ' ')}' AND a.createdAt <= '${endOfMonth.toISOString().slice(0, 19).replace('T', ' ')}'`;
    } else if (filter === 'tahunan') {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      dateWhere = `AND a.createdAt >= '${startOfYear.toISOString().slice(0, 19).replace('T', ' ')}' AND a.createdAt <= '${endOfYear.toISOString().slice(0, 19).replace('T', ' ')}'`;
    }

    const [rows] = await sequelize.query(`
      SELECT a.id, a.schoolId, a.studentId, a.guruId, a.userRole, a.status,
             a.createdAt, a.updatedAt,
             s.name as studentName, s.nis as studentNis, s.class as studentClass,
             g.nama as guruName, g.nip as guruNip
      FROM kehadiran a
      LEFT JOIN siswa s ON a.studentId = s.id
      LEFT JOIN guruTendik g ON a.guruId = g.id
      WHERE a.${actualUserType === 'teacher' ? 'guruId' : 'studentId'} = ${parseInt(actualUserId)}
      ${dateWhere}
      ORDER BY a.createdAt DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM kehadiran a
      WHERE a.${actualUserType === 'teacher' ? 'guruId' : 'studentId'} = ${parseInt(actualUserId)}
      ${dateWhere}
    `);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: total,
        totalPages,
      },
    });
  } catch (err) {
    console.error('presence/history error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/presence/stats - get attendance stats
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const { schoolId, userId, userType, filter = 'harian' } = req.query;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    const actualUserType = userType || 'student';
    const today = new Date();
    let dateWhere = '';

    if (filter === 'harian') {
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      dateWhere = `AND a.createdAt >= '${startOfDay.toISOString().slice(0, 19).replace('T', ' ')}'`;
    } else if (filter === 'bulanan') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      dateWhere = `AND a.createdAt >= '${startOfMonth.toISOString().slice(0, 19).replace('T', ' ')}'`;
    } else if (filter === 'tahunan') {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      dateWhere = `AND a.createdAt >= '${startOfYear.toISOString().slice(0, 19).replace('T', ' ')}'`;
    }

    const [rows] = await sequelize.query(`
      SELECT a.status, COUNT(*) as count
      FROM kehadiran a
      WHERE a.schoolId = ${parseInt(schoolId)} AND a.userRole = '${actualUserType}'
      ${dateWhere}
      GROUP BY a.status
    `);

    const stats = {
      total: 0,
      hadir: 0,
      izin: 0,
      sakit: 0,
      alpha: 0,
    };

    rows.forEach(row => {
      const s = row.status?.toLowerCase();
      stats.total += parseInt(row.count) || 0;
      if (s === 'hadir' || s === ' hadir') stats.hadir = parseInt(row.count) || 0;
      else if (s === 'izin') stats.izin = parseInt(row.count) || 0;
      else if (s === 'sakit') stats.sakit = parseInt(row.count) || 0;
      else if (s === 'alpha') stats.alpha = parseInt(row.count) || 0;
    });

    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('presence/stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
