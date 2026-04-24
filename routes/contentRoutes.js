const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');
const { protectAdmin } = require('../middlewares/authMiddleware');

// Public routes - accessible by all authenticated users
router.get('/', contentController.getAll);
router.get('/:type', contentController.getByType);

// Admin only routes
router.post('/upsert', protectAdmin, contentController.upsert);
router.patch('/toggle/:type', protectAdmin, contentController.toggleActive);
router.post('/seed', protectAdmin, contentController.seedDefaults);

module.exports = router;