// controllers/orangTuaController.js
const sequelize = require('../config/database');
const moment = require('moment');
const jwt = require('jsonwebtoken');

// Helper: get schoolId from request context
const getSchoolId = (req) =>
  parseInt(req.enforcedSchoolId || req.user?.schoolId || req.schoolId || '0', 10);

// Ensure orangTua table has required columns (safe migration)
const ensureOrangTuaTable = async () => {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS orangTua (
        id INT AUTO_INCREMENT PRIMARY KEY,
        schoolId INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        gender ENUM('Laki-laki','Perempuan') NOT NULL,
        relationStatus ENUM('Ayah','Ibu') NOT NULL,
        type ENUM('Kandung','Tiri') DEFAULT 'Kandung',
        phoneNumber VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255),
        password VARCHAR(255),
        resetPasswordToken VARCHAR(255),
        resetPasswordExpires DATETIME,
        isActive TINYINT(1) DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    return true;
  } catch (err) {
    if (err.message && err.message.includes('already exists')) return true;
    console.error('ensureOrangTuaTable:', err.message);
    return false;
  }
};

// --- 1. CREATE ---
exports.createParent = async (req, res) => {
  try {
    await ensureOrangTuaTable();
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { name, gender, relationStatus, type, phoneNumber, studentIds } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'phoneNumber required' });
    }

    const [existing] = await sequelize.query(
      'SELECT id FROM orangTua WHERE phoneNumber = ? LIMIT 1',
      { replacements: [phoneNumber] }
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, message: "Nomor ini sudah terdaftar" });
    }

    const [result] = await sequelize.query(
      `INSERT INTO orangTua (name, gender, relationStatus, type, phoneNumber, schoolId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      { replacements: [
        name || '',
        gender || 'Ayah',
        relationStatus || 'Ayah',
        type || 'Kandung',
        phoneNumber,
        schoolId
      ]}
    );

    const newId = result.insertId;

    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      const ids = studentIds.map(id => parseInt(id)).join(',');
      await sequelize.query(
        `UPDATE siswa SET parentId = ? WHERE id IN (${ids}) AND schoolId = ?`,
        { replacements: [newId, schoolId] }
      );
    }

    const [newParent] = await sequelize.query(
      'SELECT * FROM orangTua WHERE id = ?',
      { replacements: [newId] }
    );
    res.json({ success: true, data: newParent[0] });
  } catch (err) {
    console.error('createParent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- 2. GET ALL ---
exports.getAllParents = async (req, res) => {
  try {
    await ensureOrangTuaTable();
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { name, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(200, Math.max(1, parseInt(limit)));
    const lim = Math.min(200, Math.max(1, parseInt(limit)));

    const replacements = [schoolId];
    let where = 'WHERE o.schoolId = ? AND o.isActive = 1';
    if (name) { where += ' AND o.name LIKE ?'; replacements.push('%' + name + '%'); }

    const [rows] = await sequelize.query(
      `SELECT o.id, o.name, o.gender, o.relationStatus, o.type, o.phoneNumber, o.email, o.schoolId,
              o.isActive, o.createdAt,
              s.id as childId, s.name as childName, s.nis as childNis, s.class as childClass
       FROM orangTua o
       LEFT JOIN siswa s ON s.parentId = o.id AND s.isActive = 1
       ${where}
       ORDER BY o.name ASC
       LIMIT ? OFFSET ?`,
      { replacements: [...replacements, lim, offset] }
    );

    const grouped = {};
    (rows || []).forEach(r => {
      if (!grouped[r.id]) {
        grouped[r.id] = {
          id: r.id, name: r.name, gender: r.gender,
          relationStatus: r.relationStatus, type: r.type,
          phoneNumber: r.phoneNumber, email: r.email,
          schoolId: r.schoolId, isActive: r.isActive,
          children: []
        };
      }
      if (r.childId) {
        grouped[r.id].children.push({
          id: r.childId, name: r.childName, nis: r.childNis, class: r.childClass
        });
      }
    });

    res.json({ success: true, data: Object.values(grouped) });
  } catch (err) {
    console.error('getAllParents error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- 3. UPDATE ---
exports.updateParent = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { name, gender, relationStatus, type, phoneNumber, studentIds } = req.body;
    const fields = [];
    const replacements = [];

    if (name !== undefined) { fields.push('name = ?'); replacements.push(name); }
    if (gender !== undefined) { fields.push('gender = ?'); replacements.push(gender); }
    if (relationStatus !== undefined) { fields.push('relationStatus = ?'); replacements.push(relationStatus); }
    if (type !== undefined) { fields.push('type = ?'); replacements.push(type); }
    if (phoneNumber !== undefined) { fields.push('phoneNumber = ?'); replacements.push(phoneNumber); }

    if (fields.length > 0) {
      replacements.push(parseInt(id), schoolId);
      await sequelize.query(
        `UPDATE orangTua SET ${fields.join(', ')} WHERE id = ? AND schoolId = ?`,
        { replacements }
      );
    }

    if (studentIds && Array.isArray(studentIds)) {
      await sequelize.query(
        'UPDATE siswa SET parentId = NULL WHERE parentId = ? AND schoolId = ?',
        { replacements: [parseInt(id), schoolId] }
      );
      if (studentIds.length > 0) {
        const safeIds = studentIds.map(id => parseInt(id));
        const placeholders = safeIds.map(() => '?').join(',');
        await sequelize.query(
          `UPDATE siswa SET parentId = ? WHERE id IN (${placeholders}) AND schoolId = ?`,
          { replacements: [parseInt(id), ...safeIds, schoolId] }
        );
      }
    }

    res.json({ success: true, message: "Data berhasil diperbarui" });
  } catch (err) {
    console.error('updateParent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- 4. DELETE (Soft Delete) ---
exports.deleteParent = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    await sequelize.query(
      'UPDATE orangTua SET isActive = 0 WHERE id = ? AND schoolId = ?',
      { replacements: [parseInt(id), schoolId] }
    );
    await sequelize.query(
      'UPDATE siswa SET parentId = NULL WHERE parentId = ? AND schoolId = ?',
      { replacements: [parseInt(id), schoolId] }
    );
    res.json({ success: true, message: "Data orang tua berhasil dihapus" });
  } catch (err) {
    console.error('deleteParent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getChildrenAttendance = async (req, res) => {
  try {
    const { parentId } = req.params;
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { year } = req.query;

    // Verify parent belongs to this school
    const [parentCheck] = await sequelize.query(
      'SELECT id FROM orangTua WHERE id = ? AND schoolId = ? AND isActive = 1',
      { replacements: [parseInt(parentId), schoolId] }
    );
    if (!parentCheck || parentCheck.length === 0) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    }

    const [children] = await sequelize.query(
      'SELECT id, name, class, nis FROM siswa WHERE parentId = ? AND isActive = 1 AND schoolId = ?',
      { replacements: [parseInt(parentId), schoolId] }
    );

    if (!children || children.length === 0) {
      return res.status(404).json({ success: false, message: "Tidak ada data anak yang terhubung dengan akun ini." });
    }

    const studentIds = children.map(c => c.id);
    const placeholders = studentIds.map(() => '?').join(',');
    const startDate = year ? `${year}-01-01` : moment().subtract(1, 'years').format('YYYY-MM-DD');
    const endDate = year ? `${year}-12-31` : moment().format('YYYY-MM-DD');

    const [attendanceRecords] = await sequelize.query(
      `SELECT k.id, k.studentId, k.status, k.jamMasuk, k.jamPulang, k.tanggal,
              s.name as studentName, s.class as studentClass
       FROM kehadiran k
       LEFT JOIN siswa s ON k.studentId = s.id
       WHERE k.studentId IN (${placeholders})
         AND DATE(k.createdAt) BETWEEN ? AND ?
       ORDER BY k.createdAt DESC
       LIMIT 500`,
      { replacements: [...studentIds, startDate, endDate] }
    );

    const deadline = "07:00:00";
    const history = (attendanceRecords || []).map(record => {
      const scanTime = record.jamMasuk || '';
      return {
        studentName: record.studentName,
        class: record.studentClass,
        date: record.tanggal ? String(record.tanggal).slice(0, 10) : '',
        time: scanTime,
        status: record.status,
        isLate: record.status === 'hadir' && scanTime > deadline
      };
    });

    res.json({ success: true, count: history.length, data: history });
  } catch (err) {
    console.error('getChildrenAttendance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.loginParentWithoutPassword = async (req, res) => {
  try {
    await ensureOrangTuaTable();
    const { phoneNumber, childNis } = req.body;

    const [parents] = await sequelize.query(
      'SELECT * FROM orangTua WHERE phoneNumber = ? AND isActive = 1 LIMIT 1',
      { replacements: [phoneNumber] }
    );
    const parent = parents && parents[0];

    if (!parent) {
      return res.status(404).json({ success: false, message: "Nomor HP tidak terdaftar di sistem sekolah." });
    }

    const [students] = await sequelize.query(
      'SELECT * FROM siswa WHERE parentId = ? AND nis = ? AND isActive = 1 AND schoolId = ? LIMIT 1',
      { replacements: [parent.id, childNis, parent.schoolId] }
    );
    if (!students || !students[0]) {
      return res.status(401).json({ success: false, message: "Kombinasi Nomor HP dan NIS Anak tidak cocok." });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: "Server misconfiguration: JWT_SECRET not set" });
    }

    const token = jwt.sign(
      { id: parent.id, role: 'parent', schoolId: parent.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: "Login berhasil",
      token,
      parent: { id: parent.id, name: parent.name, schoolId: parent.schoolId }
    });
  } catch (err) {
    console.error('loginParentWithoutPassword error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.searchStudentForRegister = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { nis } = req.query;
    if (!nis) {
      return res.status(400).json({ success: false, message: 'nis required' });
    }

    const [students] = await sequelize.query(
      'SELECT id, name, class, nis FROM siswa WHERE nis = ? AND schoolId = ? AND (parentId IS NULL OR parentId = 0) LIMIT 1',
      { replacements: [nis, schoolId] }
    );

    if (!students || !students[0]) {
      return res.status(404).json({ success: false, message: "Siswa tidak ditemukan atau sudah terdaftar." });
    }

    res.json({ success: true, data: students[0] });
  } catch (err) {
    console.error('searchStudentForRegister error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { name, gender, relationStatus, type, phoneNumber, email } = req.body;
    const fields = [];
    const replacements = [];

    if (name !== undefined) { fields.push('name = ?'); replacements.push(name); }
    if (gender !== undefined) { fields.push('gender = ?'); replacements.push(gender); }
    if (relationStatus !== undefined) { fields.push('relationStatus = ?'); replacements.push(relationStatus); }
    if (type !== undefined) { fields.push('type = ?'); replacements.push(type); }
    if (phoneNumber !== undefined) { fields.push('phoneNumber = ?'); replacements.push(phoneNumber); }

    if (fields.length > 0) {
      replacements.push(parseInt(id), schoolId);
      await sequelize.query(
        `UPDATE orangTua SET ${fields.join(', ')} WHERE id = ? AND schoolId = ?`,
        { replacements }
      );
    }

    const [updated] = await sequelize.query(
      'SELECT * FROM orangTua WHERE id = ? AND schoolId = ?',
      { replacements: [parseInt(id), schoolId] }
    );
    res.json({ success: true, message: "Profil berhasil diperbarui", data: updated[0] });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getParentById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const [rows] = await sequelize.query(
      'SELECT * FROM orangTua WHERE id = ? AND schoolId = ? AND isActive = 1',
      { replacements: [parseInt(id), schoolId] }
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getParentById error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.linkChild = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { ortu_id, nisn, school_id, relation } = req.body;
    if (!ortu_id || !nisn) {
      return res.status(400).json({ success: false, message: 'ortu_id, nisn required' });
    }

    // Verify parent belongs to this school
    const [parentCheck] = await sequelize.query(
      'SELECT id FROM orangTua WHERE id = ? AND schoolId = ? AND isActive = 1',
      { replacements: [parseInt(ortu_id), schoolId] }
    );
    if (!parentCheck || parentCheck.length === 0) {
      return res.status(404).json({ success: false, message: "Orang tua tidak ditemukan di sekolah ini" });
    }

    const [students] = await sequelize.query(
      'SELECT * FROM siswa WHERE nisn = ? AND schoolId = ? LIMIT 1',
      { replacements: [nisn, schoolId] }
    );
    if (!students || !students[0]) {
      return res.status(404).json({ success: false, message: "Siswa dengan NISN tersebut tidak ditemukan" });
    }

    const student = students[0];
    if (student.parentId && student.parentId !== parseInt(ortu_id)) {
      return res.status(400).json({ success: false, message: "Siswa sudah terdaftar ke orang tua lain" });
    }

    await sequelize.query(
      'UPDATE siswa SET parentId = ? WHERE id = ? AND schoolId = ?',
      { replacements: [parseInt(ortu_id), student.id, schoolId] }
    );

    res.json({ success: true, message: "Anak berhasil ditautkan", data: student });
  } catch (err) {
    console.error('linkChild error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.unlinkChild = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(401).json({ success: false, message: 'schoolId required' });

    const { siswa_id, ortu_id } = req.query;
    if (!siswa_id || !ortu_id) {
      return res.status(400).json({ success: false, message: 'siswa_id and ortu_id required' });
    }
    await sequelize.query(
      'UPDATE siswa SET parentId = NULL WHERE id = ? AND parentId = ? AND schoolId = ?',
      { replacements: [parseInt(siswa_id), parseInt(ortu_id), schoolId] }
    );
    res.json({ success: true, message: "Anak berhasil dilepas" });
  } catch (err) {
    console.error('unlinkChild error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
