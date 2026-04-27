/**
 * Tenant Routes
 * Manage tenant registration and API credentials
 */

const express = require('express');
const router = express.Router();
const Tenant = require('../models/tenant');
const { generateApiKey, generateApiSecret, hashSecret, validateAdminKey } = require('../middlewares/apiKeyAuth');

// ============================================================
// 1. REGISTER NEW TENANT (Admin only)
// ============================================================

/**
 * POST /tenant/register
 * Create new tenant with API credentials
 */
router.post('/register', validateAdminKey, async (req, res) => {
  try {
    const {
      schoolId,
      schoolName,
      domain,
      email,
      package = 'basic',
      trialDays = 30,
      allowedDomains,
      allowedIps,
    } = req.body;

    // Validation
    if (!schoolId || !schoolName) {
      return res.status(400).json({
        success: false,
        message: 'schoolId dan schoolName wajib diisi',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Check if schoolId already has tenant
    const existing = await Tenant.findOne({ where: { schoolId } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Tenant sudah ada untuk schoolId ini',
        code: 'TENANT_EXISTS'
      });
    }

    // Generate credentials
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();

    // Calculate subscription dates
    const now = new Date();
    const subscriptionEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    // Create tenant
    const tenant = await Tenant.create({
      schoolId,
      schoolName,
      domain: domain || null,
      apiKey,
      apiSecret: hashSecret(apiSecret),
      status: 'trial',
      subscriptionStart: now,
      subscriptionEnd,
      package,
      allowedDomains: allowedDomains || (domain ? [domain] : []),
      allowedIps: allowedIps || [],
    });

    console.log(`[TENANT] New tenant registered: ${schoolName} (ID: ${tenant.id})`);

    // Return credentials (show secret only once!)
    res.status(201).json({
      success: true,
      data: {
        id: tenant.id,
        schoolId: tenant.schoolId,
        schoolName: tenant.schoolName,
        domain: tenant.domain,
        apiKey: tenant.apiKey,
        apiSecret: apiSecret, // Show ONLY on register!
        apiBaseUrl: process.env.API_BASE_URL || 'https://be-school.kiraproject.id',
        status: tenant.status,
        package: tenant.package,
        trialEnds: tenant.subscriptionEnd,
        allowedDomains: tenant.allowedDomains,
      },
      message: 'PERHATIAN: Simpan API Key dan API Secret di tempat aman! Secret tidak akan ditampilkan lagi.',
      warning: 'Harap simpan API Secret sekarang. Anda tidak dapat mengambilnya lagi nanti.'
    });

  } catch (err) {
    console.error('[TENANT_REGISTER] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================
// 2. GET TENANT INFO (Admin only)
// ============================================================

/**
 * GET /tenant/:id
 * Get tenant details (masked API key)
 */
router.get('/:id', validateAdminKey, async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan',
        code: 'TENANT_NOT_FOUND'
      });
    }

    // Check if almost expired
    let warning = null;
    if (tenant.subscriptionEnd) {
      const daysLeft = Math.ceil((tenant.subscriptionEnd - new Date()) / (24 * 60 * 60 * 1000));
      if (daysLeft <= 7 && daysLeft > 0) {
        warning = `Langganan akan expire dalam ${daysLeft} hari`;
      } else if (daysLeft <= 0) {
        warning = 'Langganan sudah expired';
      }
    }

    res.json({
      success: true,
      data: {
        ...tenant.toJSON(),
        apiKey: tenant.apiKey.substring(0, 25) + '...',
        apiSecret: null, // Never expose
      },
      warning
    });

  } catch (err) {
    console.error('[TENANT_GET] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================
// 3. LIST ALL TENANTS (Admin only)
// ============================================================

/**
 * GET /tenant
 * List all tenants with pagination
 */
router.get('/', validateAdminKey, async (req, res) => {
  try {
    const {
      status,
      package: pkg,
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'DESC'
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (pkg) where.package = pkg;

    // Validate pagination
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const offset = (pageNum - 1) * limitNum;

    // Validate sort field
    const allowedSorts = ['createdAt', 'schoolName', 'status', 'subscriptionEnd', 'accessCount'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const { count, rows } = await Tenant.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [[sortField, order.toUpperCase()]],
    });

    // Mask API keys
    const tenants = rows.map(t => ({
      ...t.toJSON(),
      apiKey: t.apiKey.substring(0, 25) + '...',
      apiSecret: null,
      daysUntilExpiry: t.subscriptionEnd ?
        Math.ceil((new Date(t.subscriptionEnd) - new Date()) / (24 * 60 * 60 * 1000)) : null,
    }));

    // Stats summary
    const stats = await Tenant.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'active' THEN 1 ELSE 0 END")), 'active'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'expired' THEN 1 ELSE 0 END")), 'expired'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'trial' THEN 1 ELSE 0 END")), 'trial'],
      ],
      raw: true,
    });

    res.json({
      success: true,
      data: tenants,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum),
        hasMore: offset + limitNum < count
      },
      stats: stats[0] || {}
    });

  } catch (err) {
    console.error('[TENANT_LIST] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================
// 4. UPDATE TENANT SECURITY SETTINGS
// ============================================================

/**
 * PUT /tenant/:id/security
 * Update security settings (domains, IPs, rate limits)
 */
router.put('/:id/security', validateAdminKey, async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan',
        code: 'TENANT_NOT_FOUND'
      });
    }

    const {
      allowedDomains,
      allowedIps,
      rateLimitRequests,
      rateLimitWindow,
      notes
    } = req.body;

    // Update fields
    if (allowedDomains !== undefined) {
      if (typeof allowedDomains === 'string') {
        tenant.allowedDomains = allowedDomains.split(',').map(d => d.trim()).filter(Boolean);
      } else {
        tenant.allowedDomains = allowedDomains;
      }
    }

    if (allowedIps !== undefined) {
      if (typeof allowedIps === 'string') {
        tenant.allowedIps = allowedIps.split(',').map(ip => ip.trim()).filter(Boolean);
      } else {
        tenant.allowedIps = allowedIps;
      }
    }

    if (rateLimitRequests !== undefined) {
      tenant.rateLimitRequests = Math.max(10, Math.min(1000, parseInt(rateLimitRequests)));
    }

    if (rateLimitWindow !== undefined) {
      tenant.rateLimitWindow = Math.max(10000, Math.min(3600000, parseInt(rateLimitWindow)));
    }

    if (notes !== undefined) {
      tenant.notes = notes;
    }

    await tenant.save();

    console.log(`[TENANT] Security updated for: ${tenant.schoolName}`);

    res.json({
      success: true,
      data: {
        ...tenant.toJSON(),
        apiKey: tenant.apiKey.substring(0, 25) + '...',
        apiSecret: null,
      },
      message: 'Pengaturan keamanan berhasil diupdate'
    });

  } catch (err) {
    console.error('[TENANT_SECURITY] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================
// 5. REGENERATE API KEY
// ============================================================

/**
 * POST /tenant/:id/regenerate-key
 * Generate new API key and secret
 */
router.post('/:id/regenerate-key', validateAdminKey, async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan',
        code: 'TENANT_NOT_FOUND'
      });
    }

    const newApiKey = generateApiKey();
    const newApiSecret = generateApiSecret();

    // Save old key hash for audit
    const oldKeyHash = tenant.apiKey.split('-')[2]; // Just for logging

    tenant.apiKey = newApiKey;
    tenant.apiSecret = hashSecret(newApiSecret);
    await tenant.save();

    console.log(`[TENANT] API Key regenerated for: ${tenant.schoolName}`);

    res.json({
      success: true,
      data: {
        id: tenant.id,
        schoolName: tenant.schoolName,
        apiKey: newApiKey,
        apiSecret: newApiSecret, // Show ONLY on regenerate!
        apiBaseUrl: process.env.API_BASE_URL || 'https://be-school.kiraproject.id',
      },
      message: 'API Key berhasil di-regenerate! Simpan yang baru sekarang.',
      warning: 'API Key lama sudah tidak berlaku.'
    });

  } catch (err) {
    console.error('[TENANT_REGENERATE] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================
// 6. UPDATE SUBSCRIPTION
// ============================================================

/**
 * PUT /tenant/:id/subscription
 * Update subscription status and package
 */
router.put('/:id/subscription', validateAdminKey, async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan',
        code: 'TENANT_NOT_FOUND'
      });
    }

    const {
      status,
      package: pkg,
      subscriptionStart,
      subscriptionEnd,
      packageData // rename to avoid conflict
    } = req.body;

    const newPackage = pkg || packageData;

    // Validate status
    const validStatuses = ['active', 'suspended', 'expired', 'trial'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status tidak valid',
        code: 'INVALID_STATUS'
      });
    }

    // Validate package
    const validPackages = ['basic', 'standard', 'premium', 'enterprise', 'trial'];
    if (newPackage && !validPackages.includes(newPackage)) {
      return res.status(400).json({
        success: false,
        message: 'Package tidak valid',
        code: 'INVALID_PACKAGE'
      });
    }

    // Update fields
    if (status) tenant.status = status;
    if (newPackage) tenant.package = newPackage;
    if (subscriptionStart) tenant.subscriptionStart = new Date(subscriptionStart);
    if (subscriptionEnd) tenant.subscriptionEnd = new Date(subscriptionEnd);

    await tenant.save();

    console.log(`[TENANT] Subscription updated for: ${tenant.schoolName} - ${tenant.status}/${tenant.package}`);

    res.json({
      success: true,
      data: {
        ...tenant.toJSON(),
        apiKey: tenant.apiKey.substring(0, 25) + '...',
        apiSecret: null,
      },
      message: 'Subscription berhasil diupdate'
    });

  } catch (err) {
    console.error('[TENANT_SUBSCRIPTION] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================
// 7. TOGGLE TENANT ACTIVE/INACTIVE
// ============================================================

/**
 * POST /tenant/:id/toggle
 * Enable or disable tenant
 */
router.post('/:id/toggle', validateAdminKey, async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan',
        code: 'TENANT_NOT_FOUND'
      });
    }

    const newStatus = !tenant.isActive;
    tenant.isActive = newStatus;
    await tenant.save();

    const statusText = newStatus ? 'diaktifkan' : 'dinonaktifkan';
    console.log(`[TENANT] Tenant ${statusText}: ${tenant.schoolName}`);

    res.json({
      success: true,
      data: {
        id: tenant.id,
        schoolName: tenant.schoolName,
        isActive: tenant.isActive,
      },
      message: `Tenant berhasil ${statusText}`
    });

  } catch (err) {
    console.error('[TENANT_TOGGLE] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================
// 8. GET TENANT STATS / USAGE
// ============================================================

/**
 * GET /tenant/:id/usage
 * Get tenant usage statistics
 */
router.get('/:id/usage', validateAdminKey, async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan',
        code: 'TENANT_NOT_FOUND'
      });
    }

    // Calculate percentages
    const storagePercent = tenant.storageLimit > 0
      ? Math.round((tenant.storageUsed / tenant.storageLimit) * 100)
      : 0;

    const bandwidthPercent = tenant.bandwidthLimit > 0
      ? Math.round((tenant.bandwidthUsed / tenant.bandwidthLimit) * 100)
      : 0;

    // Calculate days until expiry
    const daysLeft = tenant.subscriptionEnd
      ? Math.ceil((new Date(tenant.subscriptionEnd) - new Date()) / (24 * 60 * 60 * 1000))
      : null;

    res.json({
      success: true,
      data: {
        id: tenant.id,
        schoolName: tenant.schoolName,
        package: tenant.package,
        status: tenant.status,
        usage: {
          storage: {
            used: tenant.storageUsed,
            limit: tenant.storageLimit,
            percent: storagePercent,
            usedFormatted: formatBytes(tenant.storageUsed),
            limitFormatted: formatBytes(tenant.storageLimit),
          },
          bandwidth: {
            used: tenant.bandwidthUsed,
            limit: tenant.bandwidthLimit,
            percent: bandwidthPercent,
            usedFormatted: formatBytes(tenant.bandwidthUsed),
            limitFormatted: formatBytes(tenant.bandwidthLimit),
          },
          access: {
            totalAccess: tenant.accessCount,
            lastAccess: tenant.lastAccessAt,
            lastIP: tenant.lastIP,
          }
        },
        subscription: {
          start: tenant.subscriptionStart,
          end: tenant.subscriptionEnd,
          daysLeft,
          isExpired: daysLeft !== null && daysLeft <= 0,
        }
      }
    });

  } catch (err) {
    console.error('[TENANT_USAGE] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================
// 9. DELETE TENANT
// ============================================================

/**
 * DELETE /tenant/:id
 * Soft delete tenant (set isActive = false)
 */
router.delete('/:id', validateAdminKey, async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan',
        code: 'TENANT_NOT_FOUND'
      });
    }

    // Soft delete - just deactivate
    tenant.isActive = false;
    tenant.status = 'suspended';
    await tenant.save();

    console.log(`[TENANT] Tenant deleted: ${tenant.schoolName}`);

    res.json({
      success: true,
      data: {
        id: tenant.id,
        schoolName: tenant.schoolName,
      },
      message: 'Tenant berhasil dihapus (dinonaktifkan)'
    });

  } catch (err) {
    console.error('[TENANT_DELETE] Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;