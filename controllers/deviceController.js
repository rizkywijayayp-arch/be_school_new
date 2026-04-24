const UserDevice = require('../models/userDevice');
const jwt = require('jsonwebtoken');

class DeviceController {
  // Register device when user logs in
  async registerDevice(req, res) {
    try {
      const { deviceId, deviceName, deviceModel, osVersion, appVersion } = req.body;
      const userId = req.userId;
      const userType = req.userType;

      if (!deviceId) {
        return res.status(400).json({ success: false, message: 'deviceId wajib diisi' });
      }

      // Check existing device
      let device = await UserDevice.findOne({
        where: { userId, deviceId, isActive: true }
      });

      if (device) {
        // Update last active
        device.lastActiveAt = new Date();
        device.deviceName = deviceName || device.deviceName;
        device.deviceModel = deviceModel || device.deviceModel;
        device.osVersion = osVersion || device.osVersion;
        device.appVersion = appVersion || device.appVersion;
        device.ipAddress = req.ip || req.connection?.remoteAddress;
        await device.save();
      } else {
        // Create new device
        device = await UserDevice.create({
          userId,
          userType,
          deviceId,
          deviceName: deviceName || 'Unknown Device',
          deviceModel: deviceModel || 'Unknown',
          osVersion: osVersion || 'Unknown',
          appVersion: appVersion || '1.0.0',
          ipAddress: req.ip || req.connection?.remoteAddress,
          lastActiveAt: new Date(),
          isActive: true,
        });
      }

      return res.json({
        success: true,
        message: 'Device registered',
        data: { deviceId: device.deviceId }
      });
    } catch (err) {
      console.error('[DeviceController.registerDevice]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get all devices for current user
  async getDevices(req, res) {
    try {
      const userId = req.userId;
      const userType = req.userType;

      const devices = await UserDevice.findAll({
        where: { userId, isActive: true },
        order: [['lastActiveAt', 'DESC']],
        attributes: ['id', 'deviceId', 'deviceName', 'deviceModel', 'osVersion', 'appVersion', 'lastActiveAt', 'ipAddress', 'createdAt'],
      });

      // Format response
      const formattedDevices = devices.map((d, index) => ({
        id: d.id,
        deviceId: d.deviceId,
        deviceName: d.deviceName || 'Perangkat Tidak Dikenal',
        deviceModel: d.deviceModel || '-',
        osVersion: d.osVersion || '-',
        appVersion: d.appVersion || '-',
        lastActiveAt: d.lastActiveAt,
        ipAddress: d.ipAddress || '-',
        isCurrent: index === 0, // Most recent = current device
        loginTime: d.createdAt,
      }));

      return res.json({
        success: true,
        data: {
          devices: formattedDevices,
          totalDevices: formattedDevices.length,
        },
      });
    } catch (err) {
      console.error('[DeviceController.getDevices]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Revoke (logout) a specific device
  async revokeDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const userId = req.userId;

      if (!deviceId) {
        return res.status(400).json({ success: false, message: 'deviceId wajib diisi' });
      }

      const device = await UserDevice.findOne({
        where: { userId, deviceId, isActive: true }
      });

      if (!device) {
        return res.status(404).json({ success: false, message: 'Device tidak ditemukan' });
      }

      device.isActive = false;
      device.lastActiveAt = new Date();
      await device.save();

      return res.json({
        success: true,
        message: 'Device berhasil logout',
      });
    } catch (err) {
      console.error('[DeviceController.revokeDevice]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Revoke all other devices except current
  async revokeAllOtherDevices(req, res) {
    try {
      const { currentDeviceId } = req.body;
      const userId = req.userId;

      if (!currentDeviceId) {
        return res.status(400).json({ success: false, message: 'currentDeviceId wajib diisi' });
      }

      const result = await UserDevice.update(
        { isActive: false, lastActiveAt: new Date() },
        { where: { userId, deviceId: { ['Op.ne']: currentDeviceId }, isActive: true } }
      );

      return res.json({
        success: true,
        message: `${result[0]} device berhasil logout`,
      });
    } catch (err) {
      console.error('[DeviceController.revokeAllOtherDevices]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Logout device (called when user logs out)
  async logoutDevice(req, res) {
    try {
      const { deviceId } = req.body;
      const userId = req.userId;

      if (!deviceId) {
        return res.status(400).json({ success: false, message: 'deviceId wajib diisi' });
      }

      const device = await UserDevice.findOne({
        where: { userId, deviceId, isActive: true }
      });

      if (device) {
        device.isActive = false;
        device.lastActiveAt = new Date();
        await device.save();
      }

      return res.json({
        success: true,
        message: 'Device logout berhasil',
      });
    } catch (err) {
      console.error('[DeviceController.logoutDevice]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new DeviceController();
