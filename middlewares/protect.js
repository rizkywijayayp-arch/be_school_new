const jwt = require('jsonwebtoken');
const SchoolAccount = require('../models/auth');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Anda belum login' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await SchoolAccount.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User sudah tidak ada' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid' });
  }
};

// Restrict to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk operasi ini',
      });
    }
    next();
  };
};

// Ensure HANYA ada satu module.exports di akhir file
module.exports = { protect, restrictTo };