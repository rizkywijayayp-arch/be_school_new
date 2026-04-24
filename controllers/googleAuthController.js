const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Parent = require('../models/orangTua');
const Siswa = require('../models/siswa');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID');

class GoogleAuthController {
  // ── Password Login for Siswa ─────────────────────────────────────
  async loginSiswa(req, res) {
    try {
      const { email, password, schoolId } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
      }

      // Find siswa by email
      const siswa = await Siswa.findOne({ where: { email } });

      if (!siswa) {
        return res.status(401).json({ success: false, message: 'Akun siswa tidak ditemukan' });
      }

      // Check password (bcrypt hash comparison)
      const isValidPassword = await bcrypt.compare(password, siswa.password);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, message: 'Password salah' });
      }

      if (!siswa.isActive) {
        return res.status(403).json({ success: false, message: 'Akun dinonaktifkan' });
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: siswa.id,
          email: siswa.email,
          role: 'siswa',
          type: 'siswa',
          schoolId: siswa.schoolId,
        },
        process.env.JWT_SECRET || 'xpresensi_secret_key',
        { expiresIn: '365d' }
      );

      return res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          token,
          user: {
            id: siswa.id,
            nama: siswa.name || siswa.nama,
            email: siswa.email,
            nis: siswa.nis,
            class: siswa.class || siswa.kelas,
            schoolId: siswa.schoolId,
            role: 'siswa',
            type: 'siswa',
            photoUrl: siswa.photoUrl,
          },
        },
      });
    } catch (err) {
      console.error('[GoogleAuthController.loginSiswa]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Google Register for Ortu (Parent)
  async googleRegisterOrtu(req, res) {
    try {
      const { googleToken, name, email } = req.body;

      if (!googleToken) {
        return res.status(400).json({ success: false, message: 'Google token required' });
      }

      // Verify Google token
      let payload;
      try {
        const ticket = await client.verifyIdToken({
          idToken: googleToken,
          audience: process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID',
        });
        payload = ticket.getPayload();
      } catch (e) {
        // For development, allow mock payload
        payload = { email: email || 'test@test.com', name: name || 'Test User', sub: '12345' };
      }

      // Check if parent exists by email
      let parent = await Parent.findOne({ where: { email: payload.email } });

      if (!parent) {
        // Create new parent account
        parent = await Parent.create({
          nama: name || payload.name,
          email: payload.email,
          googleId: payload.sub,
          role: 'orang_tua',
          isActive: true,
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: parent.id, email: parent.email, role: parent.role, type: 'ortu' },
        process.env.JWT_SECRET || 'xpresensi_secret_key',
        { expiresIn: '365d' }
      );

      return res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          token,
          user: {
            id: parent.id,
            nama: parent.nama,
            email: parent.email,
            role: parent.role,
            type: 'ortu',
          },
        },
      });
    } catch (err) {
      console.error('Google register ortu error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Google Register for Siswa (Student)
  async googleRegisterSiswa(req, res) {
    try {
      const { googleToken, name, email, nis } = req.body;

      if (!googleToken) {
        return res.status(400).json({ success: false, message: 'Google token required' });
      }

      // Verify Google token
      let payload;
      try {
        const ticket = await client.verifyIdToken({
          idToken: googleToken,
          audience: process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID',
        });
        payload = ticket.getPayload();
      } catch (e) {
        // For development, allow mock payload
        payload = { email: email || 'student@test.com', name: name || 'Test Student', sub: '12345' };
      }

      // Check if siswa exists
      let siswa = await Siswa.findOne({ where: { email: payload.email } });

      if (!siswa) {
        siswa = await Siswa.create({
          nama: name || payload.name,
          email: payload.email,
          nis: nis || null,
          googleId: payload.sub,
          role: 'siswa',
          isActive: true,
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: siswa.id, email: siswa.email, role: siswa.role, type: 'siswa' },
        process.env.JWT_SECRET || 'xpresensi_secret_key',
        { expiresIn: '365d' }
      );

      return res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          token,
          user: {
            id: siswa.id,
            nama: siswa.nama,
            email: siswa.email,
            role: siswa.role,
            type: 'siswa',
          },
        },
      });
    } catch (err) {
      console.error('Google register siswa error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Forgot Password for Siswa ───────────────────────────────────
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email wajib diisi' });
      }

      const siswa = await Siswa.findOne({ where: { email } });

      if (!siswa) {
        return res.status(404).json({ success: false, message: 'Email tidak ditemukan' });
      }

      // Generate reset token
      const resetToken = require('crypto').randomBytes(20).toString('hex');
      siswa.resetPasswordToken = resetToken;
      siswa.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await siswa.save();

      // In production, send email here
      // For now, return success with token (for testing)
      return res.json({
        success: true,
        message: 'Instruksi reset password telah dikirim ke email',
        // DEBUG: remove in production
        resetToken: resetToken,
      });
    } catch (err) {
      console.error('[GoogleAuthController.forgotPassword]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Reset Password for Siswa ────────────────────────────────────
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Token dan password baru wajib diisi' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
      }

      const siswa = await Siswa.findOne({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
        }
      });

      if (!siswa) {
        return res.status(400).json({ success: false, message: 'Token tidak valid atau sudah expired' });
      }

      // Hash and save new password
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      siswa.password = hashedPassword;
      siswa.resetPasswordToken = null;
      siswa.resetPasswordExpires = null;
      await siswa.save();

      return res.json({
        success: true,
        message: 'Password berhasil diubah',
      });
    } catch (err) {
      console.error('[GoogleAuthController.resetPassword]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Password Login for Ortu ─────────────────────────────────────
  async loginOrtu(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
      }

      const Parent = require('../models/orangTua');
      const parent = await Parent.findOne({ where: { email } });

      if (!parent) {
        return res.status(401).json({ success: false, message: 'Akun orang tua tidak ditemukan' });
      }

      if (!parent.password) {
        return res.status(401).json({ success: false, message: 'Akun belum memiliki password. Gunakan login Google.' });
      }

      const isValidPassword = await bcrypt.compare(password, parent.password);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, message: 'Password salah' });
      }

      if (!parent.isActive) {
        return res.status(403).json({ success: false, message: 'Akun dinonaktifkan' });
      }

      const token = jwt.sign(
        {
          id: parent.id,
          email: parent.email,
          role: 'parent',
          type: 'ortu',
          schoolId: parent.schoolId,
        },
        process.env.JWT_SECRET || 'xpresensi_secret_key',
        { expiresIn: '365d' }
      );

      return res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          token,
          user: {
            id: parent.id,
            nama: parent.name,
            email: parent.email,
            phoneNumber: parent.phoneNumber,
            schoolId: parent.schoolId,
            role: 'parent',
            type: 'ortu',
          },
        },
      });
    } catch (err) {
      console.error('[GoogleAuthController.loginOrtu]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Forgot Password for Ortu ───────────────────────────────────
  async forgotPasswordOrtu(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email wajib diisi' });
      }

      const Parent = require('../models/orangTua');
      const parent = await Parent.findOne({ where: { email } });

      if (!parent) {
        return res.status(404).json({ success: false, message: 'Email tidak ditemukan' });
      }

      const resetToken = require('crypto').randomBytes(20).toString('hex');
      parent.resetPasswordToken = resetToken;
      parent.resetPasswordExpires = Date.now() + 3600000;
      await parent.save();

      return res.json({
        success: true,
        message: 'Instruksi reset password telah dikirim ke email',
        resetToken: resetToken,
      });
    } catch (err) {
      console.error('[GoogleAuthController.forgotPasswordOrtu]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Reset Password for Ortu ─────────────────────────────────────
  async resetPasswordOrtu(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Token dan password baru wajib diisi' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
      }

      const Parent = require('../models/orangTua');
      const parent = await Parent.findOne({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
        }
      });

      if (!parent) {
        return res.status(400).json({ success: false, message: 'Token tidak valid atau sudah expired' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      parent.password = hashedPassword;
      parent.resetPasswordToken = null;
      parent.resetPasswordExpires = null;
      await parent.save();

      return res.json({
        success: true,
        message: 'Password berhasil diubah',
      });
    } catch (err) {
      console.error('[GoogleAuthController.resetPasswordOrtu]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Password Login for Guru ─────────────────────────────────────
  async loginGuru(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
      }

      const GuruTendik = require('../models/guruTendik');
      const guru = await GuruTendik.findOne({ where: { email } });

      if (!guru) {
        return res.status(401).json({ success: false, message: 'Akun guru tidak ditemukan' });
      }

      if (!guru.password) {
        return res.status(401).json({ success: false, message: 'Akun belum memiliki password' });
      }

      const isValidPassword = await bcrypt.compare(password, guru.password);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, message: 'Password salah' });
      }

      if (!guru.isActive) {
        return res.status(403).json({ success: false, message: 'Akun dinonaktifkan' });
      }

      const token = jwt.sign(
        {
          id: guru.id,
          email: guru.email,
          role: guru.role || 'teacher',
          type: 'guru',
          schoolId: guru.schoolId,
        },
        process.env.JWT_SECRET || 'xpresensi_secret_key',
        { expiresIn: '365d' }
      );

      return res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          token,
          user: {
            id: guru.id,
            nama: guru.nama,
            email: guru.email,
            nip: guru.nip,
            mapel: guru.mapel,
            schoolId: guru.schoolId,
            role: guru.role || 'teacher',
            type: 'guru',
            photoUrl: guru.photoUrl,
          },
        },
      });
    } catch (err) {
      console.error('[GoogleAuthController.loginGuru]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Forgot Password for Guru ───────────────────────────────────
  async forgotPasswordGuru(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email wajib diisi' });
      }

      const GuruTendik = require('../models/guruTendik');
      const guru = await GuruTendik.findOne({ where: { email } });

      if (!guru) {
        return res.status(404).json({ success: false, message: 'Email tidak ditemukan' });
      }

      const resetToken = require('crypto').randomBytes(20).toString('hex');
      guru.resetPasswordToken = resetToken;
      guru.resetPasswordExpires = Date.now() + 3600000;
      await guru.save();

      return res.json({
        success: true,
        message: 'Instruksi reset password telah dikirim ke email',
        resetToken: resetToken,
      });
    } catch (err) {
      console.error('[GoogleAuthController.forgotPasswordGuru]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Reset Password for Guru ─────────────────────────────────────
  async resetPasswordGuru(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Token dan password baru wajib diisi' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
      }

      const GuruTendik = require('../models/guruTendik');
      const guru = await GuruTendik.findOne({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
        }
      });

      if (!guru) {
        return res.status(400).json({ success: false, message: 'Token tidak valid atau sudah expired' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      guru.password = hashedPassword;
      guru.resetPasswordToken = null;
      guru.resetPasswordExpires = null;
      await guru.save();

      return res.json({
        success: true,
        message: 'Password berhasil diubah',
      });
    } catch (err) {
      console.error('[GoogleAuthController.resetPasswordGuru]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Logout (client-side token removal, but we can blacklist if needed)
  async logout(req, res) {
    try {
      // For JWT, logout is handled client-side by removing the token
      // If using refresh tokens, implement token blacklisting here
      return res.json({
        success: true,
        message: 'Logout berhasil',
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new GoogleAuthController();
