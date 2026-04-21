const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const { protect } = require('../middlewares/protect');
const optionalAuth = require('../middlewares/optionalLimiter');

// Get notifications for current logged user
router.get('/', protect, notificationsController.getMyNotifications);
router.get('/unread-count', protect, notificationsController.getUnreadCount);

// Get by user (legacy support)
router.get('/user/:userId', optionalAuth, notificationsController.getByUser);
router.get('/user/:userId/unread', optionalAuth, notificationsController.getUnread);
router.post('/user/:userId/read-all', protect, notificationsController.markAllRead);
router.post('/:id/read', protect, notificationsController.markRead);
router.post('/read-all', protect, notificationsController.markAllReadMine);
router.post('/send', protect, notificationsController.send);
router.post('/broadcast', protect, notificationsController.broadcast);
router.post('/send-to-user', protect, notificationsController.sendToUser);

module.exports = router;