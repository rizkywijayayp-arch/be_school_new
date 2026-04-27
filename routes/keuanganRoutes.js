const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middlewares/protect');

// Mock tuition data (placeholder)
const tuitions = [];

// GET /keuangan - List all tuition
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { schoolId, studentId } = req.query;
    res.json({
      success: true,
      data: tuitions.filter(t =>
        (!schoolId || t.schoolId == schoolId) &&
        (!studentId || t.studentId == studentId)
      ),
      pagination: { page: 1, limit: 20, pages: 1, total: tuitions.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /keuangan - Create tuition record
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { studentId, amount, type, status, academicYear } = req.body;
    const newTuition = {
      id: tuitions.length + 1,
      studentId,
      amount,
      type,
      status: status || 'pending',
      academicYear,
      createdAt: new Date()
    };
    tuitions.push(newTuition);
    res.status(201).json({ success: true, data: newTuition });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /keuangan/summary - Get financial summary
router.get('/summary', optionalAuth, async (req, res) => {
  try {
    const { schoolId } = req.query;
    const schoolTuitions = tuitions.filter(t => !schoolId || t.schoolId == schoolId);
    const summary = {
      totalReceivable: schoolTuitions.reduce((sum, t) => sum + (t.status === 'pending' ? t.amount : 0), 0),
      totalPaid: schoolTuitions.reduce((sum, t) => sum + (t.status === 'paid' ? t.amount : 0), 0),
      totalOverdue: schoolTuitions.reduce((sum, t) => sum + (t.status === 'overdue' ? t.amount : 0), 0),
    };
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;