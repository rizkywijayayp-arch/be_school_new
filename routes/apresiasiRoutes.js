/**
 * Apresiasi Routes
 * API endpoints untuk apresiasi siswa
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middlewares/protect');
const { Op } = require('sequelize');
const Apresiasi = require('../models/apresiasi');

// ============================================================
// GET all appreciations
// ============================================================
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { schoolId, category, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const where = { isActive: true };
    if (schoolId) where.schoolId = schoolId;
    if (category && category !== 'all') where.category = category;
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Apresiasi.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    console.error('[Apresiasi Routes] Error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message.includes('doesn\'t exist')
        ? 'Table appreciations belum ada'
        : err.message
    });
  }
});

// ============================================================
// GET appreciation by ID
// ============================================================
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const appreciation = await Apresiasi.findByPk(id);

    if (!appreciation) {
      return res.status(404).json({
        success: false,
        message: 'Apresiasi tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: appreciation
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// GET stats
// ============================================================
router.get('/stats/summary', optionalAuth, async (req, res) => {
  try {
    const { schoolId } = req.query;
    const where = { isActive: true };
    if (schoolId) where.schoolId = schoolId;

    const total = await Apresiasi.count({ where });

    const byCategory = await Apresiasi.findAll({
      where,
      attributes: [
        'category',
        [Apresiasi.sequelize.fn('COUNT', Apresiasi.sequelize.col('category')), 'count']
      ],
      group: ['category']
    });

    res.json({
      success: true,
      data: {
        total,
        byCategory: byCategory.reduce((acc, item) => {
          acc[item.category] = parseInt(item.get('count'));
          return acc;
        }, {})
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// POST create appreciation
// ============================================================
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { schoolId, title, content, category, poin, images, authorId, authorName } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title dan content wajib diisi'
      });
    }

    const appreciation = await Apresiasi.create({
      schoolId: schoolId || 1,
      title,
      content,
      category: category || 'LAINNYA',
      poin: poin || 0,
      images: images || null,
      authorId: authorId || null,
      authorName: authorName || null,
      isActive: true
    });

    res.json({
      success: true,
      data: appreciation,
      message: 'Apresiasi berhasil dibuat'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// PUT update appreciation
// ============================================================
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category, poin, images, isActive } = req.body;

    const appreciation = await Apresiasi.findByPk(id);
    if (!appreciation) {
      return res.status(404).json({
        success: false,
        message: 'Apresiasi tidak ditemukan'
      });
    }

    if (title !== undefined) appreciation.title = title;
    if (content !== undefined) appreciation.content = content;
    if (category !== undefined) appreciation.category = category;
    if (poin !== undefined) appreciation.poin = poin;
    if (images !== undefined) appreciation.images = images;
    if (isActive !== undefined) appreciation.isActive = isActive;

    await appreciation.save();

    res.json({
      success: true,
      data: appreciation,
      message: 'Apresiasi berhasil diupdate'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// DELETE appreciation (soft delete)
// ============================================================
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const appreciation = await Apresiasi.findByPk(id);

    if (!appreciation) {
      return res.status(404).json({
        success: false,
        message: 'Apresiasi tidak ditemukan'
      });
    }

    appreciation.isActive = false;
    await appreciation.save();

    res.json({
      success: true,
      message: 'Apresiasi berhasil dihapus'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
