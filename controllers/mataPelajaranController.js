// controllers/mataPelajaranController.js
const sequelize = require('../config/database');

// GET /api/mata-pelajaran - get all mata pelajaran
exports.getAll = async (req, res) => {
  try {
    const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
    const { jenjang, search } = req.query;

    const replacements = [];
    let where = '';

    // Always filter by schoolId for isolation
    if (schoolId) {
      where = 'WHERE (mp.schoolId = ? OR mp.isGlobal = 1)';
      replacements.push(parseInt(schoolId));
    } else {
      where = 'WHERE mp.isGlobal = 1';
    }

    if (jenjang) {
      where += ' AND mp.jenjang = ?';
      replacements.push(jenjang);
    }
    if (search) {
      where += ' AND (mp.name LIKE ? OR mp.code LIKE ?)';
      const s = '%' + search + '%';
      replacements.push(s, s);
    }

    const [rows] = await sequelize.query(
      `SELECT mp.id, mp.schoolId, mp.jenjang, mp.code, mp.name, mp.isActive, mp.isGlobal, mp.createdAt, mp.updatedAt
       FROM mata_pelajaran mp
       ${where}
       ORDER BY mp.name ASC`,
      { replacements }
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('mata-pelajaran getAll error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/mata-pelajaran/:id
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
    const replacements = [parseInt(id)];
    let where = 'WHERE id = ?';

    if (schoolId) {
      where += ' AND (schoolId = ? OR isGlobal = 1)';
      replacements.push(parseInt(schoolId));
    }

    const [rows] = await sequelize.query(
      `SELECT * FROM mata_pelajaran ${where}`,
      { replacements }
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Mata pelajaran tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('mata-pelajaran getById error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/mata-pelajaran
exports.create = async (req, res) => {
  try {
    const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { jenjang, code, name } = req.body;
    if (!name || !jenjang) return res.status(400).json({ success: false, message: 'name and jenjang required' });

    const [result] = await sequelize.query(
      `INSERT INTO mata_pelajaran (schoolId, jenjang, code, name, isActive, isGlobal, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, 0, NOW(), NOW())`,
      { replacements: [parseInt(schoolId), jenjang, code || null, name] }
    );

    const [row] = await sequelize.query(
      'SELECT * FROM mata_pelajaran WHERE id = ?',
      { replacements: [result.insertId] }
    );
    res.json({ success: true, message: 'Mata pelajaran dibuat', data: row[0] });
  } catch (err) {
    console.error('mata-pelajaran create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/mata-pelajaran/:id
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { name, code, jenjang, isActive } = req.body;
    const fields = [];
    const replacements = [];

    if (name !== undefined) { fields.push('name = ?'); replacements.push(name); }
    if (code !== undefined) { fields.push('code = ?'); replacements.push(code); }
    if (jenjang !== undefined) { fields.push('jenjang = ?'); replacements.push(jenjang); }
    if (isActive !== undefined) { fields.push('isActive = ?'); replacements.push(isActive ? 1 : 0); }

    if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

    replacements.push(parseInt(id), parseInt(schoolId));
    const [result] = await sequelize.query(
      `UPDATE mata_pelajaran SET ${fields.join(', ')} WHERE id = ? AND schoolId = ?`,
      { replacements }
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Mata pelajaran tidak ditemukan' });

    const [row] = await sequelize.query('SELECT * FROM mata_pelajaran WHERE id = ?', { replacements: [parseInt(id)] });
    res.json({ success: true, message: 'Updated', data: row[0] });
  } catch (err) {
    console.error('mata-pelajaran update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/mata-pelajaran/:id
exports.delete = async (req, res) => {
  try {
    const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const [result] = await sequelize.query(
      'DELETE FROM mata_pelajaran WHERE id = ? AND schoolId = ?',
      { replacements: [parseInt(req.params.id), parseInt(schoolId)] }
    );
    res.json({ success: true, message: 'Mata pelajaran dihapus' });
  } catch (err) {
    console.error('mata-pelajaran delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Assign guru to mapel
exports.assignGuru = async (req, res) => {
  try {
    const schoolId = req.enforcedSchoolId || req.user?.schoolId || req.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { guruId, mataPelajaranId } = req.body;
    if (!guruId || !mataPelajaranId) {
      return res.status(400).json({ success: false, message: 'guruId and mataPelajaranId required' });
    }

    const [mapelRows] = await sequelize.query(
      'SELECT name FROM mata_pelajaran WHERE id = ? AND (schoolId = ? OR isGlobal = 1)',
      { replacements: [parseInt(mataPelajaranId), parseInt(schoolId)] }
    );
    if (mapelRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Mata pelajaran tidak ditemukan' });
    }

    const [guruRows] = await sequelize.query(
      'SELECT mapel FROM guruTendik WHERE id = ? AND schoolId = ?',
      { replacements: [parseInt(guruId), parseInt(schoolId)] }
    );
    const existingMapel = guruRows[0]?.mapel || '';
    const newMapel = existingMapel ? `${existingMapel}, ${mapelRows[0].name}` : mapelRows[0].name;

    await sequelize.query(
      'UPDATE guruTendik SET mapel = ? WHERE id = ? AND schoolId = ?',
      { replacements: [newMapel, parseInt(guruId), parseInt(schoolId)] }
    );
    res.json({ success: true, message: 'Guru assigned to mata pelajaran' });
  } catch (err) {
    console.error('assignGuru error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
