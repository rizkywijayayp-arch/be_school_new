/**
 * Tuition Controller
 * Handle CRUD operations for student tuition/fee management
 */

const Tuition = require('../models/tuition');
const Siswa = require('../models/siswa');
const { Op } = require('sequelize');

// Get all tuitions with filters and pagination
exports.getTuitions = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId;
    const {
      page = 1,
      limit = 50,
      studentId,
      academicYear,
      type,
      isPaid,
      search
    } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan'
      });
    }

    const where = { schoolId: parseInt(schoolId), isActive: true };

    if (studentId) where.studentId = parseInt(studentId);
    if (academicYear) where.academicYear = academicYear;
    if (type) where.type = type;
    if (isPaid !== undefined) where.isPaid = isPaid === 'true';

    if (search) {
      where[Op.or] = [
        { '$Siswa.nama$': { [Op.like]: `%${search}%` } },
        { '$Siswa.nis$': { [Op.like]: `%${search}%` }
        }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Tuition.findAndCountAll({
      where,
      include: [{
        model: Siswa,
        as: 'Siswa',
        attributes: ['id', 'nama', 'nis', 'nisn', 'kelas']
      }],
      limit: parseInt(limit),
      offset,
      order: [['dueDate', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getTuitions:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get single tuition by ID
exports.getTuitionById = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId;
    const { id } = req.params;

    const tuition = await Tuition.findOne({
      where: { id, schoolId: parseInt(schoolId), isActive: true },
      include: [{
        model: Siswa,
        as: 'Siswa',
        attributes: ['id', 'nama', 'nis', 'nisn', 'kelas']
      }]
    });

    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    res.json({ success: true, data: tuition });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Create new tuition
exports.createTuition = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId;
    const {
      studentId,
      type,
      amount,
      dueDate,
      academicYear,
      description
    } = req.body;

    if (!schoolId || !studentId || !amount || !dueDate || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'studentId, amount, dueDate, dan academicYear wajib diisi'
      });
    }

    // Check if student exists
    const student = await Siswa.findOne({
      where: { id: studentId, schoolId: parseInt(schoolId), isActive: true }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    }

    // Check for duplicate
    const existing = await Tuition.findOne({
      where: {
        schoolId: parseInt(schoolId),
        studentId,
        academicYear,
        type: type || 'tuition',
        isActive: true
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Tagihan untuk siswa ini sudah ada di tahun ajaran yang sama'
      });
    }

    const tuition = await Tuition.create({
      schoolId: parseInt(schoolId),
      studentId: parseInt(studentId),
      type: type || 'tuition',
      amount: parseFloat(amount),
      dueDate,
      academicYear,
      description
    });

    res.status(201).json({ success: true, data: tuition });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update tuition
exports.updateTuition = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId;
    const { id } = req.params;
    const {
      type,
      amount,
      dueDate,
      academicYear,
      description,
      isPaid,
      paidAmount,
      paidDate,
      paymentMethod,
      referenceNumber,
      notes
    } = req.body;

    const tuition = await Tuition.findOne({
      where: { id, schoolId: parseInt(schoolId), isActive: true }
    });

    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    // Update fields
    if (type !== undefined) tuition.type = type;
    if (amount !== undefined) tuition.amount = parseFloat(amount);
    if (dueDate !== undefined) tuition.dueDate = dueDate;
    if (academicYear !== undefined) tuition.academicYear = academicYear;
    if (description !== undefined) tuition.description = description;
    if (isPaid !== undefined) tuition.isPaid = isPaid;
    if (paidAmount !== undefined) tuition.paidAmount = parseFloat(paidAmount);
    if (paidDate !== undefined) tuition.paidDate = paidDate;
    if (paymentMethod !== undefined) tuition.paymentMethod = paymentMethod;
    if (referenceNumber !== undefined) tuition.referenceNumber = referenceNumber;
    if (notes !== undefined) tuition.notes = notes;

    await tuition.save();

    res.json({ success: true, data: tuition });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete tuition (soft delete)
exports.deleteTuition = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId;
    const { id } = req.params;

    const tuition = await Tuition.findOne({
      where: { id, schoolId: parseInt(schoolId), isActive: true }
    });

    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    tuition.isActive = false;
    await tuition.save();

    res.json({ success: true, message: 'Tagihan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Record payment for tuition
exports.recordPayment = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId;
    const {
      tuitionId,
      amount,
      paymentDate,
      paymentMethod,
      referenceNumber,
      notes
    } = req.body;

    if (!tuitionId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'tuitionId dan amount wajib diisi'
      });
    }

    const tuition = await Tuition.findOne({
      where: { id: tuitionId, schoolId: parseInt(schoolId), isActive: true }
    });

    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan' });
    }

    // Update payment info
    const paidAmount = parseFloat(amount);
    const currentPaid = tuition.paidAmount || 0;
    tuition.paidAmount = currentPaid + paidAmount;
    tuition.paymentMethod = paymentMethod || tuition.paymentMethod;
    tuition.referenceNumber = referenceNumber || tuition.referenceNumber;
    tuition.notes = notes || tuition.notes;

    if (tuition.paidAmount >= tuition.amount) {
      tuition.isPaid = true;
      tuition.paidDate = paymentDate || new Date();
    }

    await tuition.save();

    res.json({
      success: true,
      message: 'Pembayaran berhasil dicatat',
      data: tuition
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get tuition statistics
exports.getTuitionStats = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId;
    const { academicYear } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'SchoolId tidak ditemukan'
      });
    }

    const whereBase = { schoolId: parseInt(schoolId), isActive: true };
    if (academicYear) whereBase.academicYear = academicYear;

    // Total stats
    const totalTuitions = await Tuition.count({ where: whereBase });
    const paidTuitions = await Tuition.count({ where: { ...whereBase, isPaid: true } });
    const pendingTuitions = totalTuitions - paidTuitions;

    // Amount stats
    const tuitions = await Tuition.findAll({ where: whereBase });
    const totalAmount = tuitions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalPaid = tuitions.reduce((sum, t) => sum + (parseFloat(t.paidAmount) || 0), 0);
    const totalPending = totalAmount - totalPaid;

    // Overdue count
    const today = new Date().toISOString().split('T')[0];
    const overdueCount = await Tuition.count({
      where: {
        ...whereBase,
        isPaid: false,
        dueDate: { [Op.lt]: today }
      }
    });

    res.json({
      success: true,
      data: {
        totalTuitions,
        paidTuitions,
        pendingTuitions,
        overdueCount,
        totalAmount,
        totalPaid,
        totalPending
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Bulk create tuitions
exports.bulkCreateTuitions = async (req, res) => {
  try {
    const schoolId = req.schoolId || req.enforcedSchoolId;
    const { tuitions } = req.body;

    if (!Array.isArray(tuitions) || tuitions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Data tuitions harus array dan tidak kosong'
      });
    }

    const results = { success: 0, failed: [] };

    for (const item of tuitions) {
      try {
        const { studentId, type, amount, dueDate, academicYear, description } = item;

        if (!studentId || !amount || !dueDate || !academicYear) {
          results.failed.push({
            studentId,
            reason: 'Missing required fields'
          });
          continue;
        }

        await Tuition.create({
          schoolId: parseInt(schoolId),
          studentId: parseInt(studentId),
          type: type || 'tuition',
          amount: parseFloat(amount),
          dueDate,
          academicYear,
          description
        });

        results.success++;
      } catch (err) {
        results.failed.push({
          studentId: item.studentId,
          reason: err.message
        });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
