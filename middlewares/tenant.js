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
      'SELECT id, schoolId, domain FROM schoolprofiles WHERE domain = ? LIMIT 1',
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

/**
 * enforceTenant — enforces tenant isolation on API routes.
 *
 * Priority 1: X-School-Id header (explicit, from client)
 *   → Must match req.user.sekolahId from JWT payload
 *   → 403 TENANT_MISMATCH if mismatch
 *
 * Priority 2: Domain-based schoolId (set by tenantMiddleware)
 *   → Used when no X-School-Id header is present
 *
 * Blocking: schoolId in query/body without X-School-Id header
 *   → 403 PARAM_INJECTION_BLOCKED (prevents tenant confusion attacks)
 */
const enforceTenant = async (req, res, next) => {
  const hasSchoolIdHeader = !!req.headers['x-school-id'];
  const querySchoolId = req.query.schoolId;
  const bodySchoolId = req.body && req.body.schoolId;

  // ── Block param injection ───────────────────────────────────
  // If schoolId appears in query/body but no X-School-Id header,
  // it's suspicious — the client is trying to override tenant via params.
  if (!hasSchoolIdHeader && (querySchoolId || bodySchoolId)) {
    return res.status(403).json({
      success: false,
      message: 'schoolId cannot be passed via query/body without X-School-Id header',
      code: 'PARAM_INJECTION_BLOCKED'
    });
  }

  // ── Validate header vs JWT (if header is present) ────────────
  if (hasSchoolIdHeader) {
    const headerSchoolId = parseInt(req.headers['x-school-id'], 10);

    // Check both sekolahId and schoolId (different JWT implementations)
    const jwtSchoolId = req.user?.sekolahId ?? req.user?.schoolId;
    if (jwtSchoolId !== undefined && headerSchoolId !== jwtSchoolId) {
      return res.status(403).json({
        success: false,
        message: 'X-School-Id does not match authenticated tenant',
        code: 'TENANT_MISMATCH',
        detail: {
          headerSchoolId,
          jwtSchoolId
        }
      });
    }

    // Use the validated header schoolId
    req.enforcedSchoolId = headerSchoolId;
    return next();
  }

  // ── Fall back to domain-based (set by tenantMiddleware) ──────
  if (req.schoolId) {
    req.enforcedSchoolId = parseInt(req.schoolId, 10);
  }

  next();
};

module.exports = { tenantMiddleware, enforceTenant };