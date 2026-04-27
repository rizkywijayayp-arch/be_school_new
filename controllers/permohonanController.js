/**
 * Permohonan Controller
 * Handle CRUD operations untuk permohonan surat
 */

const Permohonan = require('../models/permohonan');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

// ============================================================
// 1. CREATE PERMOHONAN BARU (Public - tenant website)
// ============================================================
exports.createPermohonan = async (req, res) => {
  try {
    const { schoolId } = req;
    const {
      jenisSurat,
      jenisSuratLabel,
      dataPemohon
    } = req.body;

    // Validation
    if (!jenisSurat || !jenisSuratLabel || !dataPemohon) {
      return res.status(400).json({
        success: false,
        message: 'jenisSurat, jenisSuratLabel, dan dataPemohon wajib diisi'
      });
    }

    // Validasi field minimum
    const requiredFields = ['nama', 'email'];
    for (const field of requiredFields) {
      if (!dataPemohon[field]) {
        return res.status(400).json({
          success: false,
          message: `dataPemohon.${field} wajib diisi`
        });
      }
    }

    // Create permohonan
    const permohonan = await Permohonan.create({
      schoolId: schoolId,
      jenisSurat,
      jenisSuratLabel,
      dataPemohon,
      status: 'pending',
      tanggalPengajuan: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    console.log(`[PERMOHONAN] New ${jenisSurat} from school ${schoolId}, ID: ${permohonan.id}`);

    res.status(201).json({
      success: true,
      data: {
        id: permohonan.id,
        jenisSurat: permohonan.jenisSurat,
        status: permohonan.status,
        tanggalPengajuan: permohonan.tanggalPengajuan,
        message: 'Permohonan berhasil diajukan. Tim kami akan segera memproses.'
      },
      message: 'Permohonan berhasil diajukan!'
    });

  } catch (err) {
    console.error('[CREATE_PERMOHONAN] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ============================================================
// 2. GET PERMOHONAN (By School - for admin dashboard)
// ============================================================
exports.getPermohonan = async (req, res) => {
  try {
    const schoolId = req.tenant?.schoolId || req.query.schoolId;
    const {
      status,
      jenisSurat,
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'DESC'
    } = req.query;

    // Build where clause
    const where = { isActive: true };
    if (schoolId) where.schoolId = schoolId;
    if (status) where.status = status;
    if (jenisSurat) where.jenisSurat = jenisSurat;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const offset = (pageNum - 1) * limitNum;

    // Query
    const { count, rows } = await Permohonan.findAndCountAll({
      where,
      limit: limitNum,
      offset: offset,
      order: [[sort, order.toUpperCase()]]
    });

    // Stats per status
    const stats = await Permohonan.findAll({
      where: { isActive: true, ...(schoolId ? { schoolId } : {}) },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum)
      },
      stats: stats
    });

  } catch (err) {
    console.error('[GET_PERMOHONAN] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ============================================================
// 3. GET PERMOHONAN DETAIL
// ============================================================
exports.getPermohonanDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.tenant?.schoolId || req.query.schoolId;

    const permohonan = await Permohonan.findOne({
      where: {
        id,
        isActive: true,
        ...(schoolId ? { schoolId } : {})
      }
    });

    if (!permohonan) {
      return res.status(404).json({
        success: false,
        message: 'Permohonan tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: permohonan
    });

  } catch (err) {
    console.error('[GET_PERMOHONAN_DETAIL] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ============================================================
// 4. UPDATE STATUS PERMOHONAN (Admin)
// ============================================================
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      catatanAdmin,
      fileSuratUrl,
      nomorSurat,
      kopSuratUrl,
      ttdKepalaSekolah,
      nipKepalaSekolah,
      ttdTataUsaha,
      nipTataUsaha,
      prioritas
    } = req.body;

    const permohonan = await Permohonan.findByPk(id);

    if (!permohonan) {
      return res.status(404).json({
        success: false,
        message: 'Permohonan tidak ditemukan'
      });
    }

    // Validasi status
    const validStatuses = ['pending', 'diproses', 'diterima', 'ditolak', 'selesai'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status tidak valid'
      });
    }

    // Update fields
    if (status) {
      permohonan.status = status;
      permohonan.tanggalProses = new Date();

      if (status === 'selesai') {
        permohonan.tanggalSelesai = new Date();
      }
    }

    if (catatanAdmin !== undefined) permohonan.catatanAdmin = catatanAdmin;
    if (fileSuratUrl !== undefined) permohonan.fileSuratUrl = fileSuratUrl;
    if (nomorSurat !== undefined) permohonan.nomorSurat = nomorSurat;
    if (kopSuratUrl !== undefined) permohonan.kopSuratUrl = kopSuratUrl;
    if (ttdKepalaSekolah !== undefined) permohonan.ttdKepalaSekolah = ttdKepalaSekolah;
    if (nipKepalaSekolah !== undefined) permohonan.nipKepalaSekolah = nipKepalaSekolah;
    if (ttdTataUsaha !== undefined) permohonan.ttdTataUsaha = ttdTataUsaha;
    if (nipTataUsaha !== undefined) permohonan.nipTataUsaha = nipTataUsaha;
    if (prioritas !== undefined) permohonan.prioritas = prioritas;
    if (req.tenant?.id) permohonan.diprosesOleh = req.tenant.id;

    await permohonan.save();

    console.log(`[PERMOHONAN] Updated ID ${id} to status: ${status}`);

    res.json({
      success: true,
      data: permohonan,
      message: `Status berhasil diupdate ke "${status}"`
    });

  } catch (err) {
    console.error('[UPDATE_STATUS] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ============================================================
// 5. DELETE PERMOHONAN (Soft delete)
// ============================================================
exports.deletePermohonan = async (req, res) => {
  try {
    const { id } = req.params;

    const permohonan = await Permohonan.findByPk(id);

    if (!permohonan) {
      return res.status(404).json({
        success: false,
        message: 'Permohonan tidak ditemukan'
      });
    }

    permohonan.isActive = false;
    await permohonan.save();

    res.json({
      success: true,
      message: 'Permohonan berhasil dihapus'
    });

  } catch (err) {
    console.error('[DELETE_PERMOHONAN] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ============================================================
// 6. GET STATS (Dashboard summary)
// ============================================================
exports.getStats = async (req, res) => {
  try {
    const schoolId = req.tenant?.schoolId || req.query.schoolId;
    const where = { isActive: true };
    if (schoolId) where.schoolId = schoolId;

    // Total permohonan
    const total = await Permohonan.count({ where });

    // Per status
    const statusCounts = await Permohonan.findAll({
      where,
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true
    });

    // Per jenis surat (top 5)
    const topJenis = await Permohonan.findAll({
      where,
      attributes: ['jenisSurat', 'jenisSuratLabel', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['jenisSurat', 'jenisSuratLabel'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5,
      raw: true
    });

    // Recent (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCount = await Permohonan.count({
      where: {
        ...where,
        createdAt: {
          [Op.gte]: sevenDaysAgo
        }
      }
    });

    // Pending count (urgent attention)
    const pendingCount = await Permohonan.count({
      where: { ...where, status: 'pending' }
    });

    res.json({
      success: true,
      data: {
        total,
        pending: pendingCount,
        recent: recentCount,
        byStatus: statusCounts,
        topJenis
      }
    });

  } catch (err) {
    console.error('[GET_STATS] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ============================================================
// 7. TRACK PERMOHONAN (Public - by ID untuk cek status)
// ============================================================
exports.trackPermohonan = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    const where = { id, isActive: true };
    if (email) where['dataPemohon.email'] = email;

    const permohonan = await Permohonan.findOne({ where });

    if (!permohonan) {
      return res.status(404).json({
        success: false,
        message: 'Permohonan tidak ditemukan atau email tidak cocok'
      });
    }

    // Return minimal info untuk tracking
    res.json({
      success: true,
      data: {
        id: permohonan.id,
        jenisSurat: permohonan.jenisSuratLabel,
        status: permohonan.status,
        tanggalPengajuan: permohonan.tanggalPengajuan,
        tanggalProses: permohonan.tanggalProses,
        catatanAdmin: permohonan.catatanAdmin,
        nomorSurat: permohonan.nomorSurat
      }
    });

  } catch (err) {
    console.error('[TRACK_PERMOHONAN] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};