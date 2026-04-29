/**
 * Kelulusan Controller
 * Handle CRUD operations for student graduation data
 */

const Kelulusan = require('../models/kelulusan');
const Permohonan = require('../models/permohonan');
const Alumni = require('../models/alumni');
const Siswa = require('../models/siswa');
const Sekolah = require('../models/profileSekolah');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Get all kelulusan with pagination and filters
exports.getKelulusan = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;
    const {
      page = 1,
      limit = 50,
      search = '',
      tahun = '',
      jenjang = '',
      status = ''
    } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan. Gunakan parameter ?schoolId= atau akses via domain sekolah.'
      });
    }

    const where = { schoolId: parseInt(schoolId), isActive: true };

    if (tahun) where.tahunLulus = tahun;
    if (jenjang) where.jenjang = jenjang;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { nama: { [Op.like]: `%${search}%` } },
        { nisn: { [Op.like]: `%${search}%` } },
        { nis: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Kelulusan.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error getKelulusan:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get single kelulusan by ID
exports.getKelulusanById = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;
    const { id } = req.params;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    const kelulusan = await Kelulusan.findOne({
      where: { id, schoolId: parseInt(schoolId), isActive: true }
    });

    if (!kelulusan) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    res.json({ success: true, data: kelulusan });
  } catch (error) {
    console.error('Error getKelulusanById:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get kelulusan by NISN (public check - no school filter needed for tenant website)
exports.getKelulusanByNisn = async (req, res) => {
  try {
    const { nisn } = req.params;
    const { schoolId } = req;

    if (!nisn) {
      return res.status(400).json({ success: false, message: 'NISN wajib diisi' });
    }

    const kelulusan = await Kelulusan.findOne({
      where: { nisn, isActive: true }
    });

    if (!kelulusan) {
      return res.status(404).json({
        success: false,
        message: 'Data tidak ditemukan. Pastikan NISN yang dimasukkan benar.'
      });
    }

    // If schoolId is provided (authenticated), include full data
    // If not (public), return limited data
    if (schoolId) {
      return res.json({ success: true, data: kelulusan });
    }

    // Public access - hide sensitive data
    const publicData = {
      id: kelulusan.id,
      nama: kelulusan.nama,
      nisn: kelulusan.nisn,
      jenjang: kelulusan.jenjang,
      kelas: kelulusan.kelas,
      tahunLulus: kelulusan.tahunLulus,
      status: kelulusan.status,
      noIjazah: kelulusan.noIjazah,
      nomorSurat: kelulusan.nomorSurat
    };

    res.json({ success: true, data: publicData });
  } catch (error) {
    console.error('Error getKelulusanByNisn:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Create single kelulusan
exports.createKelulusan = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    const data = { ...req.body, schoolId: parseInt(schoolId) };

    // Check duplicate NISN
    const existing = await Kelulusan.findOne({
      where: { nisn: data.nisn, schoolId: parseInt(schoolId), isActive: true }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'NISN sudah terdaftar dalam sistem'
      });
    }

    const kelulusan = await Kelulusan.create(data);

    res.status(201).json({ success: true, data: kelulusan, message: 'Data berhasil ditambahkan' });
  } catch (error) {
    console.error('Error createKelulusan:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update kelulusan
exports.updateKelulusan = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;
    const { id } = req.params;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    const kelulusan = await Kelulusan.findOne({
      where: { id, schoolId: parseInt(schoolId), isActive: true }
    });

    if (!kelulusan) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    const oldStatus = kelulusan.status;
    const newStatus = req.body.status;

    // Update kelulusan data
    await kelulusan.update(req.body);

    // Auto-create alumni record when status changed to 'lulus'
    if (newStatus === 'lulus' && oldStatus !== 'lulus') {
      const parsedSchoolId = parseInt(schoolId);
      // Check if alumni record already exists
      const existingAlumni = await Alumni.findOne({
        where: {
          nis: kelulusan.nis,
          schoolId: parsedSchoolId,
          graduationYear: kelulusan.tahunLulus,
          isActive: true
        }
      });

      if (!existingAlumni) {
        await Alumni.create({
          schoolId: parsedSchoolId,
          nis: kelulusan.nis,
          name: kelulusan.nama,
          graduationYear: kelulusan.tahunLulus,
          batch: String(kelulusan.tahunLulus),
          isVerified: true, // Auto-verify since from kelulusan data
          isActive: true
        });
        console.log(`[Auto-Alumni] Created alumni record for: ${kelulusan.nama}`);
      }
    }

    res.json({ success: true, data: kelulusan, message: 'Data berhasil diupdate' });
  } catch (error) {
    console.error('Error updateKelulusan:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Bulk update status (batch update)
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;
    const { ids, status, nomorSurat } = req.body;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array required' });
    }

    const parsedSchoolId = parseInt(schoolId);

    // Get data before update
    const kelulusanList = await Kelulusan.findAll({
      where: { id: ids, schoolId: parsedSchoolId, isActive: true }
    });

    // Update kelulusan
    await Kelulusan.update(
      { status, nomorSurat, ...req.body },
      { where: { id: ids, schoolId: parsedSchoolId, isActive: true } }
    );

    // Auto-create alumni records when status is 'lulus'
    if (status === 'lulus') {
      let alumniCreated = 0;
      for (const kel of kelulusanList) {
        if (kel.status !== 'lulus') {
          const existingAlumni = await Alumni.findOne({
            where: {
              nis: kel.nis,
              schoolId: parsedSchoolId,
              graduationYear: kel.tahunLulus,
              isActive: true
            }
          });

          if (!existingAlumni) {
            await Alumni.create({
              schoolId: parsedSchoolId,
              nis: kel.nis,
              name: kel.nama,
              graduationYear: kel.tahunLulus,
              batch: String(kel.tahunLulus),
              isVerified: true,
              isActive: true
            });
            alumniCreated++;
          }
        }
      }
      console.log(`[Auto-Alumni] Bulk created ${alumniCreated} alumni records`);
    }

    res.json({ success: true, message: `${ids.length} data berhasil diupdate` });
  } catch (error) {
    console.error('Error bulkUpdateStatus:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete kelulusan (soft delete)
exports.deleteKelulusan = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;
    const { id } = req.params;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    const kelulusan = await Kelulusan.findOne({
      where: { id, schoolId: parseInt(schoolId), isActive: true }
    });

    if (!kelulusan) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    await kelulusan.update({ isActive: false });

    res.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (error) {
    console.error('Error deleteKelulusan:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Import Excel
exports.importExcel = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }
    const parsedSchoolId = parseInt(schoolId);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File Excel wajib diupload' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'File Excel kosong' });
    }

    const results = {
      success: 0,
      failed: 0,
      alumniCreated: 0,
      errors: []
    };

    const tahunLulus = new Date().getFullYear();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row number (header + 1)

      try {
        // Required fields
        const nama = row['Nama'] || row['nama'];
        const nisn = String(row['NISN'] || row['nisn'] || '').trim();
        const nis = String(row['NIS'] || row['nis'] || '').trim();
        const jenjang = row['Jenjang'] || row['jenjang'];
        const kelas = row['Kelas'] || row['kelas'];
        const tahun = row['Tahun'] || row['tahun'] || tahunLulus;
        const status = row['Status'] || row['status'] || 'tunda';

        if (!nama || !nisn) {
          results.failed++;
          results.errors.push(`Baris ${rowNum}: Nama dan NISN wajib diisi`);
          continue;
        }

        // Check duplicate
        const existing = await Kelulusan.findOne({
          where: { nisn, schoolId: parsedSchoolId, isActive: true }
        });

        let kelulusan;
        if (existing) {
          // Update existing
          await existing.update({
            nama,
            nis,
            jenjang,
            kelas,
            tahunLulus: parseInt(tahun),
            status,
            ...row
          });
          kelulusan = existing;
          results.success++;
        } else {
          // Create new
          kelulusan = await Kelulusan.create({
            schoolId: parsedSchoolId,
            nama,
            nisn,
            nis,
            jenjang,
            kelas,
            tahunLulus: parseInt(tahun),
            status,
            ...row
          });
          results.success++;
        }

        // Auto-create alumni if status is 'lulus'
        if (status === 'lulus') {
          const existingAlumni = await Alumni.findOne({
            where: {
              nis: kelulusan.nis || nis,
              schoolId: parsedSchoolId,
              graduationYear: kelulusan.tahunLulus,
              isActive: true
            }
          });

          if (!existingAlumni) {
            await Alumni.create({
              schoolId: parsedSchoolId,
              nis: kelulusan.nis || nis,
              name: kelulusan.nama,
              graduationYear: kelulusan.tahunLulus,
              batch: String(kelulusan.tahunLulus),
              isVerified: true,
              isActive: true
            });
            results.alumniCreated++;
          }
        }
      } catch (rowError) {
        results.failed++;
        results.errors.push(`Baris ${rowNum}: ${rowError.message}`);
      }
    }

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Import selesai. ${results.success} berhasil, ${results.failed} gagal. ${results.alumniCreated} alumni dibuat.`,
      results
    });
  } catch (error) {
    console.error('Error importExcel:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get students for graduation (auto detect final class based on jenjang)
exports.getStudentsForGraduation = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;
    const { jenjang } = req.query;
    const sequelize = require('../config/database');
    const { Op } = require('sequelize');

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId wajib diisi' });
    }

    // Map jenjang to class pattern
    const classPatterns = {
      'SD': ['VI', '6', '6 ', ' VI', '-6'],
      'SMP': ['IX', '9', '9 ', ' IX', '-9'],
      'SMA': ['XII', '12', '12 ', ' XII', '-12'],
      'SMK': ['XII', '12', '12 ', ' XII', '-12'],
    };

    const patterns = jenjang && classPatterns[jenjang]
      ? classPatterns[jenjang]
      : ['XII', '12', 'IX', '9', 'VI', '6']; // all patterns if no jenjang

    // Build OR condition for class patterns
    const classConditions = patterns.map(p => ({ class: { [Op.like]: `%${p}%` } }));

    const students = await Siswa.findAll({
      where: {
        schoolId: parseInt(schoolId),
        [Op.or]: classConditions,
        isGraduated: false,
        isActive: true
      },
      attributes: ['id', 'nis', 'nisn', 'name', 'class', 'batch'],
      order: [['name', 'ASC']]
    });

    // Add jenjang detection based on class name
    const studentsWithJenjang = students.map(s => {
      const className = s.class || '';
      let detectedJenjang = 'SMA';
      if (className.match(/VI|6(?!\d)|6\s/)) detectedJenjang = 'SD';
      else if (className.match(/IX|9(?!\d)|9\s/)) detectedJenjang = 'SMP';
      else if (className.match(/XII|12|12\s/)) detectedJenjang = 'SMA';

      return { ...s.toJSON(), detectedJenjang };
    });

    res.json({
      success: true,
      data: studentsWithJenjang,
      total: studentsWithJenjang.length,
      jenjang: jenjang || 'all'
    });
  } catch (error) {
    console.error('Error getSiswasForGraduation:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Add students to kelulusan
exports.addStudentsToKelulusan = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;
    const { studentIds = [], jenjang } = req.body;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    const Alumni = require('../models/alumni');
    const parsedSchoolId = parseInt(schoolId);

    const tahunLulus = new Date().getFullYear();

    let students;
    if (studentIds.length > 0) {
      students = await Siswa.findAll({
        where: { id: { [Op.in]: studentIds }, schoolId: parsedSchoolId, isActive: true }
      });
    } else {
      // Get all students from final class
      const classPatterns = {
        'SD': ['VI', '6'],
        'SMP': ['IX', '9'],
        'SMA': ['XII', '12'],
        'SMK': ['XII', '12'],
      };
      const patterns = jenjang && classPatterns[jenjang] ? classPatterns[jenjang] : ['XII', '12', 'IX', '9', 'VI', '6'];
      const classConditions = patterns.map(p => ({ class: { [Op.like]: `%${p}%` } }));

      students = await Siswa.findAll({
        where: {
          schoolId: parsedSchoolId,
          [Op.or]: classConditions,
          isGraduated: false,
          isActive: true
        }
      });
    }

    if (students.length === 0) {
      return res.json({ success: true, message: 'Tidak ada siswa ditemukan', count: 0 });
    }

    let created = 0;
    let alumniCreated = 0;

    for (const student of students) {
      // Check if already exists
      const existing = await Kelulusan.findOne({
        where: { nisn: student.nisn, schoolId: parsedSchoolId, isActive: true }
      });

      if (!existing) {
        // Determine jenjang and jurusan from class name
        const className = student.class || '';
        let detectedJenjang = 'SMA';
        let jurusan = '';

        if (className.match(/VI|6(?!\d)|6\s/)) detectedJenjang = 'SD';
        else if (className.match(/IX|9(?!\d)|9\s/)) detectedJenjang = 'SMP';
        else {
          if (className.match(/IPA/i)) jurusan = 'IPA';
          else if (className.match(/IPS/i)) jurusan = 'IPS';
          else if (className.match(/BAHASA/i)) jurusan = 'BAHASA';
          else if (className.match(/TKJ/i)) jurusan = 'TKJ';
          else if (className.match(/RPL/i)) jurusan = 'RPL';
          else if (className.match(/MM/i)) jurusan = 'MM';
        }

        await Kelulusan.create({
          schoolId: parsedSchoolId,
          nisn: student.nisn || '',
          nis: student.nis,
          nama: student.name,
          jenjang: detectedJenjang,
          kelas: student.class,
          jurusan,
          tahunLulus,
          status: 'lulus',
          isActive: true
        });
        created++;

        // Auto create alumni
        const existingAlumni = await Alumni.findOne({
          where: { nis: student.nis, schoolId: parsedSchoolId, graduationYear: tahunLulus }
        });
        if (!existingAlumni) {
          await Alumni.create({
            schoolId: parsedSchoolId,
            nis: student.nis,
            name: student.name,
            jenjang: detectedJenjang,
            graduationYear: tahunLulus,
            batch: String(tahunLulus),
            isVerified: true,
            isActive: true
          });
          alumniCreated++;
        }
      }

      // Update student as graduated
      await student.update({ isGraduated: true, graduationNote: `Lulus tahun ${tahunLulus}` });
    }

    res.json({
      success: true,
      message: `${created} siswa berhasil ditambahkan ke kelulusan`,
      count: created,
      alumniCreated,
      tahunLulus
    });
  } catch (error) {
    console.error('Error addSiswasToKelulusan:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get statistics
exports.getStats = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    const total = await Kelulusan.count({ where: { schoolId: parseInt(schoolId), isActive: true } });
    const lulus = await Kelulusan.count({ where: { schoolId: parseInt(schoolId), status: 'lulus', isActive: true } });
    const tunda = await Kelulusan.count({ where: { schoolId: parseInt(schoolId), status: 'tunda', isActive: true } });
    const mengulang = await Kelulusan.count({ where: { schoolId: parseInt(schoolId), status: 'mengulang', isActive: true } });

    // Stats by year
    const byTahunRaw = await Kelulusan.findAll({
      where: { schoolId: parseInt(schoolId), isActive: true },
      attributes: [
        'tahunLulus',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'lulus' THEN 1 ELSE 0 END")), 'lulus']
      ],
      group: ['tahunLulus'],
      order: [['tahunLulus', 'DESC']],
      limit: 5,
      raw: true
    });

    // Format byTahun properly
    const byTahun = byTahunRaw.map(item => ({
      tahunLulus: parseInt(item.tahunLulus),
      total: parseInt(item.total) || 0,
      lulus: parseInt(item.lulus) || 0
    }));

    res.json({
      success: true,
      data: {
        total,
        lulus,
        tunda,
        mengulang,
        belumLulus: tunda + mengulang,
        byTahun
      }
    });
  } catch (error) {
    console.error('Error getStats:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Set announcement date
exports.setAnnouncementDate = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }
    const { tanggalPengumuman, enableCountdown } = req.body;

    // Store in sekolah settings (assuming Permohonan model has settings field)
    // Or create a separate settings table
    const sekolah = await Sekolah.findByPk(schoolId);

    if (!sekolah) {
      return res.status(404).json({ success: false, message: 'Sekolah tidak ditemukan' });
    }

    const settings = typeof sekolah.settings === 'object' ? sekolah.settings : {};
    settings.tanggalPengumuman = tanggalPengumuman;
    settings.enableCountdown = enableCountdown !== false;

    await sekolah.update({ settings });

    res.json({
      success: true,
      message: 'Pengaturan pengumuman berhasil disimpan',
      data: { tanggalPengumuman, enableCountdown }
    });
  } catch (error) {
    console.error('Error setAnnouncementDate:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get announcement date
exports.getAnnouncementDate = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    const sekolah = await Sekolah.findByPk(schoolId);

    if (!sekolah) {
      return res.status(404).json({ success: false, message: 'Sekolah tidak ditemukan' });
    }

    const settings = typeof sekolah.settings === 'object' ? sekolah.settings : {};
    const tanggalPengumuman = settings.tanggalPengumuman || '2026-06-05T08:00:00+07:00';
    const enableCountdown = settings.enableCountdown !== false;

    res.json({
      success: true,
      data: {
        tanggalPengumuman,
        enableCountdown,
        isOpen: new Date() >= new Date(tanggalPengumuman)
      }
    });
  } catch (error) {
    console.error('Error getAnnouncementDate:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Auto-promote students (end of academic year)
exports.promoteStudents = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;
    const { jenjang } = req.body;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    const Alumni = require('../models/alumni');
    const tahunLulus = new Date().getFullYear();

    // Class promotion mapping
    // Key = current class pattern, Value = new class pattern
    const promotionMap = {
      // SMA/SMK: X→XI, XI→XII, XII→graduate
      'SMA': {
        'X': 'XI', '10': '11', '10 ': '11 ',
        'XI': 'XII', '11': '12', '11 ': '12 ',
        'XII': null, '12': null, '12 ': null // graduate
      },
      'SMK': {
        'X': 'XI', '10': '11', '10 ': '11 ',
        'XI': 'XII', '11': '12', '11 ': '12 ',
        'XII': null, '12': null, '12 ': null // graduate
      },
      // SMP: VII→VIII, VIII→IX, IX→graduate
      'SMP': {
        'VII': 'VIII', '7': '8', '7 ': '8 ',
        'VIII': 'IX', '8': '9', '8 ': '9 ',
        'IX': null, '9': null, '9 ': null // graduate
      },
      // SD: I→II, II→III, III→IV, IV→V, V→VI, VI→graduate
      'SD': {
        'I': 'II', '1': '2', '1 ': '2 ',
        'II': 'III', '2': '3', '2 ': '3 ',
        'III': 'IV', '3': '4', '3 ': '4 ',
        'IV': 'V', '4': '5', '4 ': '5 ',
        'V': 'VI', '5': '6', '5 ': '6 ',
        'VI': null, '6': null, '6 ': null // graduate
      }
    };

    const jenjangMap = jenjang && jenjang !== 'all'
      ? { [jenjang]: promotionMap[jenjang] }
      : promotionMap;

    const results = {
      promoted: 0,
      graduated: 0,
      alumniCreated: 0,
      errors: []
    };

    for (const [jenjangKey, classMap] of Object.entries(jenjangMap)) {
      // Find students to graduate (final class)
      const graduatePatterns = Object.entries(classMap)
        .filter(([, newClass]) => newClass === null)
        .map(([pattern]) => pattern);

      const graduateConditions = graduatePatterns.map(p => ({
        class: { [require('sequelize').Op.like]: `%${p}%` }
      }));

      const graduatingStudents = await Siswa.findAll({
        where: {
          schoolId: parseInt(schoolId),
          [require('sequelize').Op.or]: graduateConditions,
          isGraduated: false,
          isActive: true
        }
      });

      // Add to kelulusan and mark as graduated
      for (const student of graduatingStudents) {
        const className = student.class || '';

        // Determine detected jenjang
        let detectedJenjang = jenjangKey;
        if (className.match(/VI|6(?!\d)|6\s/)) detectedJenjang = 'SD';
        else if (className.match(/IX|9(?!\d)|9\s/)) detectedJenjang = 'SMP';
        else if (className.match(/XII|12|12\s/)) detectedJenjang = 'SMA';

        // Determine jurusan if SMA/SMK
        let jurusan = '';
        if (className.match(/IPA/i)) jurusan = 'IPA';
        else if (className.match(/IPS/i)) jurusan = 'IPS';
        else if (className.match(/BAHASA/i)) jurusan = 'BAHASA';
        else if (className.match(/TKJ/i)) jurusan = 'TKJ';
        else if (className.match(/RPL/i)) jurusan = 'RPL';
        else if (className.match(/MM/i)) jurusan = 'MM';
        else if (className.match(/AKT/i)) jurusan = 'AKT';
        else if (className.match(/BRT/i)) jurusan = 'BRT';
        else if (className.match(/ULW/i)) jurusan = 'ULW';
        else if (className.match(/MPK/i)) jurusan = 'MPK';

        // Check if already in kelulusan
        const existingKelulusan = await Kelulusan.findOne({
          where: { nisn: student.nisn, schoolId: parseInt(schoolId), isActive: true }
        });

        if (!existingKelulusan) {
          await Kelulusan.create({
            schoolId: parseInt(schoolId),
            nisn: student.nisn || '',
            nis: student.nis,
            nama: student.name,
            jenjang: detectedJenjang,
            kelas: student.class,
            jurusan,
            tahunLulus,
            status: 'lulus',
            isActive: true
          });

          // Auto create alumni
          const existingAlumni = await Alumni.findOne({
            where: { nis: student.nis, schoolId: parseInt(schoolId), graduationYear: tahunLulus }
          });

          if (!existingAlumni) {
            await Alumni.create({
              schoolId: parseInt(schoolId),
              nis: student.nis,
              name: student.name,
              jenjang: detectedJenjang,
              graduationYear: tahunLulus,
              batch: String(tahunLulus),
              isVerified: true,
              isActive: true
            });
            results.alumniCreated++;
          }
        }

        // Mark student as graduated
        await student.update({
          isGraduated: true,
          graduationNote: `Lulus tahun ${tahunLulus}`
        });

        results.graduated++;
      }

      // Promote students to next class
      for (const [oldPattern, newClass] of Object.entries(classMap)) {
        if (newClass === null) continue; // Skip graduation

        const studentsToPromote = await Siswa.findAll({
          where: {
            schoolId: parseInt(schoolId),
            class: { [require('sequelize').Op.like]: `%${oldPattern}%` },
            isGraduated: false,
            isActive: true
          }
        });

        for (const student of studentsToPromote) {
          const oldClass = student.class || '';

          // Replace old pattern with new class
          let newClassName = oldClass;
          for (const [pattern, replacement] of Object.entries(classMap)) {
            if (replacement === null) continue;
            if (oldClass.includes(pattern)) {
              newClassName = oldClass.replace(new RegExp(pattern, 'g'), replacement);
              break;
            }
          }

          // Handle numeric patterns (10→11, 1→2, etc)
          if (oldClass.match(/\d+/)) {
            const numbers = oldClass.match(/\d+/g);
            if (numbers && numbers.length > 0) {
              const lastNum = parseInt(numbers[numbers.length - 1]);
              if (classMap[String(lastNum)]) {
                newClassName = oldClass.replace(/\d+/, String(lastNum + 1));
              }
            }
          }

          if (newClassName !== oldClass) {
            await student.update({ class: newClassName, batch: String(tahunLulus) });
            results.promoted++;
          }
        }
      }
    }

    console.log(`[Auto-Promote] School ${schoolId}: ${results.graduated} graduated, ${results.promoted} promoted, ${results.alumniCreated} alumni created`);

    res.json({
      success: true,
      message: `Promosi berhasil! ${results.graduated} siswa lulus, ${results.promoted} siswa naik kelas, ${results.alumniCreated} alumni dibuat.`,
      results
    });
  } catch (error) {
    console.error('Error promoteStudents:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get promotion preview (what will happen)
exports.getPromotionPreview = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId || parseInt(req.query.schoolId) || null;
    const { jenjang } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan.'
      });
    }

    const { Op } = require('sequelize');

    // Preview data
    const preview = {
      graduating: [], // Will graduate (final class)
      promoting: [], // Will move up
      tahunLulus: new Date().getFullYear()
    };

    // Get all students for this school
    const allStudents = await Siswa.findAll({
      where: {
        schoolId: parseInt(schoolId),
        isGraduated: false,
        isActive: true
      },
      attributes: ['id', 'name', 'class', 'nis']
    });

    // Analyze each student
    for (const student of allStudents) {
      const className = student.class || '';
      let jenjangKey = jenjang || 'SMA';
      let graduating = false;
      let promoting = null;

      // Detect SMA/SMK (has 10, 11, 12 in class name)
      if (className.match(/^10[\s\-\/]/i) || className.match(/^X[\s\-\/]/i)) {
        jenjangKey = 'SMA';
        promoting = { from: className, to: className.replace(/^10/i, '11').replace(/^X[\s\-\/]/i, 'XI-') };
      } else if (className.match(/^11[\s\-\/]/i) || className.match(/^XI[\s\-\/]/i)) {
        jenjangKey = 'SMA';
        graduating = false;
        promoting = { from: className, to: className.replace(/^11/i, '12').replace(/^XI[\s\-\/]/i, 'XII-') };
      } else if (className.match(/^12[\s\-\/]/i) || className.match(/^XII[\s\-\/]/i)) {
        jenjangKey = 'SMA';
        graduating = true;
      }
      // Detect SMP (has 7, 8, 9)
      else if (className.match(/^7[\s\-\/]/i) || className.match(/^VII[\s\-\/]/i)) {
        jenjangKey = 'SMP';
        promoting = { from: className, to: className.replace(/^7[\s\-\/]/i, '8-').replace(/^VII[\s\-\/]/i, 'VIII-') };
      } else if (className.match(/^8[\s\-\/]/i) || className.match(/^VIII[\s\-\/]/i)) {
        jenjangKey = 'SMP';
        graduating = false;
        promoting = { from: className, to: className.replace(/^8[\s\-\/]/i, '9-').replace(/^VIII[\s\-\/]/i, 'IX-') };
      } else if (className.match(/^9[\s\-\/]/i) || className.match(/^IX[\s\-\/]/i)) {
        jenjangKey = 'SMP';
        graduating = true;
      }
      // Detect SD (has 1-6)
      else if (className.match(/^1[\s\-\/]/i) || className.match(/^I[\s\-\/]/i)) {
        jenjangKey = 'SD';
        promoting = { from: className, to: className.replace(/^1[\s\-\/]/i, '2-').replace(/^I[\s\-\/]/i, 'II-') };
      } else if (className.match(/^2[\s\-\/]/i) || className.match(/^II[\s\-\/]/i)) {
        jenjangKey = 'SD';
        promoting = { from: className, to: className.replace(/^2[\s\-\/]/i, '3-').replace(/^II[\s\-\/]/i, 'III-') };
      } else if (className.match(/^3[\s\-\/]/i) || className.match(/^III[\s\-\/]/i)) {
        jenjangKey = 'SD';
        promoting = { from: className, to: className.replace(/^3[\s\-\/]/i, '4-').replace(/^III[\s\-\/]/i, 'IV-') };
      } else if (className.match(/^4[\s\-\/]/i) || className.match(/^IV[\s\-\/]/i)) {
        jenjangKey = 'SD';
        promoting = { from: className, to: className.replace(/^4[\s\-\/]/i, '5-').replace(/^IV[\s\-\/]/i, 'V-') };
      } else if (className.match(/^5[\s\-\/]/i) || className.match(/^V[\s\-\/]/i)) {
        jenjangKey = 'SD';
        promoting = { from: className, to: className.replace(/^5[\s\-\/]/i, '6-').replace(/^V[\s\-\/]/i, 'VI-') };
      } else if (className.match(/^6[\s\-\/]/i) || className.match(/^VI[\s\-\/]/i)) {
        jenjangKey = 'SD';
        graduating = true;
      }

      // Add to preview
      if (graduating) {
        const existing = preview.graduating.find(g => g.jenjang === jenjangKey);
        if (existing) {
          existing.count++;
          if (existing.samples.length < 5) existing.samples.push({ name: student.name, class: student.class, nis: student.nis });
        } else {
          preview.graduating.push({
            jenjang: jenjangKey,
            count: 1,
            samples: [{ name: student.name, class: student.class, nis: student.nis }]
          });
        }
      }

      if (promoting) {
        const promoKey = `${promoting.from}→${promoting.to}`;
        const existing = preview.promoting.find(p => p.key === promoKey);
        if (existing) {
          existing.count++;
        } else {
          preview.promoting.push({
            jenjang: jenjangKey,
            key: promoKey,
            from: promoting.from,
            to: promoting.to,
            count: 1,
            samples: [{ name: student.name, class: student.class, nis: student.nis }]
          });
        }
      }
    }

    // Filter by jenjang if specified
    if (jenjang && jenjang !== 'all') {
      preview.graduating = preview.graduating.filter(g => g.jenjang === jenjang);
      preview.promoting = preview.promoting.filter(p => p.jenjang === jenjang);
    }

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('Error getPromotionPreview:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
