// controllers/raporController.js
const sequelize = require('../config/database');

// Create rapor tables if not exist (safe - called on each request)
const ensureTables = async () => {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS rapor_header (
        id INT AUTO_INCREMENT PRIMARY KEY,
        siswaId INT NOT NULL,
        semester ENUM('1','2') NOT NULL,
        tahunAjaran VARCHAR(20) NOT NULL,
        kelas VARCHAR(50),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_rapor (siswaId, semester, tahunAjaran)
      )
    `);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS rapor_detail (
        id INT AUTO_INCREMENT PRIMARY KEY,
        raporHeaderId INT NOT NULL,
        mataPelajaranId INT,
        mapelName VARCHAR(255),
        nilaiAkhir DECIMAL(5,2),
        nilaiHuruf VARCHAR(2),
        deskripsi TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (raporHeaderId) REFERENCES rapor_header(id) ON DELETE CASCADE
      )
    `);
    return true;
  } catch (err) {
    // Ignore "already exists" errors
    if (err.message && err.message.includes('already exists')) return true;
    console.error('ensureTables error:', err.message);
    return false;
  }
};

// GET /api/rapor/:siswaId
exports.getRaporBySiswa = async (req, res) => {
  try {
    await ensureTables();
    const { siswaId } = req.params;
    const { semester, tahunAjaran } = req.query;

    let where = `WHERE rh.siswaId = ${parseInt(siswaId)}`;
    if (semester) where += ` AND rh.semester = '${semester.replace(/'/g, "''")}'`;
    if (tahunAjaran) where += ` AND rh.tahunAjaran = '${tahunAjaran.replace(/'/g, "''")}'`;

    const [headers] = await sequelize.query(`
      SELECT rh.id, rh.siswaId, rh.semester, rh.tahunAjaran, rh.kelas, rh.createdAt,
             s.name as siswaName, s.nis, s.class
      FROM rapor_header rh
      LEFT JOIN siswa s ON rh.siswaId = s.id
      ${where}
      ORDER BY rh.tahunAjaran DESC, rh.semester DESC
    `);

    if (!headers || !Array.isArray(headers)) {
      return res.json({ success: true, data: [] });
    }

    const headersWithDetails = await Promise.all(headers.map(async (header) => {
      const [details] = await sequelize.query(`
        SELECT id, raporHeaderId, mataPelajaranId, mapelName, nilaiAkhir, nilaiHuruf, deskripsi
        FROM rapor_detail
        WHERE raporHeaderId = ${header.id}
        ORDER BY mapelName ASC
      `);
      return {
        ...header,
        details: (details || []).map(d => ({
          id: d.id,
          raporHeaderId: d.raporHeaderId,
          mataPelajaranId: d.mataPelajaranId,
          mapelName: d.mapelName,
          nilaiAkhir: parseFloat(d.nilaiAkhir) || 0,
          nilaiHuruf: d.nilaiHuruf,
          deskripsi: d.deskripsi,
        })),
      };
    }));

    res.json({ success: true, data: headersWithDetails });
  } catch (err) {
    console.error('getRaporBySiswa error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/rapor
exports.createRapor = async (req, res) => {
  try {
    await ensureTables();
    const { siswaId, semester, tahunAjaran, kelas, details } = req.body;

    if (!siswaId || !semester || !tahunAjaran) {
      return res.status(400).json({ success: false, message: 'siswaId, semester, tahunAjaran required' });
    }

    const [existing] = await sequelize.query(`
      SELECT id FROM rapor_header WHERE siswaId = ${parseInt(siswaId)} AND semester = '${semester.replace(/'/g, "''")}' AND tahunAjaran = '${tahunAjaran.replace(/'/g, "''")}'
    `);

    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Rapor already exists for this semester' });
    }

    const [result] = await sequelize.query(`
      INSERT INTO rapor_header (siswaId, semester, tahunAjaran, kelas)
      VALUES (${parseInt(siswaId)}, '${semester.replace(/'/g, "''")}', '${tahunAjaran.replace(/'/g, "''")}', '${(kelas || '').replace(/'/g, "''")}')
    `);

    const headerId = result.insertId;

    let insertedDetails = [];
    if (details && Array.isArray(details) && details.length > 0) {
      const values = details.map(d =>
        `(${headerId}, ${d.mataPelajaranId || 'NULL'}, '${(d.mapelName || '').replace(/'/g, "''")}', ${d.nilaiAkhir || 0}, '${(d.nilaiHuruf || '').replace(/'/g, "''")}', '${(d.deskripsi || '').replace(/'/g, "''")}')`
      ).join(', ');

      await sequelize.query(`
        INSERT INTO rapor_detail (raporHeaderId, mataPelajaranId, mapelName, nilaiAkhir, nilaiHuruf, deskripsi)
        VALUES ${values}
      `);

      const [newDetails] = await sequelize.query(`SELECT * FROM rapor_detail WHERE raporHeaderId = ${headerId}`);
      insertedDetails = newDetails || [];
    }

    const [header] = await sequelize.query(`SELECT * FROM rapor_header WHERE id = ${headerId}`);

    res.json({
      success: true,
      message: 'Rapor created',
      data: { ...(header?.[0] || {}), details: insertedDetails },
    });
  } catch (err) {
    console.error('createRapor error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/rapor/nilai/:id
exports.updateNilai = async (req, res) => {
  try {
    const { id } = req.params;
    const { nilaiAkhir, nilaiHuruf, deskripsi, mapelName, mataPelajaranId } = req.body;

    const fields = [];
    if (nilaiAkhir !== undefined) fields.push(`nilaiAkhir = ${nilaiAkhir}`);
    if (nilaiHuruf !== undefined) fields.push(`nilaiHuruf = '${(nilaiHuruf || '').replace(/'/g, "''")}'`);
    if (deskripsi !== undefined) fields.push(`deskripsi = '${(deskripsi || '').replace(/'/g, "''")}'`);
    if (mapelName !== undefined) fields.push(`mapelName = '${(mapelName || '').replace(/'/g, "''")}'`);
    if (mataPelajaranId !== undefined) fields.push(`mataPelajaranId = ${mataPelajaranId || 'NULL'}`);

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    await sequelize.query(`UPDATE rapor_detail SET ${fields.join(', ')} WHERE id = ${parseInt(id)}`);
    const [detail] = await sequelize.query(`SELECT * FROM rapor_detail WHERE id = ${parseInt(id)}`);

    if (!detail || detail.length === 0) {
      return res.status(404).json({ success: false, message: 'Rapor detail not found' });
    }

    res.json({ success: true, message: 'Nilai updated', data: detail[0] });
  } catch (err) {
    console.error('updateNilai error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/rapor/:id
exports.deleteRapor = async (req, res) => {
  try {
    const { id } = req.params;
    await sequelize.query(`DELETE FROM rapor_header WHERE id = ${parseInt(id)}`);
    res.json({ success: true, message: 'Rapor deleted' });
  } catch (err) {
    console.error('deleteRapor error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
