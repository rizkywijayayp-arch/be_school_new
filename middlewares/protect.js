const jwt = require('jsonwebtoken');
const SchoolAccount = require('../models/auth');

// Helper: extract actual schoolId from schoolprofiles
const extractSchoolId = async (userId) => {
  const SchoolProfile = require('../models/profileSekolah');
  try {
    const sp = await SchoolProfile.findOne({ where: { id: userId } });
    return sp ? sp.schoolId : userId;
  } catch {
    return userId;
  }
};

// Optional auth - allows requests without token
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    req.schoolId = null;
    req.enforcedSchoolId = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // Set schoolId from token payload (actual data key, e.g. 55)
    req.schoolId = decoded.schoolId || null;
    req.enforcedSchoolId = decoded.schoolId || null;
  } catch {
    req.user = null;
    req.schoolId = null;
    req.enforcedSchoolId = null;
  }

  next();
};

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
    req.user = decoded;
    // Set schoolId from token (actual data key)
    req.schoolId = decoded.schoolId || null;
    req.enforcedSchoolId = decoded.schoolId || null;
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
module.exports = { protect, restrictTo, optionalAuth, protectAdmin: protect };