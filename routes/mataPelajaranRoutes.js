// routes/mataPelajaranRoutes.js
const express = require('express');
const router = express.Router();
const mataPelajaranController = require('../controllers/mataPelajaranController');
const { protect } = require('../middlewares/protect');
const optionalAuth = require('../middlewares/optionalLimiter');

router.get('/', optionalAuth, mataPelajaranController.getAll);
router.get('/:id', optionalAuth, mataPelajaranController.getById);
router.post('/', protect, mataPelajaranController.create);
router.put('/:id', protect, mataPelajaranController.update);
router.delete('/:id', protect, mataPelajaranController.delete);

// Guru-mapel assignment
router.post('/guru', protect, mataPelajaranController.assignGuru);

module.exports = router;
