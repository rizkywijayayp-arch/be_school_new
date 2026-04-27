const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middlewares/protect');

// Mock grades data (placeholder)
const grades = [];

// GET /nilai - List all grades
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { schoolId, classId, academicYear } = req.query;
    res.json({
      success: true,
      data: grades.filter(g =>
        (!schoolId || g.schoolId == schoolId) &&
        (!classId || g.classId == classId)
      ),
      pagination: { page: 1, limit: 20, pages: 1, total: grades.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /nilai - Create grade
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { studentId, subjectId, score, semester, academicYear } = req.body;
    const newGrade = {
      id: grades.length + 1,
      studentId,
      subjectId,
      score,
      semester,
      academicYear,
      createdAt: new Date()
    };
    grades.push(newGrade);
    res.status(201).json({ success: true, data: newGrade });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /nilai/student/:id - Get grades by student
router.get('/student/:id', optionalAuth, async (req, res) => {
  try {
    const studentGrades = grades.filter(g => g.studentId == req.params.id);
    res.json({ success: true, data: studentGrades });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;