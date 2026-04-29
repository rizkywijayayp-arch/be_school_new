// routes/attendancesRoutes.js
// GET /api/attendances/monthly - get monthly attendance for students
const express = require('express');
const router = express.Router();
const optionalAuth = require('../middlewares/optionalLimiter');
const sequelize = require('../config/database');

// GET /api/attendances/monthly
router.get('/monthly', optionalAuth, async (req, res) => {
  try {
    const { schoolId, className, month, year, page = 1, limit = 50 } = req.query;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    const sId = parseInt(schoolId);
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Default to current month/year
    const now = new Date();
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    let where = `WHERE a.schoolId = ${sId} AND a.userRole = 'student' AND a.createdAt >= '${startDate.toISOString().slice(0, 10)}' AND a.createdAt <= '${endDate.toISOString().slice(0, 10)}'`;
    if (className) where += ` AND a.currentClass = '${className.replace(/'/g, "''")}'`;

    const [rows] = await sequelize.query(`
      SELECT a.id, a.studentId, a.guruId, a.userRole, a.status,
             a.currentClass as className, a.createdAt as attendanceDate,
             s.name as studentName, s.nis
      FROM kehadiran a
      LEFT JOIN siswa s ON a.studentId = s.id
      ${where}
      ORDER BY a.createdAt DESC, s.name ASC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM kehadiran a ${where}`);
    const total = countResult[0]?.total || 0;

    // Group by student for summary
    const studentSummary = {};
    rows.forEach(r => {
      if (!studentSummary[r.studentId]) {
        studentSummary[r.studentId] = { studentId: r.studentId, studentName: r.studentName, nis: r.nis, className: r.className, hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 };
      }
      studentSummary[r.studentId].total++;
      const s = r.status?.toLowerCase();
      if (s === 'hadir') studentSummary[r.studentId].hadir++;
      else if (s === 'izin') studentSummary[r.studentId].izin++;
      else if (s === 'sakit') studentSummary[r.studentId].sakit++;
      else if (s === 'alpha') studentSummary[r.studentId].alpha++;
    });

    res.json({
      success: true,
      data: rows,
      summary: Object.values(studentSummary),
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: total,
        totalPages: Math.ceil(total / limitNum),
      }
    });
  } catch (err) {
    console.error('attendances/monthly error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendances/daily - get daily attendance summary
router.get('/daily', optionalAuth, async (req, res) => {
  try {
    const { schoolId, className, date } = req.query;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    const sId = parseInt(schoolId);
    const targetDate = date || new Date().toISOString().slice(0, 10);

    let where = `WHERE a.schoolId = ${sId} AND a.userRole = 'student' AND DATE(a.createdAt) = '${targetDate}'`;
    if (className) where += ` AND a.currentClass = '${className.replace(/'/g, "''")}'`;

    const [rows] = await sequelize.query(`
      SELECT a.status, a.currentClass as className, COUNT(*) as count
      FROM kehadiran a
      ${where}
      GROUP BY a.status, a.currentClass
    `);

    const [totalResult] = await sequelize.query(`SELECT COUNT(*) as total FROM kehadiran a ${where}`);

    res.json({
      success: true,
      data: rows,
      total: totalResult[0]?.total || 0,
      date: targetDate,
    });
  } catch (err) {
    console.error('attendances/daily error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
