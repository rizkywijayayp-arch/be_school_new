const express = require('express');
const router = express.Router();
const parentController = require('../controllers/orangTuaController');
const { createAuthLimiter } = require('../middlewares/security');

// Rate limiter untuk login
const authRateLimiter = createAuthLimiter(5);

router.get('/', parentController.getAllParents);
router.post('/', parentController.createParent);
router.put('/:id', parentController.updateParent);
router.delete('/:id', parentController.deleteParent);
router.get('/:parentId/kehadiran-siswa', parentController.getChildrenAttendance);
router.post('/login', authRateLimiter, parentController.loginParentWithoutPassword);
router.get('/search-student', parentController.searchStudentForRegister);
router.put('/:id/update-profile', parentController.updateProfile);
router.get('/:id', parentController.getParentById);
router.post('/link-child', parentController.linkChild);
router.delete('/unlink-child', parentController.unlinkChild);

module.exports = router;