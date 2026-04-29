const sequelize = require('../config/database');

// Middleware untuk resolve domain → schoolId
const tenantMiddleware = async (req, res, next) => {
  // Skip tenant resolution for /api routes that don't need schoolId
  // Use originalUrl to check the full path (Express strips /api prefix from path)
  const urlPath = req.originalUrl.split('?')[0];
  if (urlPath.startsWith('/api/')) {
    return next();
  }

  try {
    let host = req.get('Host') || '';
    host = host.split(':')[0];
    const domain = host.replace(/^www\./, '');

    // Use raw query to avoid Sequelize model definition issues
    const [rows] = await sequelize.query(
      'SELECT id, schoolId, domain FROM profile_sekolah WHERE domain = ? LIMIT 1',
      { replacements: [domain] }
    );

    if (rows && rows.length > 0) {
      req.schoolId = rows[0].schoolId || rows[0].id;
      req.schoolDomain = domain;
    }
    next();
  } catch (err) {
    // Fallback: continue without schoolId for routes that don't need it
    // This prevents API routes from failing due to DB errors
    console.error('[TENANT] Error resolving domain:', err.message);
    next();
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