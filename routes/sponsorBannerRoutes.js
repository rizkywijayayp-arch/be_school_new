const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middlewares/protect');
const optionalAuth = require('../middlewares/optionalLimiter');
const SponsorBanners = require('../models/sponsor_banners');

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads/banners');
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Cannot create banners upload dir:', err.message);
}

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `banner-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedImage = /jpeg|jpg|png|gif|webp/;
    const allowedVideo = /mp4|webm|ogg/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowedImage.test(ext) || /image\//.test(file.mimetype)) {
      cb(null, true);
    } else if (allowedVideo.test(ext) || /video\//.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (jpeg, png, gif, webp) and videos (mp4, webm) are allowed.'));
    }
  }
});

// Get active banners for siswa app
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { schoolId } = req.query;
    const where = { isActive: 1 };
    if (schoolId) where.schoolId = schoolId;

    const banners = await SponsorBanners.findAll({
      where,
      order: [['displayOrder', 'ASC']],
      limit: 10
    });
    res.json({ success: true, data: banners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all banners for admin
router.get('/admin', protect, async (req, res) => {
  try {
    const banners = await SponsorBanners.findAll({
      order: [['displayOrder', 'ASC']],
    });
    res.json({ success: true, data: banners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create banner
router.post('/', protect, upload.single('imageUrl'), async (req, res) => {
  try {
    const {
      schoolId, title, subtitle, mediaType,
      bgColorStart, bgColorEnd, textColor, accentColor,
      actionUrl, actionLabel, displayDurationSeconds, displayOrder, isActive
    } = req.body;

    let imageUrl = '';
    if (req.file) {
      imageUrl = `/uploads/banners/${req.file.filename}`;
    }

    const banner = await SponsorBanners.create({
      schoolId: schoolId || null,
      title,
      subtitle: subtitle || '',
      mediaType: mediaType || 'gradient',
      bgColorStart: bgColorStart || '#FF8A00',
      bgColorEnd: bgColorEnd || '#FF5500',
      textColor: textColor || '#FFFFFF',
      accentColor: accentColor || '#FFFFD700',
      imageUrl,
      actionUrl: actionUrl || '',
      actionLabel: actionLabel || 'Lihat',
      displayDurationSeconds: displayDurationSeconds || 10,
      displayOrder: displayOrder || 0,
      isActive: isActive !== '0' ? 1 : 0
    });

    res.json({ success: true, message: 'Banner created', data: banner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update banner
router.put('/:id', protect, upload.single('imageUrl'), async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await SponsorBanners.findByPk(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    const {
      title, subtitle, mediaType,
      bgColorStart, bgColorEnd, textColor, accentColor,
      actionUrl, actionLabel, displayDurationSeconds, displayOrder, isActive
    } = req.body;

    if (title !== undefined) banner.title = title;
    if (subtitle !== undefined) banner.subtitle = subtitle;
    if (mediaType !== undefined) banner.mediaType = mediaType;
    if (bgColorStart !== undefined) banner.bgColorStart = bgColorStart;
    if (bgColorEnd !== undefined) banner.bgColorEnd = bgColorEnd;
    if (textColor !== undefined) banner.textColor = textColor;
    if (accentColor !== undefined) banner.accentColor = accentColor;
    if (actionUrl !== undefined) banner.actionUrl = actionUrl;
    if (actionLabel !== undefined) banner.actionLabel = actionLabel;
    if (displayDurationSeconds !== undefined) banner.displayDurationSeconds = displayDurationSeconds;
    if (displayOrder !== undefined) banner.displayOrder = displayOrder;
    if (isActive !== undefined) banner.isActive = isActive === '1' ? 1 : 0;

    if (req.file) {
      banner.imageUrl = `/uploads/banners/${req.file.filename}`;
    }

    await banner.save();
    res.json({ success: true, message: 'Banner updated', data: banner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete banner
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await SponsorBanners.findByPk(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    // Delete associated files
    if (banner.imageUrl) {
      const imgPath = path.join(__dirname, '../..', banner.imageUrl);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    if (banner.videoUrl) {
      const vidPath = path.join(__dirname, '../..', banner.videoUrl);
      if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
    }

    await banner.destroy();
    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Upload image media for banner
router.post('/:id/upload-image', protect, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await SponsorBanners.findByPk(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Delete old image
    if (banner.imageUrl) {
      const oldPath = path.join(__dirname, '../..', banner.imageUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await banner.update({
      imageUrl: `/uploads/banners/${req.file.filename}`,
      mediaType: 'image'
    });

    res.json({ success: true, message: 'Image uploaded', data: { url: banner.imageUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Upload video media for banner
router.post('/:id/upload-video', protect, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await SponsorBanners.findByPk(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Delete old video
    if (banner.videoUrl) {
      const oldPath = path.join(__dirname, '../..', banner.videoUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await banner.update({
      videoUrl: `/uploads/banners/${req.file.filename}`,
      mediaType: 'video'
    });

    res.json({ success: true, message: 'Video uploaded', data: { url: banner.videoUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete banner media (image or video)
router.delete('/:id/media', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'image' or 'video'

    const banner = await SponsorBanners.findByPk(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (type === 'video') {
      if (banner.videoUrl) {
        const vidPath = path.join(__dirname, '../..', banner.videoUrl);
        if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
        await banner.update({ videoUrl: null });
      }
    } else {
      if (banner.imageUrl) {
        const imgPath = path.join(__dirname, '../..', banner.imageUrl);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        await banner.update({ imageUrl: null });
      }
    }

    // If no media, revert to gradient
    if (!banner.imageUrl && !banner.videoUrl) {
      await banner.update({ mediaType: 'gradient' });
    }

    res.json({ success: true, message: 'Media deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Banner pricing routes (in-memory pricing for now)
const DEFAULT_PRICING = {
  basic: { id: "basic", name: "Basic", price: 50000, period: "per bulan", views: "5.000 views/bulan", duration: 5, maxBanners: 3, commissionFee: 2 },
  premium: { id: "premium", name: "Premium", price: 150000, period: "per bulan", views: "20.000 views/bulan", duration: 10, maxBanners: 10, commissionFee: 2 },
  platinum: { id: "platinum", name: "Platinum", price: 300000, period: "per bulan", views: "100.000 views/bulan", duration: 20, maxBanners: 999, commissionFee: 2 },
};

let bannerPricing = { ...DEFAULT_PRICING };

router.get('/pricing', optionalAuth, async (req, res) => {
  res.json({ success: true, data: bannerPricing });
});

router.put('/pricing/:key', protect, async (req, res) => {
  try {
    const { key } = req.params;
    if (!bannerPricing[key]) {
      return res.status(404).json({ success: false, message: 'Pricing plan not found' });
    }

    const { name, price, duration, maxBanners, views, commissionFee } = req.body;
    bannerPricing[key] = {
      ...bannerPricing[key],
      ...(name !== undefined && { name }),
      ...(price !== undefined && { price }),
      ...(duration !== undefined && { duration }),
      ...(maxBanners !== undefined && { maxBanners }),
      ...(views !== undefined && { views }),
      ...(commissionFee !== undefined && { commissionFee }),
    };

    res.json({ success: true, message: 'Pricing updated', data: bannerPricing[key] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
