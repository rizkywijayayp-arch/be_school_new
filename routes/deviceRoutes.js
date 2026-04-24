const express = require('express');
const router = express.Router();
const DeviceController = require('../controllers/deviceController');
const { protectAllRoles } = require('../middlewares/protectAllRoles');

// All routes require authentication
router.use(protectAllRoles);

// Register/update device (called on app start/login)
router.post('/register', DeviceController.registerDevice);

// Get all devices for current user
router.get('/', DeviceController.getDevices);

// Revoke (logout) a specific device
router.delete('/:deviceId', DeviceController.revokeDevice);

// Revoke all other devices except current
router.post('/revoke-others', DeviceController.revokeAllOtherDevices);

// Logout current device
router.post('/logout', DeviceController.logoutDevice);

module.exports = router;
