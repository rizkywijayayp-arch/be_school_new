/**
 * Tuition Routes
 * API routes for student tuition/fee management
 */

const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/protect');
const tuitionController = require('../controllers/tuitionController');

// Public routes (limited info for students/parents)
router.get('/public/:schoolId', tuitionController.getTuitions);

// Protected routes
router.get('/', protect, tuitionController.getTuitions);
router.get('/stats', protect, tuitionController.getTuitionStats);
router.get('/:id', protect, tuitionController.getTuitionById);
router.post('/', protect, tuitionController.createTuition);
router.post('/bulk', protect, tuitionController.bulkCreateTuitions);
router.put('/:id', protect, tuitionController.updateTuition);
router.patch('/:id', protect, tuitionController.updateTuition);
router.delete('/:id', protect, tuitionController.deleteTuition);

// Payment recording
router.post('/payment', protect, tuitionController.recordPayment);

module.exports = router;
