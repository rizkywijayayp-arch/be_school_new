const express = require('express');
const router = express.Router();
const GoogleAuthController = require('../controllers/googleAuthController');

// ── Password Login for Siswa ─────────────────────────────────────
router.post('/login/siswa', GoogleAuthController.loginSiswa);

// Forgot Password for Siswa
router.post('/forgot-password', GoogleAuthController.forgotPassword);

// Reset Password for Siswa
router.post('/reset-password', GoogleAuthController.resetPassword);

// Password Login for Ortu
router.post('/login/ortu', GoogleAuthController.loginOrtu);

// Forgot Password for Ortu
router.post('/forgot-password/ortu', GoogleAuthController.forgotPasswordOrtu);

// Reset Password for Ortu
router.post('/reset-password/ortu', GoogleAuthController.resetPasswordOrtu);

// Password Login for Guru
router.post('/login/guru', GoogleAuthController.loginGuru);

// Forgot Password for Guru
router.post('/forgot-password/guru', GoogleAuthController.forgotPasswordGuru);

// Reset Password for Guru
router.post('/reset-password/guru', GoogleAuthController.resetPasswordGuru);

// Google Register for Ortu (Parent)
router.post('/google-register/ortu', GoogleAuthController.googleRegisterOrtu);

// Google Register for Siswa (Student)
router.post('/google-register/siswa', GoogleAuthController.googleRegisterSiswa);

// Logout
router.post('/logout', GoogleAuthController.logout);

module.exports = router;
