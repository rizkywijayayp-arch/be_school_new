const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserDevice = sequelize.define('UserDevice', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  userType: { type: DataTypes.ENUM('siswa', 'guru', 'ortu'), allowNull: false },
  deviceId: { type: DataTypes.STRING(255), allowNull: false },
  deviceName: { type: DataTypes.STRING(100), allowNull: true },
  deviceModel: { type: DataTypes.STRING(100), allowNull: true },
  osVersion: { type: DataTypes.STRING(50), allowNull: true },
  appVersion: { type: DataTypes.STRING(20), allowNull: true },
  fcmToken: { type: DataTypes.STRING(255), allowNull: true },
  refreshToken: { type: DataTypes.TEXT, allowNull: true },
  lastActiveAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  ipAddress: { type: DataTypes.STRING(45), allowNull: true },
}, {
  tableName: 'user_devices',
  indexes: [
    { name: 'idx_user_device', fields: ['userId', 'deviceId'], unique: true },
    { name: 'idx_user_active', fields: ['userId', 'isActive'] },
  ]
});

module.exports = UserDevice;
