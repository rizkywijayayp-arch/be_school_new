const express = require('express');
const router = express.Router();
const catatanController = require('../controllers/catatanController');
const { protect } = require('../middlewares/protect');
const optionalAuth = require('../middlewares/optionalLimiter');
const sequelize = require('../config/database');

// Catatan sikap routes (for admin dashboard /catatan-sikap prefix)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { schoolId, siswaId, kelas, jenis, page = 1, limit = 50 } = req.query;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    const sId = parseInt(schoolId);

    let where = `WHERE s.schoolId = ${sId}`;
    if (siswaId) where += ` AND cs.siswaId = ${parseInt(siswaId)}`;
    if (kelas) where += ` AND cs.kelas = '${kelas.replace(/'/g, "''")}'`;
    if (jenis) where += ` AND cs.jenis = '${jenis.replace(/'/g, "''")}'`;

    const [rows] = await sequelize.query(`
      SELECT cs.*, s.name as siswaName, s.nis, s.schoolId, g.nama as guruName
      FROM catatan_sikap cs
      LEFT JOIN siswa s ON cs.siswaId = s.id
      LEFT JOIN guruTendik g ON cs.guruId = g.id
      ${where}
      ORDER BY cs.createdAt DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as total FROM catatan_sikap cs
      LEFT JOIN siswa s ON cs.siswaId = s.id
      ${where}
    `);
    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      data: rows,
      pagination: { page: pageNum, limit: limitNum, totalItems: total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (err) {
    console.error('catatan-sikap list error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { sekolahId, siswaId, guruId, kelas, tanggal, jenis, kategori, deskripsi, point } = req.body;

    if (!sekolahId || !siswaId || !jenis) {
      return res.status(400).json({ success: false, message: 'sekolahId, siswaId, jenis required' });
    }

    const [result] = await sequelize.query(`
      INSERT INTO catatan_sikap (sekolahId, siswaId, guruId, kelas, tanggal, jenis, kategori, deskripsi, point, dibuatOleh, createdAt, updatedAt)
      VALUES (${parseInt(sekolahId)}, ${parseInt(siswaId)}, ${guruId ? parseInt(guruId) : 'NULL'},
              '${(kelas || '').replace(/'/g, "''")}', '${tanggal || new Date().toISOString().slice(0, 10)}',
              '${jenis.replace(/'/g, "''")}', '${(kategori || '').replace(/'/g, "''")}',
              '${(deskripsi || '').replace(/'/g, "''")}', ${point || 0},
              ${req.userId || 'NULL'}, NOW(), NOW())
    `);

    const [row] = await sequelize.query(`SELECT * FROM catatan_sikap WHERE id = ${result.insertId}`);
    res.json({ success: true, message: 'Catatan sikap dibuat', data: row[0] });
  } catch (err) {
    console.error('catatan-sikap create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    await sequelize.query(`DELETE FROM catatan_sikap WHERE id = ${parseInt(id)}`);
    res.json({ success: true, message: 'Catatan sikap dihapus' });
  } catch (err) {
    console.error('catatan-sikap delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Rekap sikap for a siswa
router.get('/rekap/:siswaId', optionalAuth, async (req, res) => {
  try {
    const { siswaId } = req.params;

    // Ensure table exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS catatan_sikap (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sekolahId INT NOT NULL,
        siswaId INT NOT NULL,
        guruId INT,
        kelas VARCHAR(50),
        tanggal DATE,
        jenis ENUM('positif','negatif','netral') DEFAULT 'netral',
        kategori VARCHAR(100),
        deskripsi TEXT,
        point INT DEFAULT 0,
        dibuatOleh INT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await sequelize.query(`
      SELECT cs.jenis, cs.kategori, cs.point, cs.tanggal, cs.deskripsi, cs.createdAt,
             g.nama as guruName
      FROM catatan_sikap cs
      LEFT JOIN guruTendik g ON cs.guruId = g.id
      WHERE cs.siswaId = ${parseInt(siswaId)}
      ORDER BY cs.tanggal DESC, cs.createdAt DESC
      LIMIT 200
    `);

    const safeRows = Array.isArray(rows) ? rows : [];

    // Summary by jenis
    let positif = 0, negatif = 0, netral = 0, totalPoint = 0;
    safeRows.forEach(r => {
      const s = r.jenis?.toLowerCase();
      if (s === 'positif') { positif++; totalPoint += parseInt(r.point) || 0; }
      else if (s === 'negatif') { negatif++; totalPoint -= parseInt(r.point) || 0; }
      else netral++;
    });

    res.json({
      success: true,
      data: safeRows,
      summary: { positif, negatif, netral, totalPoint, total: safeRows.length }
    });
  } catch (err) {
    console.error('catatan-sikap rekap error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Catatan siswa routes (original routes)
router.get('/siswa/:siswaId', optionalAuth, catatanController.getCatatanSiswa);
router.post('/siswa', protect, catatanController.createCatatanSiswa);
router.put('/siswa/:id', protect, catatanController.updateCatatanSiswa);
router.delete('/siswa/:id', protect, catatanController.deleteCatatanSiswa);
router.put('/siswa/:id/archive', protect, catatanController.toggleArchiveCatatan);
router.put('/siswa/:id/pin', protect, catatanController.togglePinCatatan);

router.get('/guru/:guruId', optionalAuth, catatanController.getCatatanGuru);
router.post('/guru', protect, catatanController.createCatatanGuru);
router.get('/bk/:siswaId', optionalAuth, catatanController.getBkAssessments);
router.post('/bk', protect, catatanController.createBkAssessment);

module.exports = router;