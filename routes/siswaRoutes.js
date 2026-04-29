const express = require('express');
const router = express.Router();
const siswaStatsController = require('../controllers/siswaStatsController');
const optionalAuth = require('../middlewares/optionalLimiter');
const { protect } = require('../middlewares/protect');
const Siswa = require('../models/siswa');
const sequelize = require('../config/database');

// Base GET /api/siswa - get all siswa with pagination (used by admin dashboard)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      schoolId,
      search = '',
      filterClass,
      filterBatch,
      isDuplicateOnly,
      page = 1,
      limit = 40,
    } = req.query;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    const sId = parseInt(schoolId);

    let where = `WHERE s.schoolId = ${sId}`;
    if (search) where += ` AND (s.name LIKE '%${search.replace(/'/g, "''")}%' OR s.nis LIKE '%${search.replace(/'/g, "''")}%' OR s.nisn LIKE '%${search.replace(/'/g, "''")}%')`;
    if (filterClass) where += ` AND s.class = '${filterClass.replace(/'/g, "''")}'`;
    if (filterBatch) where += ` AND s.batch = '${filterBatch.replace(/'/g, "''")}'`;

    const [rows] = await sequelize.query(`
      SELECT s.id, s.name, s.nis, s.class, s.batch, s.rfidUid, s.nisn, s.gender, s.nik,
             s.birthPlace, s.birthDate, s.photoUrl, s.qrCodeData,
             s.isActive, s.createdAt, s.updatedAt
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
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: total,
        totalPages,
      },
    });
  } catch (err) {
    console.error('siswa list error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Student stats routes
router.get('/streak', optionalAuth, siswaStatsController.getStreak);
router.get('/tepat-waktu', optionalAuth, siswaStatsController.getTepatWaktu);
router.get('/teladan', optionalAuth, siswaStatsController.getTeladan);
router.get('/today-stats', optionalAuth, siswaStatsController.getTodayStats);
router.get('/rekap-saya', optionalAuth, siswaStatsController.getRekapSaya);
router.get('/get-attendances', optionalAuth, siswaStatsController.getAttendances);

// Attendance report & early warning (for admin dashboard)
router.get('/attendance-report', optionalAuth, siswaStatsController.getAttendanceReport);
router.get('/early-warning', optionalAuth, siswaStatsController.getEarlyWarning);
router.get('/early-warning/consecutive-absent', optionalAuth, siswaStatsController.getConsecutiveAbsent);
router.get('/early-warning/low-attendance', optionalAuth, siswaStatsController.getLowAttendance);
router.get('/early-warning/frequent-late', optionalAuth, siswaStatsController.getFrequentLate);
router.get('/recap-kelas', optionalAuth, siswaStatsController.getRecapKelas);
router.get('/global-stats', optionalAuth, siswaStatsController.getGlobalStats);

// Search siswa & share recap
router.get('/search', optionalAuth, siswaStatsController.searchSiswa);
router.get('/share-rekap-progress', optionalAuth, siswaStatsController.shareRekapProgress);
router.get('/share-rekap', optionalAuth, siswaStatsController.shareRekap);

module.exports = router;
