const SchoolProfile = require('../models/profileSekolah');

// Middleware untuk resolve domain → schoolId
const tenantMiddleware = async (req, res, next) => {
  try {
    let host = req.get('Host') || '';
    host = host.split(':')[0];
    const domain = host.replace(/^www\./, '');

    const school = await SchoolProfile.findOne({ where: { domain } });
    if (school) {
      req.schoolId = school.schoolId || school.id;
      req.schoolDomain = domain;
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Middleware untuk enforce tenant (paksa schoolId dari query/body/header)
const enforceTenant = (req, res, next) => {
  const schoolId = req.query.schoolId || req.body.schoolId || req.headers['x-school-id'];
  if (schoolId) {
    req.enforcedSchoolId = schoolId;
  }
  next();
};

module.exports = { tenantMiddleware, enforceTenant };