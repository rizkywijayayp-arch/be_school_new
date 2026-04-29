// routes/guruTendikRoutes.js
const express = require('express');
const multer = require('multer');
const guruTendikController = require('../controllers/guruTendikController');
const cache = require('../middlewares/cache');
const { loginLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
router.get('/', cache(120), guruTendikController.getAllGuruTendik);
router.get('/list', guruTendikController.getAllGuruTendik);
router.post('/login', loginLimiter, guruTendikController.checkGuruAuth);
router.post('/', upload.single('photo'), guruTendikController.createGuruTendik);
router.put('/:id', upload.single('photo'), guruTendikController.updateGuruTendik);
router.delete('/:id', guruTendikController.deleteGuruTendik);

// Aliases
router.get('/mapel', guruTendikController.getAllGuruTendik);
router.get('/get-all-guru', guruTendikController.getAllGuruTendik);

module.exports = router;