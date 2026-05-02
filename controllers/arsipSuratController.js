/**
 * Arsip Surat Controller
 * REST API untuk manajemen arsip surat keluar, masuk, dan internal
 */
const db = require('../config/database');

const ArsipSurat = {
  // GET all with filters
  async findAll({ schoolId, kategori, status, search, page = 1, limit = 20 }) {
    const replacements = [schoolId];
    let where = 'WHERE a.schoolId = ? AND a.deletedAt IS NULL';

    if (kategori) {
      where += ' AND a.kategori = ?';
      replacements.push(kategori);
    }
    if (status) {
      where += ' AND a.status = ?';
      replacements.push(status);
    }
    if (search) {
      where += ' AND (a.nomor_surat LIKE ? OR a.hal LIKE ? OR a.pengirim LIKE ? OR a.tujuan LIKE ?)';
      const s = '%' + search + '%';
      replacements.push(s, s, s, s);
    }

    // Count
    const [countRows] = await db.query(
      'SELECT COUNT(*) as total FROM arsip_surat a ' + where,
      { replacements }
    );
    const total = countRows.total;

    // Data
    replacements.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    const [rows] = await db.query(
      `SELECT a.*, k.kode as klasifikasi_kode_full, k.nama as klasifikasi_nama
       FROM arsip_surat a
       LEFT JOIN klasifikasi_surat k ON a.klasifikasi_id = k.id
       ${where}
       ORDER BY a.tanggal_surat DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      { replacements }
    );

    return { data: rows, total, page, limit, pages: Math.ceil(total / limit) };
  },

  // GET one by ID
  async findById(id, schoolId) {
    const [rows] = await db.query(
      `SELECT a.*, k.kode as klasifikasi_kode_full, k.nama as klasifikasi_nama
       FROM arsip_surat a
       LEFT JOIN klasifikasi_surat k ON a.klasifikasi_id = k.id
       WHERE a.id = ? AND a.schoolId = ? AND a.deletedAt IS NULL`,
      { replacements: [id, schoolId] }
    );
    return rows[0] || null;
  },

  // POST create
  async create(data) {
    const {
      schoolId, kategori, nomor_surat, klasifikasi_id, tanggal_surat,
      hal, ringkasan, pengirim, tujuan, tempat, jumlah_lampiran,
      lampiran_file, penandatangan, nip_penandatangan, jabatan_penandatangan,
      kop_surat_url, ttd_image_url, status, permohonan_id, klasifikasi_kode
    } = data;

    const [result] = await db.query(
      `INSERT INTO arsip_surat (schoolId, kategori, nomor_surat, klasifikasi_id, tanggal_surat,
        hal, ringkasan, pengirim, tujuan, tempat, jumlah_lampiran, lampiran_file,
        penandatangan, nip_penandatangan, jabatan_penandatangan, kop_surat_url,
        ttd_image_url, status, permohonan_id, klasifikasi_kode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      { replacements: [
        schoolId, kategori || 'keluar', nomor_surat || null, klasifikasi_id || null,
        tanggal_surat || new Date(), hal, ringkasan || null, pengirim || null, tujuan || null,
        tempat || null, jumlah_lampiran || 0, lampiran_file || null,
        penandatangan || null, nip_penandatangan || null, jabatan_penandatangan || 'Kepala Sekolah',
        kop_surat_url || null, ttd_image_url || null, status || 'arsip', permohonan_id || null,
        klasifikasi_kode || null
      ]}
    );
    return result.insertId;
  },

  // PUT update
  async update(id, schoolId, data) {
    const fields = [];
    const replacements = [];
    const allowed = [
      'kategori','nomor_surat','klasifikasi_id','tanggal_surat','hal','ringkasan',
      'pengirim','tujuan','tempat','jumlah_lampiran','lampiran_file','penandatangan',
      'nip_penandatangan','jabatan_penandatangan','kop_surat_url','ttd_image_url','status','klasifikasi_kode'
    ];
    for (const f of allowed) {
      if (data[f] !== undefined) {
        fields.push(f + ' = ?');
        replacements.push(data[f]);
      }
    }
    if (fields.length === 0) return false;
    replacements.push(id, schoolId);
    const [result] = await db.query(
      'UPDATE arsip_surat SET ' + fields.join(', ') + ' WHERE id = ? AND schoolId = ? AND deletedAt IS NULL',
      { replacements }
    );
    return result.affectedRows > 0;
  },

  // DELETE soft delete
  async delete(id, schoolId) {
    const [result] = await db.query(
      'UPDATE arsip_surat SET deletedAt = NOW() WHERE id = ? AND schoolId = ?',
      { replacements: [id, schoolId] }
    );
    return result.affectedRows > 0;
  },

  // GET stats
  async stats(schoolId) {
    const [rows] = await db.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN kategori = 'keluar' THEN 1 ELSE 0 END) as total_keluar,
        SUM(CASE WHEN kategori = 'masuk' THEN 1 ELSE 0 END) as total_masuk,
        SUM(CASE WHEN kategori = 'internal' THEN 1 ELSE 0 END) as total_internal,
        SUM(CASE WHEN MONTH(tanggal_surat) = MONTH(NOW()) AND YEAR(tanggal_surat) = YEAR(NOW()) THEN 1 ELSE 0 END) as bulan_ini,
        SUM(CASE WHEN DATE(tanggal_surat) = CURDATE() THEN 1 ELSE 0 END) as hari_ini
       FROM arsip_surat WHERE schoolId = ? AND deletedAt IS NULL`,
      { replacements: [schoolId] }
    );
    const r = rows[0];
    return {
      total: r.total || 0,
      total_keluar: r.total_keluar || 0,
      total_masuk: r.total_masuk || 0,
      total_internal: r.total_internal || 0,
      bulan_ini: r.bulan_ini || 0,
      hari_ini: r.hari_ini || 0,
    };
  },

  // GET next nomor surat
  async getNextNomor(kategori, schoolId) {
    const tahun = new Date().getFullYear();
    const bulan = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][new Date().getMonth()];
    const prefix = kategori === 'masuk' ? 'SM' : kategori === 'internal' ? 'SI' : 'SK';

    const [rows] = await db.query(
      `SELECT COUNT(*) as cnt FROM arsip_surat
       WHERE schoolId = ? AND kategori = ? AND YEAR(tanggal_surat) = ? AND deletedAt IS NULL`,
      { replacements: [schoolId, kategori, tahun] }
    );
    const seq = String((rows[0].cnt || 0) + 1).padStart(3, '0');
    return prefix + '/' + bulan + '/' + tahun + '/' + seq;
  },

  // GET disposisi by surat_id
  async getDisposisi(suratId, schoolId) {
    const [rows] = await db.query(
      'SELECT * FROM disposisi_surat WHERE surat_id = ? AND schoolId = ? ORDER BY tanggal_disposisi DESC',
      { replacements: [suratId, schoolId] }
    );
    return rows;
  },

  // POST disposisi
  async createDisposisi(data) {
    const { schoolId, surat_id, dari_user, kepada_user, instruksi } = data;
    const [result] = await db.query(
      `INSERT INTO disposisi_surat (schoolId, surat_id, dari_user, kepada_user, instruksi)
       VALUES (?, ?, ?, ?, ?)`,
      { replacements: [schoolId, surat_id, dari_user, kepada_user, instruksi || null] }
    );
    return result.insertId;
  },

  // GET klasifikasi
  async getKlasifikasi(schoolId, kategori) {
    const replacements = [schoolId];
    let where = 'WHERE schoolId = ? AND isActive = 1';
    if (kategori) {
      where += ' AND kategori = ?';
      replacements.push(kategori);
    }
    const [rows] = await db.query(
      'SELECT * FROM klasifikasi_surat ' + where + ' ORDER BY kode',
      { replacements }
    );
    return rows;
  }
};

// ─── Controller Functions ──────────────────────────────────────────────────

const arsipSuratController = {
  async getArsipSurat(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const { kategori, status, search, page, limit } = req.query;
      const result = await ArsipSurat.findAll({
        schoolId: parseInt(schoolId),
        kategori,
        status,
        search,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error('[arsipSurat] getAll error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getStats(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const stats = await ArsipSurat.stats(parseInt(schoolId));
      res.json({ success: true, stats });
    } catch (err) {
      console.error('[arsipSurat] stats error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getNextNomor(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const { kategori } = req.query;
      if (!kategori) return res.status(400).json({ success: false, message: 'kategori required' });

      const nomor = await ArsipSurat.getNextNomor(kategori, parseInt(schoolId));
      res.json({ success: true, nomor });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getKlasifikasi(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const { kategori } = req.query;
      const data = await ArsipSurat.getKlasifikasi(parseInt(schoolId), kategori);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getDetail(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const { id } = req.params;
      const data = await ArsipSurat.findById(parseInt(id), parseInt(schoolId));
      if (!data) return res.status(404).json({ success: false, message: 'Surat tidak ditemukan' });

      const disposisi = await ArsipSurat.getDisposisi(parseInt(id), parseInt(schoolId));
      res.json({ success: true, data: { ...data, disposisi } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async create(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const { hal, kategori, tanggal_surat } = req.body;
      if (!hal) return res.status(400).json({ success: false, message: 'hal (perihal) wajib diisi' });
      if (!tanggal_surat) return res.status(400).json({ success: false, message: 'tanggal_surat wajib diisi' });

      const id = await ArsipSurat.create({ ...req.body, schoolId: parseInt(schoolId) });
      const data = await ArsipSurat.findById(id, parseInt(schoolId));
      res.status(201).json({ success: true, data });
    } catch (err) {
      console.error('[arsipSurat] create error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const { id } = req.params;
      const ok = await ArsipSurat.update(parseInt(id), parseInt(schoolId), req.body);
      if (!ok) return res.status(404).json({ success: false, message: 'Surat tidak ditemukan' });

      const data = await ArsipSurat.findById(parseInt(id), parseInt(schoolId));
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async remove(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const { id } = req.params;
      const ok = await ArsipSurat.delete(parseInt(id), parseInt(schoolId));
      res.json({ success: ok, message: ok ? 'Surat dihapus' : 'Surat tidak ditemukan' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async addDisposisi(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const { id } = req.params;
      const { dari_user, kepada_user, instruksi } = req.body;
      if (!dari_user || !kepada_user) {
        return res.status(400).json({ success: false, message: 'dari_user dan kepada_user wajib diisi' });
      }

      const disposisiId = await ArsipSurat.createDisposisi({
        schoolId: parseInt(schoolId),
        surat_id: parseInt(id),
        dari_user,
        kepada_user,
        instruksi,
      });

      res.status(201).json({ success: true, data: { id: disposisiId } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createFromPermohonan(req, res) {
    try {
      const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
      if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

      const { id } = req.params;
      const Permohonan = require('../models/permohonan');
      const permohonan = await Permohonan.findByPk(parseInt(id));

      if (!permohonan || parseInt(permohonan.schoolId) !== parseInt(schoolId)) {
        return res.status(404).json({ success: false, message: 'Permohonan tidak ditemukan' });
      }

      const hal = permohonan.jenisSuratLabel;
      const nomor_surat = await ArsipSurat.getNextNomor('keluar', parseInt(schoolId));

      const arsipId = await ArsipSurat.create({
        schoolId: parseInt(schoolId),
        kategori: 'keluar',
        nomor_surat,
        hal,
        tanggal_surat: new Date(),
        ringkasan: JSON.stringify(permohonan.dataPemohon),
        pengirim: 'Sekolah',
        penandatangan: permohonan.ttdKepalaSekolah || null,
        nip_penandatangan: permohonan.nipKepalaSekolah || null,
        kop_surat_url: permohonan.kopSuratUrl || null,
        ttd_image_url: null,
        status: 'arsip',
        permohonan_id: parseInt(id),
        klasifikasi_kode: '432.1',
      });

      const data = await ArsipSurat.findById(arsipId, parseInt(schoolId));
      res.status(201).json({ success: true, data });
    } catch (err) {
      console.error('[arsipSurat] fromPermohonan error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = arsipSuratController;