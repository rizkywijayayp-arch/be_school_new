const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sos = sequelize.define('Sos', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  userType: { type: DataTypes.ENUM('siswa', 'guru', 'ortu'), allowNull: false },
  latitude: { type: DataTypes.DECIMAL(10, 8) },
  longitude: { type: DataTypes.DECIMAL(11, 8) },
  status: { type: DataTypes.ENUM('pending', 'acknowledged', 'resolved'), defaultValue: 'pending' },
  acknowledgedBy: { type: DataTypes.INTEGER },
  acknowledgedAt: { type: DataTypes.DATE },
}, { timestamps: true, createdAt: 'createdAt' });

module.exports = Sos;
