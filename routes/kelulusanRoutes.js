/**
 * Kelulusan Routes
 * API routes for graduation management
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middlewares/protect');
const kelulusanController = require('../controllers/kelulusanController');
const multer = require('multer');
const path = require('path');

// Configure multer for Excel upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `kelulusan-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file Excel (.xlsx, .xls) yang diizinkan'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Public routes (no auth needed for NISN check on tenant website)
router.get('/check/:nisn', kelulusanController.getKelulusanByNisn);
router.get('/announcement', kelulusanController.getAnnouncementDate);
router.get('/students', optionalAuth, kelulusanController.getStudentsForGraduation);

// Protected routes
// CRUD operations
router.get('/', kelulusanController.getKelulusan);
router.get('/stats', kelulusanController.getStats);
router.get('/:id', kelulusanController.getKelulusanById);
router.post('/', kelulusanController.createKelulusan);
router.post('/add-students', kelulusanController.addStudentsToKelulusan);
router.put('/:id', kelulusanController.updateKelulusan);
router.patch('/:id', kelulusanController.updateKelulusan);
router.delete('/:id', kelulusanController.deleteKelulusan);
router.post('/bulk-update', kelulusanController.bulkUpdateStatus);

// Excel import
router.post('/import', upload.single('file'), kelulusanController.importExcel);

// Announcement settings
router.post('/announcement', kelulusanController.setAnnouncementDate);

// Auto-promote + alumni pipeline
router.post('/promote', kelulusanController.promoteStudents);
router.get('/promote-preview', kelulusanController.getPromotionPreview);
router.post('/promote-to-alumni', kelulusanController.promoteToAlumni);

module.exports = router;
