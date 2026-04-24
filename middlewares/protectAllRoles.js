const jwt = require('jsonwebtoken');
const Student = require('../models/siswa');
const GuruTendik = require('../models/guruTendik');
const Parent = require('../models/orangTua');

// Protect middleware for all user types (siswa, guru, ortu)
const protectAllRoles = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: err.name === 'TokenExpiredError' ? 'Sesi berakhir' : 'Token tidak valid'
      });
    }

    // Get profile from token
    const profile = decoded.profile || decoded;
    const currentRole = profile.role ? profile.role.toLowerCase() : '';
    const userType = decoded.type || currentRole;

    let user;
    let userId;

    if (currentRole === 'siswa' || userType === 'siswa') {
      user = await Student.findByPk(profile.id, {
        attributes: { exclude: ['password'] }
      });
      if (user) {
        userId = user.id;
      }
    } else if (currentRole === 'guru' || currentRole === 'teacher' || currentRole === 'tendik' || userType === 'guru') {
      user = await GuruTendik.findByPk(profile.id, {
        attributes: { exclude: ['password'] }
      });
      if (user) {
        userId = user.id;
      }
    } else if (currentRole === 'ortu' || currentRole === 'parent' || userType === 'ortu') {
      user = await Parent.findByPk(profile.id, {
        attributes: { exclude: ['password'] }
      });
      if (user) {
        userId = user.id;
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'User tidak ditemukan' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Akun dinonaktifkan' });
    }

    // Set request user info
    req.userId = userId;
    req.userType = userType;
    req.user = user.toJSON ? user.toJSON() : user;

    next();
  } catch (err) {
    console.error('[protectAllRoles]', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = { protectAllRoles };
