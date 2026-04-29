// routes/manualAttendanceRoutes.js
// POST /api/absen-masuk-manual - manual check-in attendance
// POST /api/absen-pulang-manual - manual check-out attendance
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/protect');
const sequelize = require('../config/database');

// POST /api/absen-masuk-manual
router.post('/absen-masuk-manual', protect, async (req, res) => {
  try {
    const { schoolId, siswaId, kelas, latitude, longitude, keterangan } = req.body;

    if (!schoolId || !siswaId) {
      return res.status(400).json({ success: false, message: 'schoolId and siswaId required' });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Check if already checked in today
    const [existing] = await sequelize.query(`
      SELECT id FROM kehadiran
      WHERE studentId = ${parseInt(siswaId)} AND userRole = 'student'
      AND DATE(createdAt) = '${today}' AND status = 'Hadir'
    `);

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Siswa sudah absen masuk hari ini' });
    }

    const [result] = await sequelize.query(`
      INSERT INTO kehadiran (schoolId, studentId, userRole, status, currentClass, latitude, longitude, createdAt, updatedAt)
      VALUES (${parseInt(schoolId)}, ${parseInt(siswaId)}, 'student', 'Hadir',
              '${(kelas || '').replace(/'/g, "''")}',
              ${latitude ? parseFloat(latitude) : 'NULL'},
              ${longitude ? parseFloat(longitude) : 'NULL'},
              NOW(), NOW())
    `);

    res.json({ success: true, message: 'Absen masuk berhasil', data: { id: result.insertId } });
  } catch (err) {
    console.error('absen-masuk-manual error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/absen-pulang-manual
router.post('/absen-pulang-manual', protect, async (req, res) => {
  try {
    const { schoolId, siswaId, kelas, latitude, longitude, keterangan } = req.body;

    if (!schoolId || !siswaId) {
      return res.status(400).json({ success: false, message: 'schoolId and siswaId required' });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Check if already checked in today, if so update to Pulang
    const [existing] = await sequelize.query(`
      SELECT id, status FROM kehadiran
      WHERE studentId = ${parseInt(siswaId)} AND userRole = 'student'
      AND DATE(createdAt) = '${today}'
      ORDER BY createdAt DESC LIMIT 1
    `);

    if (existing.length === 0) {
      // Create Pulang record directly
      const [result] = await sequelize.query(`
        INSERT INTO kehadiran (schoolId, studentId, userRole, status, currentClass, latitude, longitude, createdAt, updatedAt)
        VALUES (${parseInt(schoolId)}, ${parseInt(siswaId)}, 'student', 'Pulang',
                '${(kelas || '').replace(/'/g, "''")}',
                ${latitude ? parseFloat(latitude) : 'NULL'},
                ${longitude ? parseFloat(longitude) : 'NULL'},
                NOW(), NOW())
      `);
      return res.json({ success: true, message: 'Absen Pulang berhasil', data: { id: result.insertId } });
    }

    // Update existing record to Pulang
    await sequelize.query(`
      UPDATE kehadiran SET status = 'Pulang', updatedAt = NOW()
      WHERE id = ${existing[0].id}
    `);

    res.json({ success: true, message: 'Absen Pulang berhasil', data: { id: existing[0].id } });
  } catch (err) {
    console.error('absen-pulang-manual error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/absen-masuk-manual/history - check attendance history
router.get('/history', protect, async (req, res) => {
  try {
    const { schoolId, siswaId, date } = req.query;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    let where = `WHERE a.schoolId = ${parseInt(schoolId)} AND a.userRole = 'student'`;
    if (siswaId) where += ` AND a.studentId = ${parseInt(siswaId)}`;
    if (date) where += ` AND DATE(a.createdAt) = '${date}'`;

    const [rows] = await sequelize.query(`
      SELECT a.id, a.studentId, a.status, a.currentClass, a.createdAt,
             s.name as siswaName, s.nis, s.class
      FROM kehadiran a
      LEFT JOIN siswa s ON a.studentId = s.id
      ${where}
      ORDER BY a.createdAt DESC
      LIMIT 100
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('manual-attendance/history error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
