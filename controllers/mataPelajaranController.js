// controllers/mataPelajaranController.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// GET /api/mata-pelajaran - get all mata pelajaran
exports.getAll = async (req, res) => {
  try {
    const { schoolId, jenjang, search } = req.query;

    let where = '';
    if (schoolId) where = `WHERE mp.schoolId = ${parseInt(schoolId)} OR mp.isGlobal = 1`;
    else where = `WHERE mp.isGlobal = 1`;

    if (jenjang) where += ` AND mp.jenjang = '${jenjang.replace(/'/g, "''")}'`;
    if (search) where += ` AND (mp.name LIKE '%${search.replace(/'/g, "''")}%' OR mp.code LIKE '%${search.replace(/'/g, "''")}%')`;

    const [rows] = await sequelize.query(`
      SELECT mp.id, mp.schoolId, mp.jenjang, mp.code, mp.name, mp.isActive, mp.isGlobal, mp.createdAt, mp.updatedAt
      FROM mata_pelajaran mp
      ${where}
      ORDER BY mp.name ASC
    `);

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
    const [rows] = await sequelize.query(`SELECT * FROM mata_pelajaran WHERE id = ${parseInt(id)}`);
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
    const { schoolId, jenjang, code, name } = req.body;
    if (!name || !jenjang) return res.status(400).json({ success: false, message: 'name and jenjang required' });

    const [result] = await sequelize.query(`
      INSERT INTO mata_pelajaran (schoolId, jenjang, code, name, isActive, isGlobal, createdAt, updatedAt)
      VALUES (${schoolId ? parseInt(schoolId) : 'NULL'}, '${jenjang.replace(/'/g, "''")}',
              '${(code || '').replace(/'/g, "''")}', '${name.replace(/'/g, "''")}', 1, 0, NOW(), NOW())
    `);

    const [row] = await sequelize.query(`SELECT * FROM mata_pelajaran WHERE id = ${result.insertId}`);
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
    const { name, code, jenjang, isActive } = req.body;
    const fields = [];
    if (name !== undefined) fields.push(`name = '${name.replace(/'/g, "''")}'`);
    if (code !== undefined) fields.push(`code = '${code.replace(/'/g, "''")}'`);
    if (jenjang !== undefined) fields.push(`jenjang = '${jenjang.replace(/'/g, "''")}'`);
    if (isActive !== undefined) fields.push(`isActive = ${isActive ? 1 : 0}`);

    if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

    await sequelize.query(`UPDATE mata_pelajaran SET ${fields.join(', ')} WHERE id = ${parseInt(id)}`);
    const [row] = await sequelize.query(`SELECT * FROM mata_pelajaran WHERE id = ${parseInt(id)}`);
    res.json({ success: true, message: 'Updated', data: row[0] });
  } catch (err) {
    console.error('mata-pelajaran update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/mata-pelajaran/:id
exports.delete = async (req, res) => {
  try {
    await sequelize.query(`DELETE FROM mata_pelajaran WHERE id = ${parseInt(req.params.id)}`);
    res.json({ success: true, message: 'Mata pelajaran dihapus' });
  } catch (err) {
    console.error('mata-pelajaran delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Assign guru to mapel
exports.assignGuru = async (req, res) => {
  try {
    const { guruId, mataPelajaranId } = req.body;
    if (!guruId || !mataPelajaranId) {
      return res.status(400).json({ success: false, message: 'guruId and mataPelajaranId required' });
    }

    // Get mapel name
    const [mapelRows] = await sequelize.query(`SELECT name FROM mata_pelajaran WHERE id = ${parseInt(mataPelajaranId)}`);
    if (mapelRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Mata pelajaran tidak ditemukan' });
    }

    // Update guru's mapel field (append to existing)
    const [guruRows] = await sequelize.query(`SELECT mapel FROM guruTendik WHERE id = ${parseInt(guruId)}`);
    const existingMapel = guruRows[0]?.mapel || '';
    const newMapel = existingMapel ? `${existingMapel}, ${mapelRows[0].name}` : mapelRows[0].name;

    await sequelize.query(`UPDATE guruTendik SET mapel = '${newMapel.replace(/'/g, "''")}' WHERE id = ${parseInt(guruId)}`);
    res.json({ success: true, message: 'Guru assigned to mata pelajaran' });
  } catch (err) {
    console.error('assignGuru error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
