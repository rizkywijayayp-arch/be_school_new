const express = require('express');
const router = express.Router();
const perpustakaanController = require('../controllers/perpustakaanController');
const { protect } = require('../middlewares/protect');
const optionalAuth = require('../middlewares/optionalLimiter');
const sequelize = require('../config/database');

// History / get-history-perpus alias
router.get('/history', optionalAuth, async (req, res) => {
  try {
    const { sekolahId, schoolId, siswaId, page = 1, limit = 50 } = req.query;
    const sId = parseInt(schoolId || sekolahId);

    if (!sId) {
      return res.status(400).json({ success: false, message: 'schoolId required' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let where = `WHERE p.perpustakaanId IN (SELECT id FROM perpustakaan WHERE schoolId = ${sId})`;
    if (siswaId) where += ` AND p.siswaId = ${parseInt(siswaId)}`;

    const [rows] = await sequelize.query(`
      SELECT p.id, p.sekolahId, p.siswaId, p.bukuId, p.tanggalPinjam, p.tanggalKembali,
             p.status, p.denda, p.createdAt,
             b.judul as bukuJudul, b.isbn, b.penulis,
             s.name as siswaName, s.nis
      FROM peminjaman p
      LEFT JOIN perpustakaan b ON p.bukuId = b.id
      LEFT JOIN siswa s ON p.siswaId = s.id
      ${where}
      ORDER BY p.createdAt DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM peminjaman p ${where}`);
    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      data: rows,
      pagination: { page: pageNum, limit: limitNum, totalItems: total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (err) {
    console.error('perpustakaan/history error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Manual attendance in library
router.post('/absen-manual', protect, async (req, res) => {
  try {
    const { sekolahId, siswaId, status, catatan, tanggal } = req.body;

    if (!sekolahId || !siswaId || !status) {
      return res.status(400).json({ success: false, message: 'sekolahId, siswaId, status required' });
    }

    // Create attendance record
    const [result] = await sequelize.query(`
      INSERT INTO kehadiran (schoolId, studentId, userRole, status, currentClass, createdAt, updatedAt)
      VALUES (${parseInt(sekolahId)}, ${parseInt(siswaId)}, 'student', '${status.replace(/'/g, "''")}',
              '', '${tanggal || new Date().toISOString().slice(0, 19).replace('T', ' ')}', NOW())
    `);

    res.json({ success: true, message: 'Absen manual berhasil', data: { id: result.insertId } });
  } catch (err) {
    console.error('perpustakaan/absen-manual error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/buku', optionalAuth, perpustakaanController.getAllBuku);
router.get('/buku/:id', optionalAuth, perpustakaanController.getBukuById);
router.get('/buku/kategori/:kategori', optionalAuth, perpustakaanController.getBukuByKategori);
router.post('/buku', protect, perpustakaanController.createBuku);
router.put('/buku/:id', protect, perpustakaanController.updateBuku);
router.delete('/buku/:id', protect, perpustakaanController.deleteBuku);

router.get('/peminjaman', optionalAuth, perpustakaanController.getAllPeminjaman);
router.get('/peminjaman/:id', optionalAuth, perpustakaanController.getPeminjamanById);
router.get('/peminjaman/siswa/:siswaId', optionalAuth, perpustakaanController.getPeminjamanBySiswa);
router.post('/peminjaman', protect, perpustakaanController.createPeminjaman);
router.put('/peminjaman/:id/kembali', protect, perpustakaanController.returnBuku);

module.exports = router;